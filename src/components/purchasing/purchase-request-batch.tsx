"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Hand, PackageCheck, Plus, Printer, ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { Notice, fieldClass, formatDate, primaryButtonClass, textareaClass } from "@/components/tools/tools-shared";
import { formatMoney } from "@/components/warehouse/purchase-order-invoices";
import { usePermissions, useSessionAccess } from "@/lib/auth/use-permissions";
import {
  downloadPurchaseRequestPickListPdf,
  downloadPurchaseRequestsPdf,
} from "@/lib/purchasing/pdf";
import {
  createPurchaseOrdersFromRequests,
  markPurchaseRequestsReceived,
  takePurchaseRequests,
} from "@/lib/purchasing/storage";
import {
  groupPurchaseRequestLines,
  type GroupedPurchaseLine,
  type PurchaseRequest,
} from "@/lib/purchasing/types";
import { getSuppliers } from "@/lib/suppliers/storage";
import type { Supplier } from "@/lib/suppliers/types";
import { PurchasePriorityBadge, PurchaseStatusBadge, formatQty, orderBuyQty } from "./purchasing-shared";
import { SortableTable } from "@/components/ui/sortable-table";

const CUSTOM_PREFIX = "custom:";

type OrderGroup = {
  value: string;
  supplierId: string | null;
  supplierName: string;
  groups: GroupedPurchaseLine[];
  lineIds: string[];
  total: number;
};

type Panel = "none" | "orden" | "recibida";

function pendingSources(group: GroupedPurchaseLine) {
  return group.sources.filter((source) => !source.line.purchaseOrderId);
}

function groupHint(group: GroupedPurchaseLine) {
  const byFolio = new Map<string, number>();
  for (const source of group.sources) {
    byFolio.set(source.request.folio, (byFolio.get(source.request.folio) ?? 0) + source.line.quantity);
  }
  return [...byFolio.entries()]
    .map(([folio, qty]) => `${formatQty(qty)} en ${folio}`)
    .join(" · ");
}

