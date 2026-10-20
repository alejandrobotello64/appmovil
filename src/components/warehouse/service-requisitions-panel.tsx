"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, PackageCheck, Printer, RefreshCw, ShoppingCart, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PurchaseRequestForm } from "@/components/purchasing/purchase-request-form";
import { PurchaseStatusBadge, formatQty } from "@/components/purchasing/purchasing-shared";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { usePermissions, useSessionAccess } from "@/lib/auth/use-permissions";
import { getPurchaseRequests, getRequisitionShortages } from "@/lib/purchasing/storage";
import { isPurchaseOpen, type PurchaseRequest, type RequisitionShortage } from "@/lib/purchasing/types";
import {
  cancelServiceOrderRequisition,
  fulfillServiceOrderRequisitions,
  getServiceOrderRequisitions,
} from "@/lib/service-orders/requisition-storage";
import { downloadRequisitionsPdf } from "@/lib/service-orders/requisition-pdf";
import {
  REQUISITION_SOURCES,
  REQUISITION_STATUSES,
  allocateFulfillmentQty,
  canonicalRequester,
  groupRequisitionLines,
  isOffCatalogLine,
  isRequisitionOpen,
  requesterKey,
  requisitionLinePending,
  requisitionLineStatusLabel,
  requisitionOriginFolio,
  requisitionProgress,
  requisitionSourceLabel,
  requisitionStatusLabel,
  sameRequester,
  type GroupedRequisitionLine,
  type RequisitionSource,
  type RequisitionStatus,
  type ServiceOrderRequisition,
} from "@/lib/service-orders/requisitions";
import { listStaffMembers, type StaffMember } from "@/lib/users/staff";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import { matchesSearch } from "@/lib/search";
import { SortableTable } from "@/components/ui/sortable-table";
import { requisitionStatusTone as statusTone } from "@/components/sales/quote-fulfillment";

function formatDay(value: string) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-MX");
}

function originPrefix(source: RequisitionSource) {
  return source === "cotizacion" ? "COT" : "OS";
}

function groupDraftQty(group: GroupedRequisitionLine, qtyDraft: Record<string, string>) {
  return group.sources.reduce((sum, source) => sum + Number(qtyDraft[source.line.id] || 0), 0);
}

function groupSourceHint(group: GroupedRequisitionLine) {
  if (group.sources.length < 2) return "";
  const byFolio = new Map<string, { folio: string; origin: string; qty: number }>();
  for (const source of group.sources) {
    const folio = source.requisition.folio;
    const qty = requisitionLinePending(source.line) || source.line.quantityRequested;
    const existing = byFolio.get(folio);
    if (existing) {
      existing.qty += qty;
      continue;
    }
    byFolio.set(folio, {
      folio,
      origin: `${originPrefix(source.requisition.sourceType)} ${requisitionOriginFolio(source.requisition) || "—"}`,
      qty,
    });
  }
  return [...byFolio.values()]
    .map((item) => `${formatQty(item.qty)} en ${item.folio} (${item.origin})`)
    .join(" · ");
}

function initialDraft(requisition: ServiceOrderRequisition | null) {
  const qty: Record<string, string> = {};
  for (const line of requisition?.lines ?? []) {
    // Lo fuera de catálogo llega por compra; se entrega solo cuando almacén captura la cantidad.
    qty[line.id] = isOffCatalogLine(line) ? "0" : formatQty(requisitionLinePending(line));
  }
  return { qty, notes: requisition?.warehouseNotes ?? "" };
}

type LoadedData = { requisitions: ServiceOrderRequisition[]; purchases: PurchaseRequest[] };

