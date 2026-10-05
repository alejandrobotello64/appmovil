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
import { downloadRequisitionPdf } from "@/lib/service-orders/requisition-pdf";
import {
  cancelServiceOrderRequisition,
  fulfillServiceOrderRequisition,
  getServiceOrderRequisitions,
} from "@/lib/service-orders/requisition-storage";
import {
  REQUISITION_SOURCES,
  REQUISITION_STATUSES,
  isOffCatalogLine,
  isRequisitionOpen,
  requisitionLinePending,
  requisitionLineStatusLabel,
  requisitionOriginFolio,
  requisitionProgress,
  requisitionSourceLabel,
  requisitionStatusLabel,
  type RequisitionSource,
  type RequisitionStatus,
  type ServiceOrderRequisition,
} from "@/lib/service-orders/requisitions";
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
  subtitle = "Surte material pedido por servicio técnico y ventas, descuéntalo del inventario y pide a compras lo que falte.",
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
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequisitionStatus | "abiertas" | "todas">("abiertas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
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
    ])
      .then(([requisitions, purchases]) => {
        if (!active) return;
        setData({ requisitions, purchases });
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
  const selected = items.find((item) => item.id === selectedId) ?? null;

  const purchasesByRequisition = useMemo(() => {
    const map = new Map<string, PurchaseRequest[]>();
    for (const purchase of data?.purchases ?? []) {
      if (!purchase.requisitionId) continue;
      map.set(purchase.requisitionId, [...(map.get(purchase.requisitionId) ?? []), purchase]);
    }
    return map;
  }, [data]);
  const selectedPurchases = selected ? purchasesByRequisition.get(selected.id) ?? [] : [];

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
          ])
        );
      }),
    [items, statusFilter, query, activeSource]
  );

  function selectRequisition(requisition: ServiceOrderRequisition) {
    const draft = initialDraft(requisition);
    setSelectedId(requisition.id);
    setQtyDraft(draft.qty);
    setWarehouseNotes(draft.notes);
  }

  async function reloadKeepingSelection(text: string) {
    setMessage(text);
    const [requisitions, purchases] = await Promise.all([
      getServiceOrderRequisitions({ sourceType: source }),
      getPurchaseRequests().catch(() => data?.purchases ?? []),
    ]);
    setData({ requisitions, purchases });
    const updated = requisitions.find((item) => item.id === selectedId);
    if (updated) selectRequisition(updated);
    else setSelectedId(null);
  }

  async function onFulfill() {
    if (!selected || !canFulfill) return;
    const fulfillments = selected.lines
      .map((line) => ({ lineId: line.id, quantity: Number(qtyDraft[line.id] || 0) }))
      .filter((f) => f.quantity > 0);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fulfillServiceOrderRequisition(selected.id, fulfillments, actor, warehouseNotes);
      await reloadKeepingSelection(
        `Solicitud ${selected.folio} surtida y descontada del inventario. Puedes imprimir la orden de surtimiento.`
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
    if (!selected) return;
    setError("");
    try {
      await downloadRequisitionPdf(selected, {
        printedBy: session ? { username: session.username, fullName: session.fullName } : undefined,
        printedByWarehouse: canFulfill,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el PDF.");
    }
  }

  async function onRequestPurchase() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const shortages = await getRequisitionShortages(selected, selectedPurchases);
      if (!shortages.length) {
        setError("Esta solicitud ya no tiene material pendiente de surtir.");
        return;
      }
      setPurchaseForm({ requisition: selected, shortages });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo calcular el faltante.");
    } finally {
      setBusy(false);
    }
  }

  const selectedOpen = selected ? isRequisitionOpen(selected.status) : false;
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
                  <td className="px-3 py-6 text-muted-foreground" colSpan={6}>
                    Cargando…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-muted-foreground" colSpan={6}>
                    {query.trim()
                      ? "Ninguna solicitud coincide con la búsqueda."
                      : "No hay solicitudes en este filtro."}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const openPurchases = (purchasesByRequisition.get(item.id) ?? []).filter((p) => isPurchaseOpen(p.status));
                  const progress = requisitionProgress(item);
                  const detail =
                    item.sourceType === "cotizacion"
                      ? item.deliveryAddress || "Venta"
                      : item.equipmentName || "Sin equipo";
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "cursor-pointer border-t border-border align-top hover:bg-muted/30",
                        selectedId === item.id && "bg-muted/40"
                      )}
                      onClick={() => selectRequisition(item)}
                    >
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
                })
              )}
            </tbody>
          </SortableTable>
        </div>

        <aside className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              {canFulfill
                ? "Selecciona una solicitud para surtirla, imprimirla o pedir a compras lo que falte."
                : "Selecciona una solicitud para ver su avance o imprimirla."}
            </p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Solicitud</p>
                  <h3 className="text-base font-semibold">{selected.folio}</h3>
                  <p className="text-sm text-muted-foreground">
                    {originPrefix(selected.sourceType)} {requisitionOriginFolio(selected) || "—"} · {selected.clientName || "Sin cliente"}
                  </p>
                  {selected.priority === "urgente" || selected.neededBy ? (
                    <p className="text-xs text-muted-foreground">
                      {selected.priority === "urgente" ? <span className="font-medium text-destructive">Urgente</span> : null}
                      {selected.priority === "urgente" && selected.neededBy ? " · " : ""}
                      {selected.neededBy ? `Requerido para ${formatDay(selected.neededBy)}` : ""}
                    </p>
                  ) : null}
                  {selected.deliveryAddress ? (
                    <p className="text-xs text-muted-foreground">Entrega en: {selected.deliveryAddress}</p>
                  ) : null}
                  {selected.notes ? (
                    <p className="text-xs text-muted-foreground">Notas: {selected.notes}</p>
                  ) : null}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void onPrint()}>
                  <Printer className="size-3.5" /> Imprimir
                </Button>
              </div>

              <div className="space-y-2">
                {selected.lines.map((line) => {
                  const pending = requisitionLinePending(line);
                  const offCatalog = isOffCatalogLine(line);
                  return (
                    <div key={line.id} className="rounded-xl border border-border bg-background p-3">
                      <p className="text-sm font-medium">
                        {line.productSku ? `${line.productSku} · ` : ""}
                        {line.description}
                      </p>
                      {offCatalog ? (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          Fuera de catálogo · se compra y se entrega directo, sin descontar inventario
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Pedido: {formatQty(line.quantityRequested)} {line.unit} · Surtido: {formatQty(line.quantityFulfilled)} ·
                        Pendiente: {formatQty(pending)}
                      </p>
                      <p className="text-xs text-muted-foreground">{requisitionLineStatusLabel(line.lineStatus)}</p>
                      {pending > 0 && selectedOpen && canFulfill ? (
                        <label className="mt-2 block text-xs">
                          {offCatalog ? "Entregando ahora" : "Surtiendo ahora"}
                          <input
                            type="number"
                            min={0}
                            max={pending}
                            step="0.01"
                            className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                            value={qtyDraft[line.id] ?? "0"}
                            onChange={(e) => setQtyDraft((current) => ({ ...current, [line.id]: e.target.value }))}
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
                {selectedOpen && canFulfill ? (
                  <>
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => void onFulfill()}
                      className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                    >
                      <PackageCheck className="size-4" /> Surtir y descontar
                    </Button>
                    <Button type="button" variant="outline" disabled={busy} onClick={() => void onRequestPurchase()}>
                      <ShoppingCart className="size-4" /> Solicitar compra de faltantes
                    </Button>
                  </>
                ) : null}
                {selected.status === "solicitada" && canCancel ? (
                  <Button type="button" variant="outline" disabled={busy} onClick={() => void onCancel()}>
                    <XCircle className="size-4" /> Cancelar
                  </Button>
                ) : null}
                {selected.status === "surtida" ? (
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
