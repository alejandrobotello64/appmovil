"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Hand,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { Notice, StatCard, fieldClass, formatDate, primaryButtonClass } from "@/components/tools/tools-shared";
import { usePermissions, useSessionAccess } from "@/lib/auth/use-permissions";
import { getPurchaseRequests, takePurchaseRequests } from "@/lib/purchasing/storage";
import {
  PURCHASE_REQUEST_STATUSES,
  groupPurchaseRequestLines,
  isPurchaseOpen,
  type PurchaseRequest,
  type PurchaseRequestStatus,
} from "@/lib/purchasing/types";
import { cn } from "@/lib/utils";
import { PurchaseRequestBatch } from "./purchase-request-batch";
import { PurchaseRequestDetail } from "./purchase-request-detail";
import { PurchaseRequestForm } from "./purchase-request-form";
import { PurchasePriorityBadge, PurchaseStatusBadge, formatQty } from "./purchasing-shared";
import { SortableTable } from "@/components/ui/sortable-table";

type StatusFilter = PurchaseRequestStatus | "abiertas" | "todas";

function normalizeFilter(value: string | null): StatusFilter {
  if (value === "todas" || value === "abiertas") return value;
  return PURCHASE_REQUEST_STATUSES.some((item) => item.id === value) ? (value as PurchaseRequestStatus) : "abiertas";
}

/** Urgentes primero, luego por fecha requerida y finalmente las más antiguas. */
function attentionOrder(a: PurchaseRequest, b: PurchaseRequest) {
  if (a.priority !== b.priority) return a.priority === "urgente" ? -1 : 1;
  if (a.neededBy !== b.neededBy) {
    if (!a.neededBy) return 1;
    if (!b.neededBy) return -1;
    return a.neededBy.localeCompare(b.neededBy);
  }
  return a.requestedAt.localeCompare(b.requestedAt);
}