export function PurchaseRequestBatch({
  requests,
  onClose,
  onChanged,
}: {
  requests: PurchaseRequest[];
  onClose: () => void;
  onChanged: (updated: PurchaseRequest[], message: string) => void;
}) {
  const perms = usePermissions("solicitudes_compra");
  const { session } = useSessionAccess();
  const actor = session?.fullName || session?.username || "usuario";
  const [panel, setPanel] = useState<Panel>("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [groupSuppliers, setGroupSuppliers] = useState<Record<string, string>>({});
  const [customSuppliers, setCustomSuppliers] = useState<string[]>([]);
  const [customName, setCustomName] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [buyQty, setBuyQty] = useState<Record<string, string>>({});

  const productGroups = useMemo(() => groupPurchaseRequestLines(requests), [requests]);
  const pendingGroups = productGroups.filter((group) => group.pendingQuantity > 0);
  const pendientes = requests.filter((item) => item.status === "pendiente");
  const canTake = perms.canEdit && pendientes.length > 0;
  const canOrder =
    perms.canEdit &&
    pendingGroups.length > 0 &&
    requests.some((item) => item.status === "pendiente" || item.status === "en_proceso");
  const canReceive =
    perms.canEdit && requests.some((item) => item.status === "en_proceso" || item.status === "ordenada");
  const totalUnits = productGroups.reduce((sum, group) => sum + group.quantity, 0);
  const urgent = requests.some((item) => item.priority === "urgente");

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

  function supplierNameOf(value: string) {
    if (value.startsWith(CUSTOM_PREFIX)) return value.slice(CUSTOM_PREFIX.length);
    return suppliers.find((item) => item.id === value)?.name ?? "";
  }

  const orderGroups: OrderGroup[] = [];
  for (const group of pendingGroups) {
    const value = groupSuppliers[group.key] ?? "";
    if (!value) continue;
    let bucket = orderGroups.find((item) => item.value === value);
    if (!bucket) {
      bucket = {
        value,
        supplierId: value.startsWith(CUSTOM_PREFIX) ? null : value,
        supplierName: supplierNameOf(value),
        groups: [],
        lineIds: [],
        total: 0,
      };
      orderGroups.push(bucket);
    }
    const pending = pendingSources(group);
    bucket.groups.push(group);
    bucket.lineIds.push(...pending.map((source) => source.line.id));
    bucket.total +=
      Math.ceil(orderBuyQty(group.pendingQuantity, buyQty[group.key])) * (Number(prices[group.key]) || 0);
  }
  const unassignedCount = pendingGroups.filter((group) => !groupSuppliers[group.key]).length;

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
    setGroupSuppliers((current) => {
      const next = { ...current };
      for (const group of pendingGroups) {
        if (value || next[group.key]) next[group.key] = value;
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

  async function run(action: () => Promise<PurchaseRequest[]>, message: string) {
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

  async function onPrint(kind: "suma" | "folios") {
    setBusy(true);
    setError("");
    try {
      if (kind === "suma") await downloadPurchaseRequestPickListPdf(requests);
      else await downloadPurchaseRequestsPdf(requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo imprimir.");
    } finally {
      setBusy(false);
    }
  }

  function onTake() {
    void run(
      () => takePurchaseRequests(
        pendientes.map((item) => item.id),
        actor
      ),
      pendientes.length === 1
        ? `${pendientes[0].folio} en proceso.`
        : `${pendientes.length} solicitudes tomadas juntas (${pendientes.map((item) => item.folio).join(", ")}).`
    );
  }

  function onCreateOrders() {
    const unitPrices: Record<string, number> = {};
    const buyQuantities: Record<string, number> = {};
    let extraCount = 0;
    for (const group of pendingGroups) {
      const price = Number(prices[group.key]) || 0;
      const pending = pendingSources(group);
      const requested = pending.reduce((sum, source) => sum + source.line.quantity, 0);
      const buy = Math.max(requested, orderBuyQty(requested, buyQty[group.key]));
      const extra = buy - requested;
      if (extra > 0.0001) extraCount += 1;
      pending.forEach((source, index) => {
        unitPrices[source.line.id] = price;
        buyQuantities[source.line.id] = source.line.quantity + (index === 0 ? extra : 0);
      });
    }
    const count = orderGroups.length;
    const folios = requests.map((item) => item.folio).join(", ");
    void run(
      () =>
        createPurchaseOrdersFromRequests(
          requests.map((item) => item.id),
          {
            orders: orderGroups.map((group) => ({
              supplierId: group.supplierId,
              supplierName: group.supplierName,
              lineIds: group.lineIds,
            })),
            expectedDate,
            notes: orderNotes,
            unitPrices,
            buyQuantities,
            actor,
          }
        ),
      `${count === 1 ? "Orden de compra generada" : `${count} órdenes de compra generadas (una por proveedor)`} para ${folios}.${
        extraCount ? ` ${extraCount} código(s) van con cantidad extra para almacén.` : ""
      }${unassignedCount ? ` ${unassignedCount} código(s) siguen sin proveedor.` : ""} Almacén las verá en Órdenes de compra para recibirlas y luego surtir.`
    );
  }

  function onReceive() {
    const eligible = requests.filter((item) => item.status === "en_proceso" || item.status === "ordenada");
    void run(
      () =>
        markPurchaseRequestsReceived(
          eligible.map((item) => item.id),
          actor,
          reason
        ),
      eligible.length === 1
        ? `${eligible[0].folio} marcada como recibida.`
        : `${eligible.length} solicitudes marcadas como recibidas.`
    );
  }

  return (
    <ModalShell
      title={
        requests.length === 1
          ? `Solicitud de compra ${requests[0].folio}`
          : `${requests.length} solicitudes de compra`
      }
      description={`${productGroups.length} código(s) · ${formatQty(totalUnits)} unidades · ${requests
        .map((item) => item.folio)
        .join(" · ")}`}
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
          {urgent ? <PurchasePriorityBadge priority="urgente" /> : null}
          {requests.map((item) => (
            <span key={item.id} className="inline-flex items-center gap-1.5 text-xs">
              <span className="font-medium">{item.folio}</span>
              <PurchaseStatusBadge status={item.status} />
            </span>
          ))}
        </div>

        <ul className="grid gap-2 rounded-xl border border-border bg-muted/20 p-3 text-sm sm:grid-cols-2">
          {requests.map((item) => (
            <li key={item.id} className="min-w-0">
              <p className="truncate font-medium">
                {item.folio}
                {item.source === "surtimiento" ? ` · ${item.requisitionFolio || "Surtimiento"}` : ""}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {item.serviceOrderFolio ? `OS ${item.serviceOrderFolio} · ` : ""}
                {item.clientName || item.requester.name || "Sin cliente"}
                {item.neededBy ? ` · para ${formatDate(item.neededBy)}` : ""}
              </p>
            </li>
          ))}
        </ul>

        <div className="overflow-x-auto rounded-xl border border-border">
          <SortableTable className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Material</th>
                <th className="px-3 py-2 text-center">Solicitado</th>
                {panel === "orden" ? <th className="px-3 py-2 text-center">A comprar</th> : null}
                {panel === "orden" ? <th className="px-3 py-2">Proveedor</th> : null}
                {panel === "orden" ? <th className="px-3 py-2">Precio unitario</th> : null}
              </tr>
            </thead>
            <tbody>
              {productGroups.map((group) => {
                const pending = pendingSources(group);
                return (
                  <tr key={group.key} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium">{group.description}</p>
                      <p className="text-xs text-muted-foreground">{group.productSku || "Fuera de catálogo"}</p>
                      {group.sources.length > 1 ? (
                        <p className="text-xs text-[#3B46A5]">{groupHint(group)}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">{group.sources[0]?.request.folio}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {formatQty(group.quantity)} {group.unit}
                      {group.pendingQuantity < group.quantity ? (
                        <p className="text-xs text-muted-foreground">
                          {formatQty(group.pendingQuantity)} sin OC
                        </p>
                      ) : null}
                    </td>
                    {panel === "orden" ? (
                      <td className="px-3 py-2 text-center">
                        {pending.length ? (
                          <>
                            <input
                              type="number"
                              min={group.pendingQuantity}
                              step="1"
                              className={`${fieldClass} mx-auto h-9 w-24 text-center`}
                              value={buyQty[group.key] ?? formatQty(group.pendingQuantity)}
                              aria-label={`Cantidad a comprar de ${group.description}`}
                              onChange={(e) => setBuyQty((current) => ({ ...current, [group.key]: e.target.value }))}
                              onBlur={(e) => {
                                const next = orderBuyQty(group.pendingQuantity, e.target.value);
                                setBuyQty((current) => ({
                                  ...current,
                                  [group.key]: formatQty(Math.max(group.pendingQuantity, next)),
                                }));
                              }}
                            />
                            {orderBuyQty(group.pendingQuantity, buyQty[group.key]) >
                            group.pendingQuantity + 0.0001 ? (
                              <p className="mt-1 text-[11px] text-[#3B46A5]">
                                +{formatQty(orderBuyQty(group.pendingQuantity, buyQty[group.key]) - group.pendingQuantity)} extra
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <span className="tabular-nums text-xs text-muted-foreground">{formatQty(group.quantity)}</span>
                        )}
                      </td>
                    ) : null}
                    {panel === "orden" ? (
                      <td className="px-3 py-2">
                        {pending.length ? (
                          <select
                            className={`${fieldClass} h-9 min-w-44`}
                            value={groupSuppliers[group.key] ?? ""}
                            aria-label={`Proveedor de ${group.description}`}
                            onChange={(e) =>
                              setGroupSuppliers((current) => ({ ...current, [group.key]: e.target.value }))
                            }
                          >
                            <option value="">Sin asignar</option>
                            {supplierOptions()}
                          </select>
                        ) : (
                          <span className="text-xs text-muted-foreground">Ya tiene orden</span>
                        )}
                      </td>
                    ) : null}
                    {panel === "orden" ? (
                      <td className="px-3 py-2">
                        {pending.length ? (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className={`${fieldClass} h-9 w-28`}
                            value={prices[group.key] ?? ""}
                            placeholder="0.00"
                            aria-label={`Precio unitario de ${group.description}`}
                            onChange={(e) => setPrices((current) => ({ ...current, [group.key]: e.target.value }))}
                          />
                        ) : null}
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
                El mismo código de todas las solicitudes se junta en una sola partida. En A comprar puedes subir la
                cantidad para dejar extra en almacén. Se genera una orden por proveedor.
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
                <label htmlFor="batch-custom-supplier" className="mb-1 block text-muted-foreground">
                  Proveedor fuera de catálogo
                </label>
                <div className="flex gap-2">
                  <input
                    id="batch-custom-supplier"
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
                      <strong>{group.supplierName}</strong> · {group.groups.length} código(s)
                    </span>
                    <span className="tabular-nums">{formatMoney(group.total)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Las cantidades se redondean hacia arriba. Lo extra entra a existencia cuando almacén reciba la orden.
              {unassignedCount ? ` ${unassignedCount} código(s) sin proveedor quedarán pendientes.` : ""}
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

        {panel === "recibida" ? (
          <section className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
            <h4 className="text-sm font-semibold">Marcar como recibidas</h4>
            <p className="text-xs text-muted-foreground">
              Úsalo si el material ya llegó por otra vía. Lo normal es que se cierren solas cuando almacén recibe las
              órdenes de compra.
            </p>
            <textarea
              className={textareaClass}
              placeholder="Comentario (opcional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPanel("none")}>
                Volver
              </Button>
              <Button type="button" className={primaryButtonClass} disabled={busy} onClick={onReceive}>
                Confirmar
              </Button>
            </div>
          </section>
        ) : null}

        {panel === "none" ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void onPrint("suma")}>
              <Printer className="size-4" /> Imprimir suma
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void onPrint("folios")}>
              <Printer className="size-4" />{" "}
              {requests.length > 1 ? `Imprimir ${requests.length} folios` : "Imprimir folio"}
            </Button>
            {canReceive ? (
              <Button type="button" variant="outline" onClick={() => setPanel("recibida")}>
                <PackageCheck className="size-4" /> Marcar recibidas
              </Button>
            ) : null}
            {canTake ? (
              <Button type="button" variant="outline" disabled={busy} onClick={onTake}>
                <Hand className="size-4" />{" "}
                {pendientes.length > 1 ? `Tomar ${pendientes.length} solicitudes` : "Tomar solicitud"}
              </Button>
            ) : null}
            {canOrder ? (
              <Button type="button" className={primaryButtonClass} onClick={() => setPanel("orden")}>
                <ClipboardCheck className="size-4" /> Generar órdenes de compra
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}