export function ServiceRequisitionsPanel({
  source,
  permissionModule = "solicitudes",
  allowFulfill,
  title = "Solicitudes de surtimiento",
  subtitle = "Al elegir a una persona se juntan todas sus solicitudes abiertas. Quien surte ve cada código una sola vez, con la cantidad total. Al imprimir sale una hoja por solicitud.",
}: {
  /** Limita la bandeja a un origen; sin valor se muestran todos con filtro. */
  source?: RequisitionSource;
  permissionModule?: "solicitudes" | "ordenes_servicio" | "cotizaciones";
  allowFulfill?: boolean;
  title?: string;
  subtitle?: string;
} = {}) {
  const { canWrite } = usePermissions(permissionModule);
  const warehouse = usePermissions("solicitudes");
  const { session } = useSessionAccess();
  const canFulfill = (allowFulfill ?? permissionModule === "solicitudes") && warehouse.canWrite;
  const canCancel = canFulfill || (source === "cotizacion" && canWrite);
  const actor = session?.username ?? "usuario";
  const [sourceFilter, setSourceFilter] = useState<RequisitionSource | "todas">("todas");
  const activeSource = source ?? (sourceFilter === "todas" ? undefined : sourceFilter);

  const [data, setData] = useState<LoadedData | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequisitionStatus | "abiertas" | "todas">("abiertas");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [personFilter, setPersonFilter] = useState("todas");
  const [query, setQuery] = useState("");
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [groupQtyDraft, setGroupQtyDraft] = useState<Record<string, string>>({});
  const [warehouseNotes, setWarehouseNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState<{
    requisition: ServiceOrderRequisition;
    shortages: RequisitionShortage[];
  } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      getServiceOrderRequisitions({ sourceType: source }),
      getPurchaseRequests().catch(() => [] as PurchaseRequest[]),
      listStaffMembers().catch(() => [] as StaffMember[]),
    ])
      .then(([requisitions, purchases, members]) => {
        if (!active) return;
        setData({ requisitions, purchases });
        setStaff(members);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "No se pudieron cargar solicitudes.");
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey, source]);

  function refresh() {
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  }

  const items = useMemo(() => data?.requisitions ?? [], [data]);
  const selectedItems = useMemo(
    () => selectedIds.map((id) => items.find((item) => item.id === id)).filter(Boolean) as ServiceOrderRequisition[],
    [items, selectedIds]
  );
  const selected = selectedItems[0] ?? null;
  const selectedOpen = selectedItems.filter((item) => isRequisitionOpen(item.status));
  const selectedRequester = selected?.requestedBy ?? "";

  const purchasesByRequisition = useMemo(() => {
    const map = new Map<string, PurchaseRequest[]>();
    for (const purchase of data?.purchases ?? []) {
      if (!purchase.requisitionId) continue;
      map.set(purchase.requisitionId, [...(map.get(purchase.requisitionId) ?? []), purchase]);
    }
    return map;
  }, [data]);
  const selectedPurchases = selectedOpen.flatMap(
    (item) => purchasesByRequisition.get(item.id) ?? []
  );
  const pickGroups = useMemo(() => groupRequisitionLines(selectedItems), [selectedItems]);
  const pickPending = pickGroups.reduce((sum, group) => sum + group.pending, 0);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const statusOk =
          statusFilter === "todas" ||
          (statusFilter === "abiertas"
            ? isRequisitionOpen(item.status)
            : item.status === statusFilter);
        const sourceOk = !activeSource || item.sourceType === activeSource;
        return (
          statusOk &&
          sourceOk &&
          matchesSearch(query, [
            item.folio,
            item.serviceOrderFolio,
            item.quoteFolio,
            item.clientName,
            item.equipmentName,
            item.deliveryAddress,
            requisitionSourceLabel(item.sourceType),
            item.requestedBy,
            item.fulfilledBy,
            requisitionStatusLabel(item.status),
            ...item.lines.flatMap((line) => [
              line.productSku,
              line.productName,
              line.description,
            ]),
          ]) &&
          (personFilter === "todas" || sameRequester(item.requestedBy, personFilter, staff))
        );
      }),
    [items, statusFilter, query, activeSource, personFilter, staff]
  );

  const people = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const item of items) {
      const name = item.requestedBy.trim();
      const key = canonicalRequester(name, staff) || requesterKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push(name);
    }
    return list.sort((a, b) => a.localeCompare(b, "es"));
  }, [items, staff]);

  function openFromPerson(person: string) {
    return items.filter(
      (item) => isRequisitionOpen(item.status) && sameRequester(item.requestedBy, person, staff)
    );
  }

  const samePersonOpen = useMemo(() => {
    if (!selectedRequester) return [];
    return openFromPerson(selectedRequester);
  }, [items, selectedRequester, staff]);

  const personGroups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; items: ServiceOrderRequisition[] }>();
    for (const item of filtered) {
      const key = canonicalRequester(item.requestedBy, staff) || `solo:${item.id}`;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
        continue;
      }
      const member = staff.find(
        (entry) => canonicalRequester(entry.username, staff) === key
      );
      map.set(key, {
        key,
        name: member?.fullName || item.requestedBy.trim() || "Sin solicitante",
        items: [item],
      });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [filtered, staff]);

  function mergeDrafts(requisitions: ServiceOrderRequisition[], reset: boolean) {
    setQtyDraft((current) => {
      const next = reset ? {} : { ...current };
      for (const requisition of requisitions) {
        const draft = initialDraft(requisition);
        for (const [lineId, value] of Object.entries(draft.qty)) {
          if (reset || next[lineId] == null) next[lineId] = value;
        }
      }
      return next;
    });
    if (reset) {
      setGroupQtyDraft({});
      setWarehouseNotes(requisitions.map((item) => item.warehouseNotes).find(Boolean) ?? "");
    }
  }

  function selectPersonGroup(person: string, extra?: ServiceOrderRequisition) {
    const group = openFromPerson(person);
    const chosen = group.length ? group : extra ? [extra] : [];
    if (!chosen.length) return;
    setError("");
    setSelectedIds(chosen.map((item) => item.id));
    mergeDrafts(chosen, true);
  }

  function selectRequisition(requisition: ServiceOrderRequisition, add = false) {
    const already = selectedIds.includes(requisition.id);
    if (add && selectedItems.length) {
      if (already) {
        const next = selectedItems.filter((item) => item.id !== requisition.id);
        setSelectedIds(next.map((item) => item.id));
        return;
      }
      if (!isRequisitionOpen(requisition.status)) {
        setSelectedIds([requisition.id]);
        mergeDrafts([requisition], true);
        return;
      }
      if (!sameRequester(requisition.requestedBy, selectedRequester, staff)) {
        selectPersonGroup(requisition.requestedBy, requisition);
        return;
      }
      setError("");
      setSelectedIds([...selectedIds, requisition.id]);
      mergeDrafts([requisition], false);
      return;
    }
    if (isRequisitionOpen(requisition.status)) {
      selectPersonGroup(requisition.requestedBy, requisition);
      return;
    }
    setError("");
    setSelectedIds([requisition.id]);
    mergeDrafts([requisition], true);
  }

  function selectAllFromPerson() {
    if (!samePersonOpen.length) return;
    setError("");
    setSelectedIds(samePersonOpen.map((item) => item.id));
    mergeDrafts(samePersonOpen, true);
  }

  async function reloadKeepingSelection(text: string) {
    setMessage(text);
    const [requisitions, purchases] = await Promise.all([
      getServiceOrderRequisitions({ sourceType: source }),
      getPurchaseRequests().catch(() => data?.purchases ?? []),
    ]);
    setData({ requisitions, purchases });
    const kept = selectedIds
      .map((id) => requisitions.find((item) => item.id === id))
      .filter(Boolean) as ServiceOrderRequisition[];
    setSelectedIds(kept.map((item) => item.id));
    if (kept.length) mergeDrafts(kept, true);
  }

  async function onFulfill() {
    if (!selectedOpen.length || !canFulfill) return;
    const jobs = selectedOpen.map((requisition) => ({
      requisitionId: requisition.id,
      fulfillments: requisition.lines
        .map((line) => ({ lineId: line.id, quantity: Number(qtyDraft[line.id] || 0) }))
        .filter((item) => item.quantity > 0),
    }));
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const fulfilled = await fulfillServiceOrderRequisitions(jobs, actor, warehouseNotes);
      const folios = fulfilled.map((item) => item.folio).join(", ");
      await reloadKeepingSelection(
        fulfilled.length === 1
          ? `Solicitud ${folios} surtida y descontada del inventario. Puedes imprimir la hoja de surtimiento.`
          : `Se surtieron ${fulfilled.length} solicitudes (${folios}) y se descontó el inventario. Al imprimir sale una hoja por solicitud.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo surtir.");
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    if (!selected || !canCancel) return;
    if (!window.confirm(`¿Cancelar la solicitud ${selected.folio}?`)) return;
    setBusy(true);
    setError("");
    try {
      await cancelServiceOrderRequisition(selected.id, actor);
      await reloadKeepingSelection(`Solicitud ${selected.folio} cancelada.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar.");
    } finally {
      setBusy(false);
    }
  }

  async function onPrint() {
    if (!selectedItems.length) return;
    setError("");
    try {
      await downloadRequisitionsPdf(selectedItems, {
        printedBy: session ? { username: session.username, fullName: session.fullName } : undefined,
        printedByWarehouse: canFulfill,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el PDF.");
    }
  }

  async function onRequestPurchase() {
    const target = selectedOpen[0];
    if (!target) return;
    if (selectedOpen.length > 1) {
      setError("Para pedir faltantes a compras deja una sola solicitud seleccionada.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const shortages = await getRequisitionShortages(
        target,
        purchasesByRequisition.get(target.id) ?? []
      );
      if (!shortages.length) {
        setError("Esta solicitud ya no tiene material pendiente de surtir.");
        return;
      }
      setPurchaseForm({ requisition: target, shortages });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo calcular el faltante.");
    } finally {
      setBusy(false);
    }
  }

  const canFulfillSelection = selectedOpen.length > 0;
  const loading = data === null && !error;

  return (
    <section className="space-y-4">
      {!canWrite ? <ReadOnlyBanner visible /> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#3B46A5]">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Buscar folio, OS, cotización, cliente o material..."
            className="sm:w-80"
          />
          {people.length > 1 ? (
            <select
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={personFilter}
              onChange={(e) => setPersonFilter(e.target.value)}
              aria-label="Solicitante"
            >
              <option value="todas">Todas las personas</option>
              {people.map((person) => (
                <option key={requesterKey(person)} value={person}>
                  {person}
                </option>
              ))}
            </select>
          ) : null}
          {!source ? (
            <select
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as RequisitionSource | "todas")}
              aria-label="Origen"
            >
              <option value="todas">Todos los orígenes</option>
              {REQUISITION_SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : null}
          <select
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RequisitionStatus | "abiertas" | "todas")}
          >
            <option value="abiertas">Abiertas</option>
            <option value="todas">Todas</option>
            {REQUISITION_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} /> Actualizar
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <SortableTable className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-3"> </th>
                <th className="px-3 py-3">Folio</th>
                <th className="px-3 py-3">Origen</th>
                <th className="px-3 py-3">Cliente / detalle</th>
                <th className="px-3 py-3">Estatus</th>
                <th className="px-3 py-3">Avance</th>
                <th className="px-3 py-3">Solicitó</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-6 text-muted-foreground" colSpan={7}>
                    Cargando…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-muted-foreground" colSpan={7}>
                    {query.trim()
                      ? "Ninguna solicitud coincide con la búsqueda."
                      : "No hay solicitudes en este filtro."}
                  </td>
                </tr>
              ) : (
                personGroups.flatMap((group) => {
                  const openInGroup = group.items.filter((item) => isRequisitionOpen(item.status));
                  const selectedInGroup = group.items.filter((item) => selectedIds.includes(item.id)).length;
                  const groupChecked =
                    openInGroup.length > 0 &&
                    openInGroup.every((item) => selectedIds.includes(item.id));
                  const header = (
                    <tr
                      key={`group-${group.key}`}
                      className="border-t border-border bg-muted/50"
                      data-sort="off"
                    >
                      <td className="px-3 py-2">
                        {canFulfill && openInGroup.length > 0 ? (
                          <input
                            type="checkbox"
                            className="size-4 accent-[#3B46A5]"
                            checked={groupChecked}
                            aria-label={`Seleccionar las ${openInGroup.length} solicitudes abiertas de ${group.name}`}
                            onChange={() => {
                              if (groupChecked) {
                                const drop = new Set(openInGroup.map((item) => item.id));
                                setSelectedIds(selectedIds.filter((id) => !drop.has(id)));
                                return;
                              }
                              selectPersonGroup(group.items[0].requestedBy, group.items[0]);
                            }}
                          />
                        ) : null}
                      </td>
                      <td className="px-3 py-2" colSpan={6}>
                        <p className="text-xs font-semibold text-[#3B46A5]">
                          {group.name}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {openInGroup.length > 1
                              ? `${openInGroup.length} solicitudes abiertas de distintas órdenes`
                              : `${group.items.length} solicitud(es)`}
                            {selectedInGroup ? ` · ${selectedInGroup} elegidas` : ""}
                          </span>
                        </p>
                      </td>
                    </tr>
                  );
                  const rows = group.items.map((item) => {
                  const openPurchases = (purchasesByRequisition.get(item.id) ?? []).filter((p) => isPurchaseOpen(p.status));
                  const progress = requisitionProgress(item);
                  const detail =
                    item.sourceType === "cotizacion"
                      ? item.deliveryAddress || "Venta"
                      : item.equipmentName || "Sin equipo";
                  const checked = selectedIds.includes(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "cursor-pointer border-t border-border align-top hover:bg-muted/30",
                        checked && "bg-muted/40"
                      )}
                      onClick={() => selectRequisition(item, false)}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          className="size-4 accent-[#3B46A5]"
                          checked={checked}
                          aria-label={`Seleccionar ${item.folio}`}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => selectRequisition(item, true)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{item.folio}</p>
                        {item.priority === "urgente" ? (
                          <span className="mt-1 inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                            Urgente
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <p>{requisitionOriginFolio(item) || "—"}</p>
                        <p className="text-xs text-muted-foreground">{requisitionSourceLabel(item.sourceType)}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p>{item.clientName || "—"}</p>
                        <p className="text-xs text-muted-foreground">{detail}</p>
                        {item.neededBy ? (
                          <p className="text-xs text-muted-foreground">Para {formatDay(item.neededBy)}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", statusTone(item.status))}
                        >
                          {requisitionStatusLabel(item.status)}
                        </span>
                        {openPurchases.length ? (
                          <span className="mt-1 flex items-center gap-1 text-xs text-violet-700 dark:text-violet-300">
                            <ShoppingCart className="size-3" /> En compra ({openPurchases.length})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <p className="tabular-nums">{progress.percent}%</p>
                        <p className="text-xs text-muted-foreground">{item.lines.length} línea(s)</p>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <p>{item.requestedBy || "—"}</p>
                        <p className="text-muted-foreground">
                          {item.requestedAt ? new Date(item.requestedAt).toLocaleString("es-MX") : "—"}
                        </p>
                      </td>
                    </tr>
                  );
                  });
                  return [header, ...rows];
                })
              )}
            </tbody>
          </SortableTable>
        </div>

        <aside className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              {canFulfill
                ? "Toca a una persona o una solicitud abierta: se juntan todas las de esa persona. El mismo código aparece una sola vez, con la cantidad total. Quita el visto si alguna no va en este surtido."
                : "Selecciona una solicitud para ver su avance o imprimirla."}
            </p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {selectedItems.length > 1
                      ? `${selectedItems.length} solicitudes de ${selectedRequester || "la misma persona"}`
                      : "Solicitud"}
                  </p>
                  <h3 className="text-base font-semibold">
                    {selectedItems.map((item) => item.folio).join(" · ")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedItems
                      .map(
                        (item) =>
                          `${originPrefix(item.sourceType)} ${requisitionOriginFolio(item) || "—"}`
                      )
                      .join(" · ")}
                  </p>
                  {selectedItems.length === 1 ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {selected.clientName || "Sin cliente"}
                      </p>
                      {selected.priority === "urgente" || selected.neededBy ? (
                        <p className="text-xs text-muted-foreground">
                          {selected.priority === "urgente" ? (
                            <span className="font-medium text-destructive">Urgente</span>
                          ) : null}
                          {selected.priority === "urgente" && selected.neededBy ? " · " : ""}
                          {selected.neededBy ? `Requerido para ${formatDay(selected.neededBy)}` : ""}
                        </p>
                      ) : null}
                      {selected.deliveryAddress ? (
                        <p className="text-xs text-muted-foreground">
                          Entrega en: {selected.deliveryAddress}
                        </p>
                      ) : null}
                      {selected.notes ? (
                        <p className="text-xs text-muted-foreground">Notas: {selected.notes}</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Se recogen juntas: el mismo código suma en una sola cantidad. Al imprimir sale una hoja por solicitud.
                    </p>
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void onPrint()}>
                  <Printer className="size-3.5" /> Imprimir
                </Button>
              </div>

              {samePersonOpen.length > selectedOpen.length && canFulfill ? (
                <Button type="button" variant="outline" size="sm" onClick={selectAllFromPerson}>
                  Incluir las demás abiertas de {selectedRequester || "esta persona"} (
                  {samePersonOpen.length})
                </Button>
              ) : null}

              {pickGroups.length ? (
                <p className="text-xs text-muted-foreground">
                  {pickGroups.length} código{pickGroups.length === 1 ? "" : "s"} ·{" "}
                  {formatQty(pickPending)} {pickPending === 1 ? "unidad pendiente" : "unidades pendientes"}
                </p>
              ) : null}

              <div className="space-y-2">
                {pickGroups.map((group) => {
                  const openLines = group.sources.filter(
                    (source) =>
                      isRequisitionOpen(source.requisition.status) &&
                      requisitionLinePending(source.line) > 0
                  );
                  const hint = groupSourceHint(group);
                  const inputValue =
                    groupQtyDraft[group.key] ?? formatQty(groupDraftQty(group, qtyDraft));
                  return (
                    <div key={group.key} className="rounded-xl border border-border bg-background p-3">
                      <p className="text-sm font-medium">
                        {group.productSku ? `${group.productSku} · ` : ""}
                        {group.description}
                      </p>
                      {group.offCatalog ? (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          Fuera de catálogo · se compra y se entrega directo, sin descontar inventario
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Pedido: {formatQty(group.quantityRequested)} {group.unit} · Surtido:{" "}
                        {formatQty(group.quantityFulfilled)} · Pendiente: {formatQty(group.pending)}
                      </p>
                      {hint ? <p className="text-xs text-[#3B46A5]">{hint}</p> : null}
                      <p className="text-xs text-muted-foreground">
                        {requisitionLineStatusLabel(group.lineStatus)}
                      </p>
                      {group.pending > 0 && openLines.length > 0 && canFulfill ? (
                        <label className="mt-2 block text-xs">
                          {group.offCatalog ? "Entregando ahora" : "Surtiendo ahora"}
                          <input
                            type="number"
                            min={0}
                            max={group.pending}
                            step="0.01"
                            className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                            value={inputValue}
                            onChange={(e) => {
                              const raw = e.target.value;
                              setGroupQtyDraft((current) => ({ ...current, [group.key]: raw }));
                              const allocated = allocateFulfillmentQty(
                                group.sources.map((source) => source.line),
                                Number(raw)
                              );
                              setQtyDraft((current) => {
                                const next = { ...current };
                                for (const [lineId, qty] of Object.entries(allocated)) {
                                  next[lineId] = formatQty(qty);
                                }
                                return next;
                              });
                            }}
                          />
                        </label>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {selectedPurchases.length ? (
                <div className="space-y-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
                  <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">Compras por faltantes</p>
                  {selectedPurchases.map((purchase) => (
                    <div key={purchase.id} className="text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{purchase.folio}</span>
                        <PurchaseStatusBadge status={purchase.status} />
                      </div>
                      <p className="text-muted-foreground">
                        {purchase.lines.map((line) => `${formatQty(line.quantity)} ${line.unit} ${line.description}`).join(" · ")}
                      </p>
                      {purchase.purchaseOrderNumber ? (
                        <p className="text-muted-foreground">
                          OC {purchase.purchaseOrderNumber} · {purchase.supplierName}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {canFulfill ? (
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Notas de almacén</span>
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={warehouseNotes}
                    onChange={(e) => setWarehouseNotes(e.target.value)}
                  />
                </label>
              ) : selected.warehouseNotes ? (
                <p className="rounded-lg border border-border p-2 text-xs text-muted-foreground">
                  Almacén: {selected.warehouseNotes}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {canFulfillSelection && canFulfill ? (
                  <>
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => void onFulfill()}
                      className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                    >
                      <PackageCheck className="size-4" />{" "}
                      {selectedOpen.length > 1
                        ? `Surtir ${selectedOpen.length} solicitudes`
                        : "Surtir y descontar"}
                    </Button>
                    <Button type="button" variant="outline" disabled={busy} onClick={() => void onRequestPurchase()}>
                      <ShoppingCart className="size-4" /> Solicitar compra de faltantes
                    </Button>
                  </>
                ) : null}
                {selectedItems.length === 1 && selected.status === "solicitada" && canCancel ? (
                  <Button type="button" variant="outline" disabled={busy} onClick={() => void onCancel()}>
                    <XCircle className="size-4" /> Cancelar
                  </Button>
                ) : null}
                {selectedItems.length === 1 && selected.status === "surtida" ? (
                  <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-4" /> Completada
                  </span>
                ) : null}
              </div>
            </>
          )}
        </aside>
      </div>

      {purchaseForm ? (
        <PurchaseRequestForm
          mode="faltantes"
          requisition={purchaseForm.requisition}
          shortages={purchaseForm.shortages}
          onClose={() => setPurchaseForm(null)}
          onCreated={(created) => {
            setPurchaseForm(null);
            setMessage(`Solicitud de compra ${created.folio} enviada a compras por los faltantes de ${created.requisitionFolio}.`);
            setData((current) =>
              current ? { ...current, purchases: [created, ...current.purchases] } : current
            );
          }}
        />
      ) : null}
    </section>
  );
}