function usePurchaseRequestsData() {
  const [items, setItems] = useState<PurchaseRequest[] | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    getPurchaseRequests()
      .then((list) => {
        if (!active) return;
        setItems(list);
        setLoadedAt(new Date());
        setError("");
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "No se pudieron cargar las solicitudes de compra.");
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  function refresh() {
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  }

  function replace(updated: PurchaseRequest) {
    replaceMany([updated]);
  }

  function replaceMany(updated: PurchaseRequest[]) {
    setItems((current) => {
      if (!current) return updated;
      const byId = new Map(updated.map((item) => [item.id, item]));
      const next = current.map((item) => byId.get(item.id) ?? item);
      const extras = updated.filter((item) => !current.some((row) => row.id === item.id));
      return extras.length ? [...extras, ...next] : next;
    });
  }

  return { items, loadedAt, error, setError, refresh, refreshing, replace, replaceMany };
}

function RequestsTable({
  items,
  loading,
  onOpen,
  emptyText,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  items: PurchaseRequest[];
  loading: boolean;
  onOpen: (id: string) => void;
  emptyText: string;
  selectedIds?: string[];
  onToggle?: (id: string) => void;
  onToggleAll?: (ids: string[], selected: boolean) => void;
}) {
  const selectable = Boolean(onToggle);
  const selectedSet = new Set(selectedIds ?? []);
  const allSelected = items.length > 0 && items.every((item) => selectedSet.has(item.id));
  const colSpan = selectable ? 7 : 6;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <SortableTable className="min-w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            {selectable ? (
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  className="size-4 accent-[#3B46A5]"
                  checked={allSelected}
                  aria-label="Seleccionar todas las solicitudes visibles"
                  onChange={() => onToggleAll?.(items.map((item) => item.id), !allSelected)}
                />
              </th>
            ) : null}
            <th className="px-3 py-3">Folio</th>
            <th className="px-3 py-3">Origen</th>
            <th className="px-3 py-3">Material</th>
            <th className="px-3 py-3">Estatus</th>
            <th className="px-3 py-3">Solicita</th>
            <th className="px-3 py-3">Requerida</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={colSpan} className="px-3 py-6 text-muted-foreground">
                Cargando…
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="px-3 py-6 text-muted-foreground">
                {emptyText}
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const checked = selectedSet.has(item.id);
              return (
                <tr
                  key={item.id}
                  onClick={() => (onToggle ? onToggle(item.id) : onOpen(item.id))}
                  className={cn(
                    "cursor-pointer border-t border-border align-top hover:bg-muted/30",
                    checked && "bg-muted/40"
                  )}
                >
                  {selectable ? (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        className="size-4 accent-[#3B46A5]"
                        checked={checked}
                        aria-label={`Seleccionar ${item.folio}`}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => onToggle?.(item.id)}
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-3">
                    <div className="flex items-start gap-1.5">
                      <div className="min-w-0">
                        <p className="font-medium">{item.folio}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(item.requestedAt)}</p>
                      </div>
                      {selectable ? (
                        <button
                          type="button"
                          title={`Ver ficha de ${item.folio}`}
                          aria-label={`Ver ficha de ${item.folio}`}
                          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpen(item.id);
                          }}
                        >
                          <Eye className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {item.source === "surtimiento" ? (
                      <>
                        <p>{item.requisitionFolio || "Surtimiento"}</p>
                        <p className="text-xs text-muted-foreground">
                          OS {item.serviceOrderFolio || "—"} · {item.clientName || "Sin cliente"}
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Compra directa</p>
                    )}
                  </td>
                  <td className="max-w-72 px-3 py-3">
                    <p className="truncate">{item.lines.map((line) => line.description || line.productName).join(", ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.lines.length} partida(s) · {formatQty(item.lines.reduce((acc, line) => acc + line.quantity, 0))} u.
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <PurchaseStatusBadge status={item.status} />
                      <PurchasePriorityBadge priority={item.priority} />
                    </div>
                    {item.purchaseOrderNumber ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.purchaseOrderNumber} · {item.supplierName}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <p>{item.requester.name || "—"}</p>
                    <p className="text-muted-foreground">{item.requester.department || item.requester.jobTitle}</p>
                  </td>
                  <td className="px-3 py-3 text-xs">{item.neededBy ? formatDate(item.neededBy) : "—"}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </SortableTable>
    </div>
  );
}

function useDetailAndForm(data: ReturnType<typeof usePurchaseRequestsData>) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const openRequest = openId ? data.items?.find((item) => item.id === openId) ?? null : null;

  const modals = (
    <>
      {openRequest ? (
        <PurchaseRequestDetail
          key={`${openRequest.id}-${openRequest.updatedAt}`}
          request={openRequest}
          onClose={() => setOpenId(null)}
          onChanged={(updated, text) => {
            data.replace(updated);
            setMessage(text);
          }}
        />
      ) : null}
      {formOpen ? (
        <PurchaseRequestForm
          mode="manual"
          onClose={() => setFormOpen(false)}
          onCreated={(created) => {
            const request = created[0];
            if (request) data.replace(request);
            setFormOpen(false);
            setMessage(
              created.length > 1
                ? `Se enviaron ${created.length} solicitudes de compra (${created.map((item) => item.folio).join(", ")}).`
                : `Solicitud de compra ${request?.folio ?? ""} enviada a compras.`
            );
          }}
        />
      ) : null}
    </>
  );

  return { setOpenId, setFormOpen, setMessage, message, modals };
}

