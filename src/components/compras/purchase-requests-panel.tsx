"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
  XCircle,
} from "lucide-react";
import { NewPurchaseRequestForm } from "@/components/compras/new-purchase-request-form";
import { NewOrderForm } from "@/components/warehouse/new-order-form";
import { Button } from "@/components/ui/button";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { getSession } from "@/lib/auth";
import { usePermissions } from "@/lib/auth/use-permissions";
import {
  cancelPurchaseRequest,
  getPurchaseRequests,
  takePurchaseRequest,
  updatePurchaseRequestNotes,
} from "@/lib/compras/storage";
import {
  PURCHASE_REQUEST_STATUSES,
  isOpenPurchaseRequest,
  purchaseRequestReasonLabel,
  purchaseRequestSourceLabel,
  purchaseRequestStatusLabel,
  type PurchaseRequest,
  type PurchaseRequestStatus,
} from "@/lib/compras/types";
import { getInventoryItems } from "@/lib/inventory/storage";
import type { InventoryItem } from "@/lib/inventory/types";
import { getSuppliers } from "@/lib/suppliers/storage";
import type { Supplier } from "@/lib/suppliers/types";
import { cn } from "@/lib/utils";

function statusTone(status: PurchaseRequestStatus) {
  switch (status) {
    case "solicitada":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "en_compra":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
    case "pedida":
      return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300";
    case "parcial":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-300";
    case "recibida":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function PurchaseRequestsPanel({
  mode,
}: {
  mode: "warehouse" | "compras";
}) {
  const warehouseAccess = usePermissions("solicitudes_compra");
  const ordersAccess = usePermissions("pedidos");
  const canCreate = warehouseAccess.canCreate;
  const canManage = warehouseAccess.canEdit && mode === "compras";
  const canCancel = warehouseAccess.canDelete;
  const canWrite =
    mode === "warehouse" ? canCreate || canCancel : warehouseAccess.canWrite;
  const [items, setItems] = useState<PurchaseRequest[]>([]);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    PurchaseRequestStatus | "abiertas" | "todas"
  >("abiertas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [ordering, setOrdering] = useState<PurchaseRequest | null>(null);
  const [comprasNotes, setComprasNotes] = useState("");
  const actor = getSession()?.username ?? "usuario";

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const [list, productList, supplierList] = await Promise.all([
        getPurchaseRequests(),
        getInventoryItems({ kind: "producto" }),
        getSuppliers(),
      ]);
      setItems(list);
      setProducts(productList);
      setSuppliers(supplierList.filter((item) => item.isActive));
      if (selectedId && !list.some((item) => item.id === selectedId)) {
        setSelectedId(null);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las solicitudes de compra."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    setComprasNotes(selected?.comprasNotes ?? "");
  }, [selected?.id, selected?.updatedAt]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === "todas") return true;
      if (statusFilter === "abiertas") return isOpenPurchaseRequest(item.status);
      return item.status === statusFilter;
    });
  }, [items, statusFilter]);

  async function onTake() {
    if (!selected || !canManage) return;
    try {
      setError("");
      const updated = await takePurchaseRequest(selected.id, actor, comprasNotes);
      setMessage(`Solicitud ${updated.folio} tomada en compra.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo tomar.");
    }
  }

  async function onCancelRequest() {
    if (!selected || !canCancel) return;
    if (!window.confirm(`¿Cancelar la solicitud ${selected.folio}?`)) return;
    try {
      setError("");
      await cancelPurchaseRequest(selected.id, actor);
      setMessage(`Solicitud ${selected.folio} cancelada.`);
      setSelectedId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar.");
    }
  }

  async function onSaveNotes() {
    if (!selected || !canManage) return;
    try {
      setError("");
      await updatePurchaseRequestNotes(selected.id, { comprasNotes });
      setMessage("Notas de compras guardadas.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar las notas.");
    }
  }

  if (formOpen && mode === "warehouse") {
    return (
      <NewPurchaseRequestForm
        products={products}
        onCancel={() => setFormOpen(false)}
        onCreated={async () => {
          setFormOpen(false);
          setMessage("Solicitud enviada a Compras.");
          await reload();
        }}
      />
    );
  }

  if (ordering && mode === "compras") {
    return (
      <NewOrderForm
        products={products}
        suppliers={suppliers}
        fromRequestId={ordering.id}
        initialNotes={`Solicitud ${ordering.folio}${
          ordering.sourceFolio ? ` · origen ${ordering.sourceFolio}` : ""
        }`}
        initialLines={ordering.lines.map((line) => ({
          itemId: line.productId ?? line.id,
          itemSku: line.productSku,
          itemName: line.productName,
          unit: line.unit,
          quantity: line.quantityRequested,
          unitPrice:
            products.find((item) => item.id === line.productId)?.unitPrice ?? 0,
        }))}
        heading={`Pedido para ${ordering.folio}`}
        onCancel={() => setOrdering(null)}
        onCreated={async () => {
          setOrdering(null);
          setMessage(`Pedido generado desde ${ordering.folio}.`);
          await reload();
        }}
      />
    );
  }

  return (
    <section className="space-y-4">
      {!canWrite ? <ReadOnlyBanner visible /> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#3B46A5]">
            {mode === "warehouse"
              ? "Solicitudes de compra a Compras"
              : "Bandeja de solicitudes de almacén"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {mode === "warehouse"
              ? "Cuando un producto no se puede surtir, genera la orden para que Compras la atienda y dé seguimiento."
              : "Toma la solicitud, genera el pedido y controla cómo va la compra y el surtimiento."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as PurchaseRequestStatus | "abiertas" | "todas"
              )
            }
          >
            <option value="abiertas">Abiertas</option>
            <option value="todas">Todas</option>
            {PURCHASE_REQUEST_STATUSES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={() => void reload()}>
            <RefreshCw className="size-4" /> Actualizar
          </Button>
          {mode === "warehouse" && canCreate ? (
            <Button
              type="button"
              onClick={() => {
                setError("");
                setFormOpen(true);
              }}
              className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            >
              <ShoppingCart className="size-4" /> Solicitar a compras
            </Button>
          ) : null}
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
                <th className="px-3 py-3">Origen</th>
                <th className="px-3 py-3">Estatus</th>
                <th className="px-3 py-3">Pedido</th>
                <th className="px-3 py-3">Surtimiento</th>
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
                filtered.map((item) => {
                  const requested = item.lines.reduce(
                    (sum, line) => sum + line.quantityRequested,
                    0
                  );
                  const received = item.lines.reduce(
                    (sum, line) => sum + line.quantityReceived,
                    0
                  );
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "cursor-pointer border-t border-border align-top hover:bg-muted/30",
                        selectedId === item.id && "bg-muted/40"
                      )}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <td className="px-3 py-3 font-medium">{item.folio}</td>
                      <td className="px-3 py-3">
                        <p>{purchaseRequestSourceLabel(item.sourceType)}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.sourceFolio || purchaseRequestReasonLabel(item.reason)}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            statusTone(item.status)
                          )}
                        >
                          {purchaseRequestStatusLabel(item.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {item.purchaseOrderNumber || "Sin pedido"}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {received}/{requested}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <p>{item.requestedBy || "—"}</p>
                        <p className="text-muted-foreground">
                          {item.requestedAt
                            ? new Date(item.requestedAt).toLocaleString("es-MX")
                            : "—"}
                        </p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <aside className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Selecciona una solicitud para ver el avance de la compra y el surtimiento.
            </p>
          ) : (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Solicitud</p>
                <h3 className="text-base font-semibold">{selected.folio}</h3>
                <p className="text-sm text-muted-foreground">
                  {purchaseRequestSourceLabel(selected.sourceType)}
                  {selected.sourceFolio ? ` · ${selected.sourceFolio}` : ""}
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                Motivo: {purchaseRequestReasonLabel(selected.reason)}
              </p>

              <div className="space-y-2">
                {selected.lines.map((line) => (
                  <div
                    key={line.id}
                    className="rounded-xl border border-border bg-background p-3"
                  >
                    <p className="text-sm font-medium">
                      {line.productSku ? `${line.productSku} · ` : ""}
                      {line.productName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pedido: {line.quantityRequested} {line.unit} · En OC:{" "}
                      {line.quantityOrdered} · Recibido: {line.quantityReceived}
                    </p>
                  </div>
                ))}
              </div>

              {selected.warehouseNotes ? (
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
                  Almacén: {selected.warehouseNotes}
                </p>
              ) : null}

              {selected.purchaseOrderNumber ? (
                <p className="text-sm">
                  Pedido vinculado:{" "}
                  <Link
                    href="/dashboard/compras?tab=pedidos"
                    className="font-medium text-[#3B46A5] underline-offset-2 hover:underline"
                  >
                    {selected.purchaseOrderNumber}
                  </Link>
                </p>
              ) : null}

              {mode === "compras" ? (
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">
                    Notas de compras
                  </span>
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={comprasNotes}
                    disabled={!canManage}
                    onChange={(event) => setComprasNotes(event.target.value)}
                  />
                </label>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {mode === "compras" &&
                canManage &&
                (selected.status === "solicitada" ||
                  selected.status === "en_compra") ? (
                  <Button type="button" variant="outline" onClick={() => void onTake()}>
                    <ClipboardList className="size-4" /> Tomar en compra
                  </Button>
                ) : null}
                {mode === "compras" &&
                canManage &&
                ordersAccess.canCreate &&
                !selected.purchaseOrderId &&
                selected.status !== "cancelada" &&
                selected.status !== "recibida" ? (
                  <Button
                    type="button"
                    onClick={() => setOrdering(selected)}
                    className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                  >
                    <PackageCheck className="size-4" /> Generar pedido
                  </Button>
                ) : null}
                {mode === "compras" && canManage ? (
                  <Button type="button" variant="outline" onClick={() => void onSaveNotes()}>
                    Guardar notas
                  </Button>
                ) : null}
                {canCancel &&
                selected.status !== "recibida" &&
                selected.status !== "cancelada" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void onCancelRequest()}
                  >
                    <XCircle className="size-4" /> Cancelar
                  </Button>
                ) : null}
                {selected.status === "recibida" ? (
                  <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-4" /> Recibida y lista para surtir
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
