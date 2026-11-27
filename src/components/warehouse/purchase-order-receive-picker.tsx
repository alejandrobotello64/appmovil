"use client";

import { Check, ClipboardList, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { catalogModelLabel } from "@/lib/inventory/product-label";
import {
  purchaseOrderLinePending,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from "@/lib/warehouse/orders";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  borrador: "Borrador",
  enviado: "Por recibir",
  parcial: "Recepción parcial",
};

function formatDay(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

/** Fecha en que se espera la mercancía: cita agendada o fecha esperada del pedido. */
function arrivalDate(order: PurchaseOrder) {
  return order.scheduledReceiveAt || order.expectedDate || "";
}

function orderPending(order: PurchaseOrder) {
  const open = order.items.filter((line) => purchaseOrderLinePending(line) > 0);
  return {
    lines: open.length,
    pieces: open.reduce((sum, line) => sum + purchaseOrderLinePending(line), 0),
  };
}

type PurchaseOrderReceivePickerProps = {
  orders: PurchaseOrder[];
  loading: boolean;
  error: string;
  selectedOrderId: string;
  /** Piezas ya agregadas a la lista de la entrada, por producto. */
  listQtyByProduct: Map<string, number>;
  disabled?: boolean;
  onSelect: (orderId: string) => void;
  onPickLine: (line: PurchaseOrderItem) => void;
  onRefresh: () => void;
};

/**
 * En Entradas con tipo «Recepción de orden de compra»: muestra los pedidos por
 * recibir y, al elegir uno, sus partidas con lo pendiente y lo ya escaneado.
 */
export function PurchaseOrderReceivePicker({
  orders,
  loading,
  error,
  selectedOrderId,
  listQtyByProduct,
  disabled = false,
  onSelect,
  onPickLine,
  onRefresh,
}: PurchaseOrderReceivePickerProps) {
  const sorted = [...orders].sort((a, b) => {
    const dateA = arrivalDate(a);
    const dateB = arrivalDate(b);
    if (dateA && dateB) return dateA.localeCompare(dateB);
    if (dateA) return -1;
    if (dateB) return 1;
    return a.orderNumber.localeCompare(b.orderNumber);
  });
  const selected = orders.find((order) => order.id === selectedOrderId) ?? null;

  return (
    <div className="space-y-3 rounded-xl border border-[#3B46A5]/25 bg-[#3B46A5]/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <ClipboardList className="mt-0.5 size-4 shrink-0 text-[#3B46A5]" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Órdenes de compra por recibir
              {orders.length > 0 ? ` (${orders.length})` : ""}
            </h3>
            <p className="text-xs text-muted-foreground">
              {selected
                ? "Escanea los productos: se asignan a las partidas de esta orden."
                : "Elige la orden que estás recibiendo para ligar la entrada."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onSelect("")}
              className="h-8 gap-1 text-xs"
            >
              <X className="size-3.5" />
              Cambiar orden
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={onRefresh}
            className="h-8 gap-1 text-xs"
          >
            <RefreshCw className={cn("size-3.5", loading ? "animate-spin" : "")} />
            Actualizar
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading && orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Cargando órdenes de compra…</p>
      ) : orders.length === 0 ? (
        error ? null : (
          <p className="rounded-lg border border-dashed border-border bg-background px-3 py-3 text-sm text-muted-foreground">
            No hay órdenes de compra por recibir. Puedes registrar la entrada sin
            ligarla a una orden.
          </p>
        )
      ) : selected ? null : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((order) => {
            const pending = orderPending(order);
            const date = formatDay(arrivalDate(order));
            return (
              <button
                key={order.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(order.id)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:border-[#3B46A5]/60 hover:bg-[#3B46A5]/5 disabled:opacity-60"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-foreground">
                    {order.orderNumber}
                  </span>
                  <span className="rounded-full bg-[#3B46A5]/10 px-2 py-0.5 text-[11px] font-medium text-[#3B46A5]">
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-sm text-foreground">
                  {order.supplierName || "Sin proveedor"}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {pending.lines} partida{pending.lines === 1 ? "" : "s"} pendiente
                  {pending.lines === 1 ? "" : "s"} · {pending.pieces} pza
                  {date
                    ? ` · ${order.scheduledReceiveAt ? "cita" : "esperada"} ${date}`
                    : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selected ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-[#3B46A5]/30 bg-background px-3 py-2">
            <span className="font-mono text-sm font-bold text-foreground">
              {selected.orderNumber}
            </span>
            <span className="text-sm text-foreground">
              {selected.supplierName || "Sin proveedor"}
            </span>
            <span className="text-xs text-muted-foreground">
              {STATUS_LABELS[selected.status] ?? selected.status}
              {formatDay(arrivalDate(selected))
                ? ` · ${selected.scheduledReceiveAt ? "cita" : "esperada"} ${formatDay(arrivalDate(selected))}`
                : ""}
            </span>
          </div>
          <div className="max-h-[22rem] overflow-auto rounded-lg border border-border bg-background">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted/60 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Producto</th>
                  <th className="px-3 py-2 text-right font-medium">Pedido</th>
                  <th className="px-3 py-2 text-right font-medium">Recibido</th>
                  <th className="px-3 py-2 text-right font-medium">Pendiente</th>
                  <th className="px-3 py-2 text-right font-medium">En lista</th>
                  <th className="px-2 py-2 font-medium">
                    <span className="sr-only">Capturar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((line) => {
                  const pending = purchaseOrderLinePending(line);
                  const inList = line.itemId
                    ? listQtyByProduct.get(line.itemId) ?? 0
                    : 0;
                  const complete = pending > 0 && inList === pending;
                  const over = inList > pending;
                  return (
                    <tr
                      key={line.id}
                      className={cn(
                        "border-b border-border last:border-0",
                        complete ? "bg-emerald-500/10" : "",
                        over ? "bg-amber-500/10" : "",
                        pending === 0 && inList === 0 ? "text-muted-foreground" : ""
                      )}
                    >
                      <td className="max-w-[16rem] px-3 py-2 align-middle">
                        <span className="line-clamp-2 font-medium">{line.itemName}</span>
                        <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                          {line.itemSku}
                          {line.itemModel.trim()
                            ? ` · ${catalogModelLabel(line.itemModel)}`
                            : ""}
                          {line.itemId ? "" : " · fuera de catálogo"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right align-middle tabular-nums">
                        {line.quantity}
                      </td>
                      <td className="px-3 py-2 text-right align-middle tabular-nums">
                        {line.receivedQuantity}
                      </td>
                      <td className="px-3 py-2 text-right align-middle font-semibold tabular-nums">
                        {pending}
                      </td>
                      <td className="px-3 py-2 text-right align-middle tabular-nums">
                        <span className="inline-flex items-center justify-end gap-1">
                          {complete ? (
                            <Check className="size-3.5 text-emerald-600" />
                          ) : null}
                          <span className={cn(over ? "font-semibold text-amber-700" : "")}>
                            {inList}
                          </span>
                        </span>
                        {over ? (
                          <span className="block text-[11px] text-amber-700">
                            excede lo pendiente
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-right align-middle">
                        {line.itemId ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={disabled}
                            onClick={() => onPickLine(line)}
                            className="h-8 px-2 text-xs"
                          >
                            Capturar
                          </Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            Recibir en Pedidos
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