export function PurchaseRequestsPanel() {
  const perms = usePermissions("solicitudes_compra");
  const { session } = useSessionAccess();
  const actor = session?.fullName || session?.username || "usuario";
  const searchParams = useSearchParams();
  const data = usePurchaseRequestsData();
  const ui = useDetailAndForm(data);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => normalizeFilter(searchParams.get("estado")));
  const [sourceFilter, setSourceFilter] = useState<"todas" | "surtimiento" | "manual">("todas");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data.items ?? [])
      .filter((item) => {
        if (statusFilter === "abiertas" && !isPurchaseOpen(item.status)) return false;
        if (statusFilter !== "abiertas" && statusFilter !== "todas" && item.status !== statusFilter) return false;
        if (sourceFilter !== "todas" && item.source !== sourceFilter) return false;
        if (!term) return true;
        const haystack = [
          item.folio,
          item.requisitionFolio,
          item.serviceOrderFolio,
          item.clientName,
          item.requester.name,
          item.purchaseOrderNumber,
          item.supplierName,
          ...item.lines.map((line) => `${line.productSku} ${line.description}`),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => (statusFilter === "abiertas" ? attentionOrder(a, b) : b.requestedAt.localeCompare(a.requestedAt)));
  }, [data.items, statusFilter, sourceFilter, search]);

  const selectedItems = useMemo(
    () => selectedIds.map((id) => (data.items ?? []).find((item) => item.id === id)).filter(Boolean) as PurchaseRequest[],
    [data.items, selectedIds]
  );
  const productGroups = useMemo(() => groupPurchaseRequestLines(selectedItems), [selectedItems]);
  const pendingGroups = productGroups.filter((group) => group.pendingQuantity > 0);
  const pendientes = selectedItems.filter((item) => item.status === "pendiente");
  const canAttend =
    perms.canEdit &&
    selectedItems.some(
      (item) => item.status === "pendiente" || item.status === "en_proceso" || item.status === "ordenada"
    );

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAll(ids: string[], selected: boolean) {
    setSelectedIds((current) => {
      if (!selected) return current.filter((id) => !ids.includes(id));
      const next = new Set(current);
      for (const id of ids) next.add(id);
      return [...next];
    });
  }

  async function onTakeSelected() {
    if (!pendientes.length || !perms.canEdit) return;
    setBusy(true);
    data.setError("");
    try {
      const updated = await takePurchaseRequests(
        pendientes.map((item) => item.id),
        actor
      );
      data.replaceMany(updated);
      ui.setMessage(
        pendientes.length === 1
          ? `${pendientes[0].folio} en proceso.`
          : `${pendientes.length} solicitudes tomadas juntas (${pendientes.map((item) => item.folio).join(", ")}). Ya puedes generar la orden de compra.`
      );
    } catch (err) {
      data.setError(err instanceof Error ? err.message : "No se pudieron tomar las solicitudes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      {!perms.canWrite ? (
        <ReadOnlyBanner visible message="Tu rol es de consulta: puedes dar seguimiento a las compras, pero no atenderlas." />
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#3B46A5]">Solicitudes de compra</h2>
          <p className="text-sm text-muted-foreground">
            Elige una solicitud y luego otra para tomarlas juntas. El mismo código se suma en una sola cantidad al
            generar la orden, para que almacén reciba el material y pueda surtir.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={data.refresh} disabled={data.refreshing}>
            <RefreshCw className={cn("size-4", data.refreshing && "animate-spin")} /> Actualizar
          </Button>
          {perms.canCreate ? (
            <Button type="button" className={primaryButtonClass} onClick={() => ui.setFormOpen(true)}>
              <Plus className="size-4" /> Nueva solicitud
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={cn(fieldClass, "pl-9")}
            placeholder="Folio, OS, cliente, material, proveedor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={fieldClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="abiertas">Abiertas</option>
          <option value="todas">Todas</option>
          {PURCHASE_REQUEST_STATUSES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          className={fieldClass}
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as "todas" | "surtimiento" | "manual")}
        >
          <option value="todas">Todo origen</option>
          <option value="surtimiento">Faltantes de surtimiento</option>
          <option value="manual">Compras directas</option>
        </select>
      </div>

      <Notice tone="error">{data.error}</Notice>
      <Notice tone="success">{ui.message}</Notice>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <RequestsTable
          items={filtered}
          loading={data.items === null && !data.error}
          onOpen={ui.setOpenId}
          onToggle={toggleSelected}
          onToggleAll={toggleAll}
          selectedIds={selectedIds}
          emptyText="No hay solicitudes de compra con estos filtros."
        />
        <aside className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          {!selectedItems.length ? (
            <p className="text-sm text-muted-foreground">
              {perms.canEdit
                ? "Elige una solicitud y luego otra. El mismo código aparece una sola vez al comprarlas juntas."
                : "Selecciona una solicitud para ver su ficha."}
            </p>
          ) : (
            <>
              <div>
                <p className="text-xs text-muted-foreground">
                  {selectedItems.length > 1 ? `${selectedItems.length} solicitudes` : "Solicitud"}
                </p>
                <h3 className="text-base font-semibold">{selectedItems.map((item) => item.folio).join(" · ")}</h3>
                <p className="text-xs text-muted-foreground">
                  {productGroups.length} código{productGroups.length === 1 ? "" : "s"} ·{" "}
                  {formatQty(productGroups.reduce((sum, group) => sum + group.quantity, 0))} u.
                  {pendingGroups.length
                    ? ` · ${pendingGroups.length} pendiente${pendingGroups.length === 1 ? "" : "s"} de OC`
                    : ""}
                </p>
              </div>
              <ul className="space-y-2">
                {productGroups.slice(0, 8).map((group) => (
                  <li key={group.key} className="rounded-xl border border-border bg-background px-3 py-2">
                    <p className="text-sm font-medium">
                      {group.productSku ? `${group.productSku} · ` : ""}
                      {group.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatQty(group.quantity)} {group.unit}
                      {group.sources.length > 1
                        ? ` · ${group.sources.length} solicitudes`
                        : ` · ${group.sources[0]?.request.folio}`}
                    </p>
                  </li>
                ))}
              </ul>
              {productGroups.length > 8 ? (
                <p className="text-xs text-muted-foreground">+{productGroups.length - 8} código(s) más</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {perms.canEdit && pendientes.length > 0 ? (
                  <Button type="button" className={primaryButtonClass} disabled={busy} onClick={() => void onTakeSelected()}>
                    <Hand className="size-4" />{" "}
                    {pendientes.length > 1 ? `Tomar ${pendientes.length} solicitudes` : "Tomar solicitud"}
                  </Button>
                ) : null}
                {canAttend ? (
                  <Button type="button" variant={pendientes.length ? "outline" : "default"} className={pendientes.length ? undefined : primaryButtonClass} onClick={() => setBatchOpen(true)}>
                    <ShoppingBag className="size-4" /> Generar órdenes
                  </Button>
                ) : null}
                {selectedItems.length === 1 ? (
                  <Button type="button" variant="outline" onClick={() => ui.setOpenId(selectedItems[0].id)}>
                    <Eye className="size-4" /> Ver ficha
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={() => setSelectedIds([])}>
                  Limpiar
                </Button>
              </div>
              {pendientes.length > 0 && pendientes.length < selectedItems.length ? (
                <p className="text-xs text-muted-foreground">
                  {pendientes.length} pendiente{pendientes.length === 1 ? "" : "s"} se pueden tomar ahora; el resto ya
                  está en proceso o ordenada.
                </p>
              ) : null}
            </>
          )}
        </aside>
      </div>
      {ui.modals}
      {batchOpen && selectedItems.length ? (
        <PurchaseRequestBatch
          key={selectedItems.map((item) => item.id).join("|")}
          requests={selectedItems}
          onClose={() => setBatchOpen(false)}
          onChanged={(updated, text) => {
            data.replaceMany(updated);
            ui.setMessage(text);
          }}
        />
      ) : null}
    </section>
  );
}

export function PurchasingDashboard() {
  const perms = usePermissions("solicitudes_compra");
  const data = usePurchaseRequestsData();
  const ui = useDetailAndForm(data);
  const items = useMemo(() => data.items ?? [], [data.items]);
  const monthKey = data.loadedAt
    ? `${data.loadedAt.getFullYear()}-${String(data.loadedAt.getMonth() + 1).padStart(2, "0")}`
    : "";

  const stats = useMemo(() => {
    const open = items.filter((item) => isPurchaseOpen(item.status));
    return {
      pending: items.filter((item) => item.status === "pendiente").length,
      inProcess: items.filter((item) => item.status === "en_proceso").length,
      ordered: items.filter((item) => item.status === "ordenada").length,
      urgent: open.filter((item) => item.priority === "urgente").length,
      fromRequisitions: open.filter((item) => item.source === "surtimiento").length,
      receivedMonth: monthKey ? items.filter((item) => item.status === "recibida" && item.receivedAt.startsWith(monthKey)).length : 0,
      attention: open.filter((item) => item.status !== "ordenada").sort(attentionOrder).slice(0, 8),
      inTransit: items.filter((item) => item.status === "ordenada").sort((a, b) => a.orderedAt.localeCompare(b.orderedAt)).slice(0, 6),
    };
  }, [items, monthKey]);

  const loading = data.items === null && !data.error;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#3B46A5]">Panorama de compras</h2>
          <p className="text-sm text-muted-foreground">Lo que falta comprar, lo que está en camino y lo que urge.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={data.refresh} disabled={data.refreshing}>
            <RefreshCw className={cn("size-4", data.refreshing && "animate-spin")} /> Actualizar
          </Button>
          {perms.canCreate ? (
            <Button type="button" className={primaryButtonClass} onClick={() => ui.setFormOpen(true)}>
              <Plus className="size-4" /> Nueva solicitud
            </Button>
          ) : null}
        </div>
      </div>

      <Notice tone="error">{data.error}</Notice>
      <Notice tone="success">{ui.message}</Notice>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatLink href="/dashboard/compras?tab=solicitudes&estado=pendiente">
          <StatCard icon={Clock} label="Pendientes" value={loading ? "…" : stats.pending} tone={stats.pending ? "warning" : "default"} />
        </StatLink>
        <StatLink href="/dashboard/compras?tab=solicitudes&estado=en_proceso">
          <StatCard icon={Hand} label="En proceso" value={loading ? "…" : stats.inProcess} />
        </StatLink>
        <StatLink href="/dashboard/compras?tab=solicitudes&estado=ordenada">
          <StatCard icon={Truck} label="Ordenadas (en camino)" value={loading ? "…" : stats.ordered} />
        </StatLink>
        <StatLink href="/dashboard/compras?tab=solicitudes&estado=abiertas">
          <StatCard icon={AlertTriangle} label="Urgentes abiertas" value={loading ? "…" : stats.urgent} tone={stats.urgent ? "danger" : "default"} />
        </StatLink>
        <StatLink href="/dashboard/compras?tab=solicitudes&estado=abiertas">
          <StatCard icon={ShoppingBag} label="Por faltantes de OS" value={loading ? "…" : stats.fromRequisitions} />
        </StatLink>
        <StatLink href="/dashboard/compras?tab=solicitudes&estado=recibida">
          <StatCard icon={CheckCircle2} label="Recibidas este mes" value={loading ? "…" : stats.receivedMonth} />
        </StatLink>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Por atender</h3>
        <RequestsTable
          items={stats.attention}
          loading={loading}
          onOpen={ui.setOpenId}
          emptyText="No hay solicitudes pendientes de atender."
        />
      </div>

      {stats.inTransit.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Material en camino</h3>
          <RequestsTable items={stats.inTransit} loading={false} onOpen={ui.setOpenId} emptyText="" />
        </div>
      ) : null}
      {ui.modals}
    </section>
  );
}

function StatLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="block rounded-2xl transition-opacity hover:opacity-85">
      {children}
    </Link>
  );
}
