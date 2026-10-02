"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
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
import { usePermissions } from "@/lib/auth/use-permissions";
import { getPurchaseRequests } from "@/lib/purchasing/storage";
import {
  PURCHASE_REQUEST_STATUSES,
  isPurchaseOpen,
  type PurchaseRequest,
  type PurchaseRequestStatus,
} from "@/lib/purchasing/types";
import { cn } from "@/lib/utils";
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
    setItems((current) => {
      if (!current) return [updated];
      return current.some((item) => item.id === updated.id)
        ? current.map((item) => (item.id === updated.id ? updated : item))
        : [updated, ...current];
    });
  }

  return { items, loadedAt, error, setError, refresh, refreshing, replace };
}

function RequestsTable({
  items,
  loading,
  onOpen,
  emptyText,
}: {
  items: PurchaseRequest[];
  loading: boolean;
  onOpen: (id: string) => void;
  emptyText: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <SortableTable className="min-w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
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
              <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                Cargando…
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                {emptyText}
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr
                key={item.id}
                onClick={() => onOpen(item.id)}
                className="cursor-pointer border-t border-border align-top hover:bg-muted/30"
              >
                <td className="px-3 py-3">
                  <p className="font-medium">{item.folio}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(item.requestedAt)}</p>
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
            ))
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
            data.replace(created);
            setFormOpen(false);
            setMessage(`Solicitud de compra ${created.folio} enviada a compras.`);
          }}
        />
      ) : null}
    </>
  );

  return { setOpenId, setFormOpen, message, modals };
}

export function PurchaseRequestsPanel() {
  const perms = usePermissions("solicitudes_compra");
  const searchParams = useSearchParams();
  const data = usePurchaseRequestsData();
  const ui = useDetailAndForm(data);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => normalizeFilter(searchParams.get("estado")));
  const [sourceFilter, setSourceFilter] = useState<"todas" | "surtimiento" | "manual">("todas");
  const [search, setSearch] = useState("");

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

  return (
    <section className="space-y-4">
      {!perms.canWrite ? (
        <ReadOnlyBanner visible message="Tu rol es de consulta: puedes dar seguimiento a las compras, pero no atenderlas." />
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#3B46A5]">Solicitudes de compra</h2>
          <p className="text-sm text-muted-foreground">
            Faltantes que almacén no pudo surtir y compras directas. Genera la orden de compra desde cada solicitud.
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

      <RequestsTable
        items={filtered}
        loading={data.items === null && !data.error}
        onOpen={ui.setOpenId}
        emptyText="No hay solicitudes de compra con estos filtros."
      />
      {ui.modals}
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
