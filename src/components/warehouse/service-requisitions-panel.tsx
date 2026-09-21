"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, PackageCheck, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { getSession } from "@/lib/auth";
import { usePermissions } from "@/lib/auth/use-permissions";
import {
  cancelServiceOrderRequisition,
  fulfillServiceOrderRequisition,
  getServiceOrderRequisitions,
} from "@/lib/service-orders/requisition-storage";
import {
  REQUISITION_STATUSES,
  requisitionLineStatusLabel,
  requisitionStatusLabel,
  type RequisitionStatus,
  type ServiceOrderRequisition,
} from "@/lib/service-orders/requisitions";
import { cn } from "@/lib/utils";

function statusTone(status: RequisitionStatus) {
  switch (status) {
    case "solicitada":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "parcial":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
    case "surtida":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "cancelada":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function ServiceRequisitionsPanel({
  permissionModule = "solicitudes",
  allowFulfill,
  title = "Solicitudes de órdenes de servicio",
  subtitle = "Surte material pedido por servicio técnico y descuéntalo del inventario.",
}: {
  permissionModule?: "solicitudes" | "ordenes_servicio";
  allowFulfill?: boolean;
  title?: string;
  subtitle?: string;
} = {}) {
  const { canWrite } = usePermissions(permissionModule);
  const canFulfill =
    allowFulfill ?? permissionModule === "solicitudes" ? canWrite : false;
  const [items, setItems] = useState<ServiceOrderRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    RequisitionStatus | "abiertas" | "todas"
  >("abiertas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [warehouseNotes, setWarehouseNotes] = useState("");
  const actor = getSession()?.username ?? "usuario";

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const list = await getServiceOrderRequisitions();
      setItems(list);
      if (selectedId && !list.some((item) => item.id === selectedId)) {
        setSelectedId(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudieron cargar solicitudes."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    if (!selected) {
      setQtyDraft({});
      setWarehouseNotes("");
      return;
    }
    const next: Record<string, string> = {};
    for (const line of selected.lines) {
      const pending = Math.max(
        0,
        line.quantityRequested - line.quantityFulfilled
      );
      next[line.id] = pending > 0 ? String(pending) : "0";
    }
    setQtyDraft(next);
    setWarehouseNotes(selected.warehouseNotes);
  }, [selected?.id, selected?.updatedAt]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === "todas") return true;
      if (statusFilter === "abiertas") {
        return item.status === "solicitada" || item.status === "parcial";
      }
      return item.status === statusFilter;
    });
  }, [items, statusFilter]);

  async function onFulfill() {
    if (!selected || !canWrite) return;
    const fulfillments = selected.lines
      .map((line) => ({
        lineId: line.id,
        quantity: Number(qtyDraft[line.id] || 0),
      }))
      .filter((f) => f.quantity > 0);
    try {
      setError("");
      setMessage("");
      await fulfillServiceOrderRequisition(
        selected.id,
        fulfillments,
        actor,
        warehouseNotes
      );
      setMessage(`Solicitud ${selected.folio} surtida y descontada del inventario.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo surtir.");
    }
  }

  async function onCancel() {
    if (!selected || !canWrite) return;
    if (!window.confirm(`¿Cancelar la solicitud ${selected.folio}?`)) return;
    try {
      setError("");
      await cancelServiceOrderRequisition(selected.id, actor);
      setMessage(`Solicitud ${selected.folio} cancelada.`);
      setSelectedId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar.");
    }
  }

  return (
    <section className="space-y-4">
      {!canWrite ? <ReadOnlyBanner visible /> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#3B46A5]">
            Solicitudes de órdenes de servicio
          </h2>
          <p className="text-sm text-muted-foreground">
            Surte material pedido por servicio técnico y descuéntalo del inventario.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as RequisitionStatus | "abiertas" | "todas"
              )
            }
          >
            <option value="abiertas">Abiertas</option>
            <option value="todas">Todas</option>
            {REQUISITION_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={() => void reload()}>
            <RefreshCw className="size-4" /> Actualizar
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

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Folio</th>
                <th className="px-3 py-3">Orden</th>
                <th className="px-3 py-3">Cliente / equipo</th>
                <th className="px-3 py-3">Estatus</th>
                <th className="px-3 py-3">Líneas</th>
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
                    No hay solicitudes en este filtro.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className={cn(
                      "cursor-pointer border-t border-border align-top hover:bg-muted/30",
                      selectedId === item.id && "bg-muted/40"
                    )}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <td className="px-3 py-3 font-medium">{item.folio}</td>
                    <td className="px-3 py-3">{item.serviceOrderFolio || "—"}</td>
                    <td className="px-3 py-3">
                      <p>{item.clientName || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.equipmentName || "Sin equipo"}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          statusTone(item.status)
                        )}
                      >
                        {requisitionStatusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3">{item.lines.length}</td>
                    <td className="px-3 py-3 text-xs">
                      <p>{item.requestedBy || "—"}</p>
                      <p className="text-muted-foreground">
                        {item.requestedAt
                          ? new Date(item.requestedAt).toLocaleString("es-MX")
                          : "—"}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <aside className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Selecciona una solicitud para surtirla.
            </p>
          ) : (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Solicitud</p>
                <h3 className="text-base font-semibold">{selected.folio}</h3>
                <p className="text-sm text-muted-foreground">
                  {selected.serviceOrderFolio} · {selected.clientName}
                </p>
              </div>

              <div className="space-y-2">
                {selected.lines.map((line) => {
                  const pending = Math.max(
                    0,
                    line.quantityRequested - line.quantityFulfilled
                  );
                  return (
                    <div
                      key={line.id}
                      className="rounded-xl border border-border bg-background p-3"
                    >
                      <p className="text-sm font-medium">
                        {line.productSku ? `${line.productSku} · ` : ""}
                        {line.description}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Pedido: {line.quantityRequested} {line.unit} · Surtido:{" "}
                        {line.quantityFulfilled} · Pendiente: {pending}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {requisitionLineStatusLabel(line.lineStatus)}
                      </p>
                      {pending > 0 &&
                      (selected.status === "solicitada" ||
                        selected.status === "parcial") ? (
                        <label className="mt-2 block text-xs">
                          Surtiendo ahora
                          <input
                            type="number"
                            min={0}
                            max={pending}
                            step="0.01"
                            className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                            value={qtyDraft[line.id] ?? "0"}
                            disabled={!canWrite}
                            onChange={(e) =>
                              setQtyDraft((current) => ({
                                ...current,
                                [line.id]: e.target.value,
                              }))
                            }
                          />
                        </label>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">
                  Notas de almacén
                </span>
                <textarea
                  className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  value={warehouseNotes}
                  disabled={!canWrite}
                  onChange={(e) => setWarehouseNotes(e.target.value)}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                {(selected.status === "solicitada" ||
                  selected.status === "parcial") &&
                canWrite ? (
                      <Button
                    type="button"
                    onClick={() => void onFulfill()}
                    className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                  >
                    <PackageCheck className="size-4" /> Surtir y descontar
                  </Button>
                ) : null}
                {selected.status === "solicitada" && canWrite ? (
                  <Button type="button" variant="outline" onClick={() => void onCancel()}>
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
    </section>
  );
}
