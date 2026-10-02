"use client";

import { useEffect, useState } from "react";
import {
  Ban,
  CheckCircle2,
  ClipboardCheck,
  FileDown,
  Hand,
  PackageCheck,
  Plus,
  Receipt,
  Save,
  ShoppingBag,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { Notice, fieldClass, formatDate, primaryButtonClass, textareaClass } from "@/components/tools/tools-shared";
import {
  PurchaseOrderInvoicesModal,
  formatMoney,
  invoiceSummary,
} from "@/components/warehouse/purchase-order-invoices";
import { usePermissions, useSessionAccess } from "@/lib/auth/use-permissions";
import { downloadPurchaseRequestPdf } from "@/lib/purchasing/pdf";
import {
  closePurchaseRequest,
  createPurchaseOrdersFromRequest,
  markPurchaseRequestReceived,
  savePurchasingNotes,
  takePurchaseRequest,
} from "@/lib/purchasing/storage";
import {
  purchaseRequestOrderIds,
  purchaseRequestUnits,
  purchaseStatusLabel,
  type PurchaseRequest,
  type PurchaseRequestLine,
} from "@/lib/purchasing/types";
import { getSuppliers } from "@/lib/suppliers/storage";
import type { Supplier } from "@/lib/suppliers/types";
import { getPurchaseOrders, purchaseOrderTotal, type PurchaseOrder } from "@/lib/warehouse/orders";
import { PurchasePriorityBadge, PurchaseStatusBadge, formatQty } from "./purchasing-shared";
import { SortableTable } from "@/components/ui/sortable-table";

const CUSTOM_PREFIX = "custom:";

type OrderGroup = {
  value: string;
  supplierId: string | null;
  supplierName: string;
  lines: PurchaseRequestLine[];
  total: number;
};

type Panel = "none" | "orden" | "recibida" | "rechazada" | "cancelada";

export function PurchaseRequestDetail({
  request,
  onClose,
  onChanged,
}: {
  request: PurchaseRequest;
  onClose: () => void;
  onChanged: (request: PurchaseRequest, message: string) => void;
}) {
  const perms = usePermissions("solicitudes_compra");
  const orderPerms = usePermissions("pedidos");
  const { session } = useSessionAccess();
  const actor = session?.fullName || session?.username || "usuario";
  const [panel, setPanel] = useState<Panel>("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [purchasingNotes, setPurchasingNotes] = useState(request.purchasingNotes);
  const [reason, setReason] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [lineSuppliers, setLineSuppliers] = useState<Record<string, string>>({});
  const [customSuppliers, setCustomSuppliers] = useState<string[]>([]);
  const [customName, setCustomName] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [linkedOrders, setLinkedOrders] = useState<PurchaseOrder[]>([]);
  const [invoicesOrderId, setInvoicesOrderId] = useState<string | null>(null);

  const orderIdsKey = purchaseRequestOrderIds(request).join(",");

  useEffect(() => {
    let active = true;
    getSuppliers()
      .then((list) => {
        if (active) setSuppliers(list.filter((item) => item.isActive));
      })
      .catch(() => {
        if (active) setError("No se pudo cargar el catálogo de proveedores; escribe el nombre a mano.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getPurchaseOrders(orderIdsKey ? orderIdsKey.split(",") : [])
      .then((list) => {
        if (active) setLinkedOrders(list);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "No se pudieron cargar las órdenes de compra.");
      });
    return () => {
      active = false;
    };
  }, [orderIdsKey]);

  const status = request.status;
  const pendingLines = request.lines.filter((line) => !line.purchaseOrderId);
  const canTake = perms.canEdit && status === "pendiente";
  const canOrder = perms.canEdit && (status === "pendiente" || status === "en_proceso") && pendingLines.length > 0;
  const canReceive = perms.canEdit && (status === "en_proceso" || status === "ordenada");
  const canClose =
    perms.canDelete &&
    (status === "pendiente" || status === "en_proceso") &&
    request.lines.every((line) => !line.purchaseOrderId);
  const invoicesOrder = linkedOrders.find((order) => order.id === invoicesOrderId) ?? null;

  function supplierNameOf(value: string) {
    if (value.startsWith(CUSTOM_PREFIX)) return value.slice(CUSTOM_PREFIX.length);
    return suppliers.find((item) => item.id === value)?.name ?? "";
  }

  const orderGroups: OrderGroup[] = [];
  for (const line of pendingLines) {
    const value = lineSuppliers[line.id] ?? "";
    if (!value) continue;
    let group = orderGroups.find((item) => item.value === value);
    if (!group) {
      group = {
        value,
        supplierId: value.startsWith(CUSTOM_PREFIX) ? null : value,
        supplierName: supplierNameOf(value),
        lines: [],
        total: 0,
      };
      orderGroups.push(group);
    }
    group.lines.push(line);
    group.total += Math.ceil(line.quantity) * (Number(prices[line.id]) || 0);
  }
  const unassignedCount = pendingLines.length - orderGroups.reduce((sum, group) => sum + group.lines.length, 0);

  function addCustomSupplier() {
    const name = customName.trim();
    if (!name) return;
    const catalog = suppliers.find((item) => item.name.trim().toLowerCase() === name.toLowerCase());
    if (!catalog && !customSuppliers.some((item) => item.toLowerCase() === name.toLowerCase())) {
      setCustomSuppliers((current) => [...current, name]);
    }
    setCustomName("");
  }

  function assignAllPending(value: string) {
    setLineSuppliers((current) => {
      const next = { ...current };
      for (const line of pendingLines) {
        if (value || next[line.id]) next[line.id] = value;
      }
      return next;
    });
  }

  function supplierOptions() {
    return (
      <>
        {suppliers.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
        {customSuppliers.map((name) => (
          <option key={name} value={`${CUSTOM_PREFIX}${name}`}>
            {name} (fuera de catálogo)
          </option>
        ))}
      </>
    );
  }

  async function run(action: () => Promise<PurchaseRequest>, message: string) {
    setBusy(true);
    setError("");
    try {
      const updated = await action();
      setPanel("none");
      setReason("");
      onChanged(updated, message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  }

  function onCreateOrders() {
    const unitPrices: Record<string, number> = {};
    for (const line of pendingLines) unitPrices[line.id] = Number(prices[line.id]) || 0;
    const count = orderGroups.length;
    void run(
      () =>
        createPurchaseOrdersFromRequest(request.id, {
          orders: orderGroups.map((group) => ({
            supplierId: group.supplierId,
            supplierName: group.supplierName,
            lineIds: group.lines.map((line) => line.id),
          })),
          expectedDate,
          notes: orderNotes,
          unitPrices,
          actor,
        }),
      `${count === 1 ? "Orden de compra generada" : `${count} órdenes de compra generadas (una por proveedor)`} para ${request.folio}.${
        unassignedCount ? ` ${unassignedCount} material(es) siguen sin proveedor.` : ""
      } Almacén las verá en Órdenes de compra para recibirlas.`
    );
  }

  async function onPdf() {
    try {
      await downloadPurchaseRequestPdf(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el PDF.");
    }
  }

  return (
    <ModalShell
      title={`Solicitud de compra ${request.folio}`}
      description={`${purchaseStatusLabel(status)} · ${request.lines.length} material(es) · ${formatQty(purchaseRequestUnits(request))} unidades`}
      className="max-w-4xl"
      headerAction={
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
          <X className="size-4" />
        </Button>
      }
    >
      <div className="space-y-4">
        <Notice tone="error">{error}</Notice>

        <div className="flex flex-wrap items-center gap-2">
          <PurchaseStatusBadge status={status} />
          <PurchasePriorityBadge priority={request.priority} />
          <span className="text-xs text-muted-foreground">
            {request.source === "surtimiento" ? `Faltantes de ${request.requisitionFolio || "surtimiento"}` : "Compra directa"}
          </span>
        </div>

        <dl className="grid gap-3 rounded-xl border border-border bg-muted/20 p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Solicita" value={request.requester.name} hint={[request.requester.jobTitle, request.requester.department].filter(Boolean).join(" · ")} />
          <Info label="Fecha" value={formatDate(request.requestedAt, true)} />
          <Info label="Se necesita para" value={request.neededBy ? formatDate(request.neededBy) : "Sin fecha"} />
          <Info label="Orden de servicio" value={request.serviceOrderFolio || "—"} hint={request.clientName} />
          <Info label="Equipo" value={request.equipmentName || "—"} />
          <Info label="Atiende (compras)" value={request.assignedTo || "Sin asignar"} />
          {request.purchaseOrderNumber ? (
            <Info
              label={linkedOrders.length > 1 ? "Órdenes de compra" : "Orden de compra"}
              value={request.purchaseOrderNumber}
              hint={request.supplierName}
            />
          ) : null}
          {request.receivedAt ? <Info label="Recibida" value={formatDate(request.receivedAt, true)} /> : null}
          {request.closedReason ? <Info label="Motivo de cierre" value={request.closedReason} hint={request.closedBy} /> : null}
        </dl>

        {request.justification ? <TextBlock label="Justificación" text={request.justification} /> : null}
        {request.notes ? <TextBlock label="Notas del solicitante" text={request.notes} /> : null}

        <div className="overflow-x-auto rounded-xl border border-border">
          <SortableTable className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Material</th>
                <th className="px-3 py-2 text-center">Cantidad</th>
                <th className="px-3 py-2 text-center">Stock al pedir</th>
                {panel === "orden" || linkedOrders.length ? (
                  <th className="px-3 py-2">{panel === "orden" ? "Proveedor" : "Orden de compra"}</th>
                ) : null}
                {panel === "orden" ? <th className="px-3 py-2">Precio unitario</th> : null}
              </tr>
            </thead>
            <tbody>
              {request.lines.map((line) => {
                const lineOrder = linkedOrders.find((order) => order.id === line.purchaseOrderId);
                return (
                  <tr key={line.id} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium">{line.description || line.productName}</p>
                      <p className="text-xs text-muted-foreground">{line.productSku || "Fuera de catálogo"}</p>
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {formatQty(line.quantity)} {line.unit}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">{line.productId ? formatQty(line.stockAtRequest) : "—"}</td>
                    {panel === "orden" || linkedOrders.length ? (
                      <td className="px-3 py-2">
                        {line.purchaseOrderId ? (
                          <span className="text-xs">
                            <span className="font-medium">{lineOrder?.orderNumber ?? "OC generada"}</span>
                            {lineOrder ? <span className="block text-muted-foreground">{lineOrder.supplierName}</span> : null}
                          </span>
                        ) : panel === "orden" ? (
                          <select
                            className={`${fieldClass} h-9 min-w-44`}
                            value={lineSuppliers[line.id] ?? ""}
                            aria-label={`Proveedor de ${line.description || line.productName}`}
                            onChange={(e) => setLineSuppliers((current) => ({ ...current, [line.id]: e.target.value }))}
                          >
                            <option value="">Sin asignar</option>
                            {supplierOptions()}
                          </select>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin orden</span>
                        )}
                      </td>
                    ) : null}
                    {panel === "orden" ? (
                      <td className="px-3 py-2">
                        {line.purchaseOrderId ? null : (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className={`${fieldClass} h-9 w-28`}
                            value={prices[line.id] ?? ""}
                            placeholder="0.00"
                            aria-label={`Precio unitario de ${line.description || line.productName}`}
                            onChange={(e) => setPrices((current) => ({ ...current, [line.id]: e.target.value }))}
                          />
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </SortableTable>
        </div>

        {panel === "orden" ? (
          <section className="space-y-3 rounded-xl border border-[#3B46A5]/30 bg-[#3B46A5]/5 p-3">
            <div>
              <h4 className="text-sm font-semibold">Generar órdenes de compra por proveedor</h4>
              <p className="text-xs text-muted-foreground">
                Elige el proveedor de cada material en la tabla. Se genera una orden de compra por proveedor; los
                materiales sin asignar quedan pendientes para después.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Asignar todos los pendientes a</span>
                <select className={fieldClass} value="" onChange={(e) => assignAllPending(e.target.value)}>
                  <option value="">Elegir proveedor…</option>
                  {supplierOptions()}
                </select>
              </label>
              <div className="text-sm">
                <label htmlFor="custom-supplier" className="mb-1 block text-muted-foreground">
                  Proveedor fuera de catálogo
                </label>
                <div className="flex gap-2">
                  <input
                    id="custom-supplier"
                    className={fieldClass}
                    value={customName}
                    placeholder="Nombre del proveedor"
                    onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomSupplier();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addCustomSupplier} disabled={!customName.trim()}>
                    <Plus className="size-4" /> Agregar
                  </Button>
                </div>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Fecha estimada de entrega</span>
                <input type="date" className={fieldClass} value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Notas para las órdenes de compra</span>
              <textarea className={textareaClass} value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} />
            </label>
            {orderGroups.length ? (
              <ul className="space-y-1 rounded-lg border border-border bg-background px-3 py-2 text-xs">
                {orderGroups.map((group) => (
                  <li key={group.value} className="flex justify-between gap-3">
                    <span className="truncate">
                      <strong>{group.supplierName}</strong> · {group.lines.length} material(es)
                    </span>
                    <span className="tabular-nums">{formatMoney(group.total)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Las cantidades con decimales se redondean hacia arriba en la orden.
              {unassignedCount ? ` ${unassignedCount} material(es) sin proveedor quedarán pendientes.` : ""}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPanel("none")}>
                Volver
              </Button>
              <Button
                type="button"
                className={primaryButtonClass}
                disabled={busy || orderGroups.length === 0}
                onClick={onCreateOrders}
              >
                <ShoppingBag className="size-4" />{" "}
                {busy
                  ? "Generando…"
                  : orderGroups.length > 1
                    ? `Generar ${orderGroups.length} órdenes de compra`
                    : "Generar orden de compra"}
              </Button>
            </div>
          </section>
        ) : null}

        {linkedOrders.length ? (
          <section>
            <h4 className="mb-2 text-sm font-semibold">Órdenes de compra y facturas</h4>
            <ul className="space-y-2">
              {linkedOrders.map((order) => (
                <li
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {order.orderNumber} · {order.supplierName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="capitalize">{order.status}</span> · Total {formatMoney(purchaseOrderTotal(order))} ·{" "}
                      {invoiceSummary(order)}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => setInvoicesOrderId(order.id)}>
                    <Receipt className="size-4" /> Facturas
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {panel === "recibida" || panel === "rechazada" || panel === "cancelada" ? (
          <section className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
            <h4 className="text-sm font-semibold">
              {panel === "recibida" ? "Marcar como recibida" : panel === "rechazada" ? "Rechazar solicitud" : "Cancelar solicitud"}
            </h4>
            {panel === "recibida" && request.purchaseOrderId ? (
              <p className="text-xs text-muted-foreground">
                Normalmente se cierra sola cuando almacén recibe la orden {request.purchaseOrderNumber}. Úsalo si el
                material llegó por otra vía.
              </p>
            ) : null}
            <textarea
              className={textareaClass}
              placeholder={panel === "recibida" ? "Comentario (opcional)" : "Motivo (obligatorio)"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPanel("none")}>
                Volver
              </Button>
              <Button
                type="button"
                variant={panel === "recibida" ? "default" : "destructive"}
                className={panel === "recibida" ? primaryButtonClass : undefined}
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      panel === "recibida"
                        ? markPurchaseRequestReceived(request.id, actor, reason)
                        : closePurchaseRequest(request.id, panel, actor, reason),
                    `${request.folio} ${panel === "recibida" ? "marcada como recibida" : panel}.`
                  )
                }
              >
                Confirmar
              </Button>
            </div>
          </section>
        ) : null}

        {perms.canEdit && (status === "pendiente" || status === "en_proceso" || status === "ordenada") ? (
          <section className="space-y-2">
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Notas de compras (cotizaciones, tiempos de entrega…)</span>
              <textarea className={textareaClass} value={purchasingNotes} onChange={(e) => setPurchasingNotes(e.target.value)} />
            </label>
            {purchasingNotes.trim() !== request.purchasingNotes.trim() ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void run(() => savePurchasingNotes(request.id, purchasingNotes, actor), "Notas de compras guardadas.")}
              >
                <Save className="size-4" /> Guardar notas
              </Button>
            ) : null}
          </section>
        ) : request.purchasingNotes ? (
          <TextBlock label="Notas de compras" text={request.purchasingNotes} />
        ) : null}

        {request.events.length ? (
          <section>
            <h4 className="mb-2 text-sm font-semibold">Seguimiento</h4>
            <ol className="space-y-2 border-l border-border pl-4">
              {request.events.map((event) => (
                <li key={event.id} className="text-sm">
                  <p>{event.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(event.createdAt, true)} · {event.actor || "—"}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {panel === "none" ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
            {perms.canExport ? (
              <Button type="button" variant="outline" onClick={() => void onPdf()}>
                <FileDown className="size-4" /> PDF
              </Button>
            ) : null}
            {canClose ? (
              <>
                <Button type="button" variant="destructive" onClick={() => setPanel("rechazada")}>
                  <Ban className="size-4" /> Rechazar
                </Button>
                <Button type="button" variant="outline" onClick={() => setPanel("cancelada")}>
                  Cancelar solicitud
                </Button>
              </>
            ) : null}
            {canReceive ? (
              <Button type="button" variant="outline" onClick={() => setPanel("recibida")}>
                <PackageCheck className="size-4" /> Marcar recibida
              </Button>
            ) : null}
            {canTake ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void run(() => takePurchaseRequest(request.id, actor, purchasingNotes), `${request.folio} en proceso.`)}
              >
                <Hand className="size-4" /> Tomar solicitud
              </Button>
            ) : null}
            {canOrder ? (
              <Button type="button" className={primaryButtonClass} onClick={() => setPanel("orden")}>
                <ClipboardCheck className="size-4" />{" "}
                {pendingLines.length < request.lines.length ? "Generar OC de pendientes" : "Generar órdenes de compra"}
              </Button>
            ) : null}
            {status === "recibida" ? (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-4" /> Compra completada
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {invoicesOrder ? (
        <PurchaseOrderInvoicesModal
          order={invoicesOrder}
          canAdd={orderPerms.canWrite}
          canDelete={orderPerms.canDelete}
          supplierRfc={suppliers.find((item) => item.id === invoicesOrder.supplierId)?.rfc}
          actor={actor}
          onClose={() => setInvoicesOrderId(null)}
          onChanged={(invoices) =>
            setLinkedOrders((current) =>
              current.map((order) => (order.id === invoicesOrder.id ? { ...order, invoices } : order))
            )
          }
        />
      ) : null}
    </ModalShell>
  );
}

function Info({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value || "—"}</dd>
      {hint ? <dd className="truncate text-xs text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

function TextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border border-border p-3 text-sm">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap">{text}</p>
    </div>
  );
}
