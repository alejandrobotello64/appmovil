"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, PackageCheck, Printer, RefreshCw, ShoppingCart, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PurchaseRequestForm } from "@/components/purchasing/purchase-request-form";
import { PurchaseStatusBadge, formatQty } from "@/components/purchasing/purchasing-shared";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { usePermissions, useSessionAccess } from "@/lib/auth/use-permissions";
import { getProductsAvailableQty } from "@/lib/holds/storage";
import { getPurchaseRequests, getRequisitionShortages } from "@/lib/purchasing/storage";
import { isPurchaseOpen, type PurchaseRequest, type RequisitionShortage } from "@/lib/purchasing/types";
import {
  cancelServiceOrderRequisition,
  fulfillServiceOrderRequisitions,
  getServiceOrderRequisitions,
} from "@/lib/service-orders/requisition-storage";
import {
  downloadRequisitionPickListPdf,
  downloadRequisitionsPdf,
} from "@/lib/service-orders/requisition-pdf";
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

function fulfillCap(
  group: GroupedRequisitionLine,
  stock: Map<string, number> | null
) {
  if (group.offCatalog || !group.productId || !stock) return group.pending;
  return Math.min(group.pending, Math.max(0, stock.get(group.productId) ?? 0));
}

function availableTone(pending: number, available: number) {
  if (available <= 0) return "text-rose-700 dark:text-rose-300";
  if (available + 0.0001 < pending) return "text-amber-700 dark:text-amber-300";
  return "text-emerald-700 dark:text-emerald-300";
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
  subtitle = "Elige una solicitud y luego otra para surtirlas juntas. El mismo código suma en una sola cantidad y verás cuánto hay disponible en almacén. Imprime la suma para verificar productos, o cada orden por su folio.",
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
  const [printBusy, setPrintBusy] = useState<"folios" | "suma" | "">("");
  const [availableByProduct, setAvailableByProduct] = useState<Map<string, number> | null>(null);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState<{
    jobs: { requisition: ServiceOrderRequisition; shortages: RequisitionShortage[] }[];
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
  const pickProductIds = useMemo(
    () =>
      [...new Set(pickGroups.map((group) => group.productId).filter((id): id is string => Boolean(id)))],
    [pickGroups]
  );
  const pickStockKey = pickProductIds.join("|");

  useEffect(() => {
    let active = true;
    if (!pickProductIds.length) {
      setAvailableByProduct(new Map());
      setAvailableLoading(false);
      return;
    }
    setAvailableLoading(true);
    setAvailableByProduct(null);
    getProductsAvailableQty(pickProductIds)
      .then((map) => {
        if (!active) return;
        setAvailableByProduct(map);
        setQtyDraft((current) => {
          const next = { ...current };
          let changed = false;
          for (const group of pickGroups) {
            if (!group.productId || group.offCatalog || group.pending <= 0) continue;
            const cap = Math.min(group.pending, Math.max(0, map.get(group.productId) ?? 0));
            const currentQty = group.sources.reduce(
              (sum, source) => sum + Number(current[source.line.id] || 0),
              0
            );
            if (currentQty <= cap + 0.0001) continue;
            const allocated = allocateFulfillmentQty(
              group.sources.map((source) => source.line),
              cap
            );
            for (const [lineId, qty] of Object.entries(allocated)) {
              const value = formatQty(qty);
              if (next[lineId] !== value) {
                next[lineId] = value;
                changed = true;
              }
            }
          }
          return changed ? next : current;
        });
        setGroupQtyDraft((currentGroups) => {
          const nextGroups = { ...currentGroups };
          let changed = false;
          for (const group of pickGroups) {
            if (!group.productId || group.offCatalog || group.pending <= 0) continue;
            const cap = Math.min(group.pending, Math.max(0, map.get(group.productId) ?? 0));
            const raw = currentGroups[group.key];
            const parsed = raw != null && raw.trim() !== "" ? Number(raw) : group.pending;
            if (!Number.isFinite(parsed) || parsed <= cap + 0.0001) continue;
            nextGroups[group.key] = formatQty(cap);
            changed = true;
          }
          return changed ? nextGroups : currentGroups;
        });
      })
      .catch(() => {
        if (!active) return;
        const empty = new Map<string, number>();
        for (const id of pickProductIds) empty.set(id, 0);
        setAvailableByProduct(empty);
      })
      .finally(() => {
        if (active) setAvailableLoading(false);
      });
    return () => {
      active = false;
    };
    // pickGroups se alinea con la selección y los códigos cargados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickStockKey, selectedIds, reloadKey]);

  const pickAvailableUnits = pickGroups.reduce((sum, group) => {
    if (group.offCatalog || !group.productId) return sum;
    const available = availableByProduct?.get(group.productId);
    if (available == null) return sum;
    return sum + Math.min(group.pending, Math.max(0, available));
  }, 0);
  const pickShortageCount = pickGroups.filter((group) => {
    if (group.offCatalog || !group.productId || group.pending <= 0) return false;
    const available = availableByProduct?.get(group.productId);
    return available != null && available + 0.0001 < group.pending;
  }).length;

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
              line.partNumber,
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

  function applySelection(next: ServiceOrderRequisition[], added?: ServiceOrderRequisition) {
    setError("");
    setSelectedIds(next.map((item) => item.id));
    if (added && next.length > 1) mergeDrafts([added], false);
    else mergeDrafts(next, true);
  }

  function selectPersonGroup(person: string, extra?: ServiceOrderRequisition) {
    const group = openFromPerson(person);
    const chosen = group.length ? group : extra ? [extra] : [];
    if (!chosen.length) return;
    applySelection(chosen);
  }

  function selectRequisition(requisition: ServiceOrderRequisition) {
    const already = selectedIds.includes(requisition.id);
    if (already) {
      applySelection(selectedItems.filter((item) => item.id !== requisition.id));
      return;
    }
    if (!isRequisitionOpen(requisition.status)) {
      applySelection([requisition]);
      return;
    }
    const openSelection = selectedItems.filter((item) => isRequisitionOpen(item.status));
    if (
      openSelection.length > 0 &&
      sameRequester(requisition.requestedBy, openSelection[0].requestedBy, staff)
    ) {
      applySelection([...openSelection, requisition], requisition);
      return;
    }
    applySelection([requisition]);
  }

  function selectAllFromPerson() {
    if (!samePersonOpen.length) return;
    applySelection(samePersonOpen);
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

  function printOptions() {
    return {
      printedBy: session
        ? { username: session.username, fullName: session.fullName }
        : undefined,
      printedByWarehouse: canFulfill,
    };
  }

  function pickQuantities(items: ServiceOrderRequisition[]) {
    const groups = groupRequisitionLines(items);
    const quantities: Record<string, number> = {};
    for (const group of groups) {
      const drafted = groupQtyDraft[group.key];
      const qty =
        drafted != null && drafted.trim() !== ""
          ? Number(drafted)
          : groupDraftQty(group, qtyDraft);
      quantities[group.key] =
        Number.isFinite(qty) && qty > 0 ? qty : group.pending;
    }
    return quantities;
  }

  async function onPrintFolios(items = selectedItems) {
    if (!items.length) return;
    setError("");
    setPrintBusy("folios");
    try {
      await downloadRequisitionsPdf(items, printOptions());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo imprimir por folio.");
    } finally {
      setPrintBusy("");
    }
  }

  async function onPrintSum(items = selectedItems) {
    if (!items.length) return;
    setError("");
    setPrintBusy("suma");
    try {
      await downloadRequisitionPickListPdf(items, {
        ...printOptions(),
        quantities: pickQuantities(items),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo imprimir la suma de productos."
      );
    } finally {
      setPrintBusy("");
    }
  }

  async function onRequestPurchase() {
    if (!selectedOpen.length) return;
    setBusy(true);
    setError("");
    try {
      const jobs = [];
      for (const target of selectedOpen) {
        const shortages = await getRequisitionShortages(
          target,
          purchasesByRequisition.get(target.id) ?? []
        );
        if (shortages.length) jobs.push({ requisition: target, shortages });
      }
      if (!jobs.length) {
        setError("Las solicitudes elegidas ya no tienen material pendiente de surtir.");
        return;
      }
      setPurchaseForm({ jobs });
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
                                applySelection(selectedItems.filter((item) => !drop.has(item.id)));
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
                      onClick={() => selectRequisition(item)}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          className="size-4 accent-[#3B46A5]"
                          checked={checked}
                          aria-label={`Seleccionar ${item.folio}`}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => selectRequisition(item)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-start gap-1.5">
                          <div className="min-w-0">
                            <p className="font-medium">{item.folio}</p>
                            {item.priority === "urgente" ? (
                              <span className="mt-1 inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                                Urgente
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            title={`Imprimir ${item.folio}`}
                            aria-label={`Imprimir ${item.folio}`}
                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={(event) => {
                              event.stopPropagation();
                              void onPrintFolios([item]);
                            }}
                          >
                            <Printer className="size-3.5" />
                          </button>
                        </div>
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
                ? "Elige una solicitud y luego otra de la misma persona. El mismo código aparece una sola vez. El visto del grupo marca todas las de esa persona."
                : "Selecciona una solicitud para ver su avance o imprimirla por folio."}
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
                      Se recogen juntas: el mismo código suma en una sola cantidad. La suma es solo para verificar; cada folio se imprime aparte.
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={Boolean(printBusy)}
                    onClick={() => void onPrintSum()}
                  >
                    {printBusy === "suma" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Printer className="size-3.5" />
                    )}
                    Imprimir suma
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={Boolean(printBusy)}
                    onClick={() => void onPrintFolios()}
                  >
                    {printBusy === "folios" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Printer className="size-3.5" />
                    )}
                    {selectedItems.length > 1
                      ? `Imprimir ${selectedItems.length} folios`
                      : "Imprimir folio"}
                  </Button>
                </div>
              </div>

              {samePersonOpen.length > selectedOpen.length && canFulfill ? (
                <Button type="button" variant="outline" size="sm" onClick={selectAllFromPerson}>
                  Incluir las demás abiertas de {selectedRequester || "esta persona"} (
                  {samePersonOpen.length})
                </Button>
              ) : null}

              {pickGroups.length ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {pickGroups.length} código{pickGroups.length === 1 ? "" : "s"} ·{" "}
                    {formatQty(pickPending)} {pickPending === 1 ? "unidad pendiente" : "unidades pendientes"}
                    {availableByProduct && pickProductIds.length ? (
                      <>
                        {" "}
                        · {formatQty(pickAvailableUnits)}{" "}
                        {pickAvailableUnits === 1
                          ? "unidad disponible para surtir"
                          : "unidades disponibles para surtir"}
                      </>
                    ) : null}
                  </p>
                  {pickShortageCount > 0 ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {pickShortageCount === 1
                        ? "1 código no tiene existencia suficiente; la cantidad a surtir se ajustó al stock disponible."
                        : `${pickShortageCount} códigos no tienen existencia suficiente; la cantidad a surtir se ajustó al stock disponible.`}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2">
                {pickGroups.map((group) => {
                  const openLines = group.sources.filter(
                    (source) =>
                      isRequisitionOpen(source.requisition.status) &&
                      requisitionLinePending(source.line) > 0
                  );
                  const hint = groupSourceHint(group);
                  const cap = fulfillCap(group, availableByProduct);
                  const available = group.productId
                    ? availableByProduct?.get(group.productId)
                    : undefined;
                  const drafted = Number(
                    groupQtyDraft[group.key] ?? formatQty(groupDraftQty(group, qtyDraft))
                  );
                  const inputValue =
                    groupQtyDraft[group.key] ?? formatQty(groupDraftQty(group, qtyDraft));
                  const overStock =
                    !group.offCatalog &&
                    available != null &&
                    Number.isFinite(drafted) &&
                    drafted > available + 0.0001;
                  return (
                    <div key={group.key} className="rounded-xl border border-border bg-background p-3">
                      <p className="text-sm font-medium">
                        {group.productSku ? `${group.productSku} · ` : ""}
                        {group.description}
                      </p>
                      {group.partNumber.trim() ? (
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                          N.º de parte {group.partNumber.trim()}
                        </p>
                      ) : null}
                      {group.offCatalog ? (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          Fuera de catálogo · se compra y se entrega directo, sin descontar inventario
                        </p>
                      ) : (
                        <p
                          className={cn(
                            "mt-1 text-sm font-semibold tabular-nums",
                            availableLoading || available == null
                              ? "text-muted-foreground"
                              : availableTone(group.pending, available)
                          )}
                        >
                          {availableLoading || available == null
                            ? "Consultando existencia…"
                            : `Disponible para surtir: ${formatQty(available)} ${group.unit}`}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Pedido: {formatQty(group.quantityRequested)} {group.unit} · Surtido:{" "}
                        {formatQty(group.quantityFulfilled)} · Pendiente: {formatQty(group.pending)}
                      </p>
                      {!group.offCatalog &&
                      available != null &&
                      group.pending > 0 &&
                      available + 0.0001 < group.pending ? (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          {available <= 0
                            ? "Sin existencia: no se puede surtir este código hasta que entre mercancía o se libere un apartado."
                            : `Stock insuficiente: se pueden surtir ${formatQty(available)} de ${formatQty(group.pending)} ${group.unit}.`}
                        </p>
                      ) : null}
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
                            max={cap}
                            step="0.01"
                            className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                            value={inputValue}
                            onChange={(e) => {
                              let raw = e.target.value;
                              const parsed = Number(raw);
                              if (raw !== "" && Number.isFinite(parsed) && parsed > cap) {
                                raw = formatQty(cap);
                              }
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
                          {overStock ? (
                            <span className="mt-1 block text-[11px] text-rose-700 dark:text-rose-300">
                              Máximo disponible: {formatQty(cap)} {group.unit}
                            </span>
                          ) : null}
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
                        {purchase.lines
                          .map((line) => {
                            const part = (
                              line.requisitionLineId
                                ? selectedItems
                                    .flatMap((item) => item.lines)
                                    .find((reqLine) => reqLine.id === line.requisitionLineId)?.partNumber
                                : ""
                            )?.trim();
                            return `${formatQty(line.quantity)} ${line.unit}${part ? ` · n.º ${part}` : ""} ${line.description}`;
                          })
                          .join(" · ")}
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
                    {error ? (
                      <p className="w-full rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        {error}
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      disabled={busy || availableLoading}
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
          jobs={purchaseForm.jobs}
          onClose={() => setPurchaseForm(null)}
          onCreated={(created) => {
            setPurchaseForm(null);
            const folios = created.map((item) => item.folio).join(", ");
            const origins = [...new Set(created.map((item) => item.requisitionFolio).filter(Boolean))];
            setMessage(
              created.length === 1
                ? `Solicitud de compra ${folios} enviada a compras por los faltantes de ${origins[0] || "la solicitud"}.`
                : `Se enviaron ${created.length} solicitudes de compra (${folios}) por los faltantes.`
            );
            setData((current) =>
              current ? { ...current, purchases: [...created, ...current.purchases] } : current
            );
          }}
        />
      ) : null}
    </section>
  );
}
