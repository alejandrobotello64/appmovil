"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  DesktopTable,
  ResponsiveDataList,
} from "@/components/ui/responsive-data-list";
import { NewOrderForm } from "@/components/warehouse/new-order-form";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { getSession } from "@/lib/auth";
import { usePermissions } from "@/lib/auth/use-permissions";
import { getInventoryItems } from "@/lib/inventory/storage";
import {
  categoryRequiresManufactureDate,
  type InventoryItem,
} from "@/lib/inventory/types";
import { getSuppliers } from "@/lib/suppliers/storage";
import type { Supplier } from "@/lib/suppliers/types";
import {
  cancelPurchaseOrder,
  getPurchaseOrders,
  receivePurchaseOrderLines,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from "@/lib/warehouse/orders";
import {
  getWarehouseLocations,
  getWarehouses,
  type Warehouse,
  type WarehouseLocation,
} from "@/lib/warehouse/stock";

type ReceiveDraft = {
  lineId: string;
  receiveNow: number;
  lotNumber: string;
  expiryDate: string;
  manufacturedAt: string;
  serialNumber: string;
};

function pendingQty(line: PurchaseOrderItem) {
  return Math.max(line.quantity - line.receivedQuantity, 0);
}

export function OrdersPanel() {
  const { canWrite } = usePermissions("pedidos");
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const [receiveDrafts, setReceiveDrafts] = useState<ReceiveDraft[]>([]);
  const [authorizeOverReceipt, setAuthorizeOverReceipt] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [receivingNow, setReceivingNow] = useState(false);

  async function refresh() {
    const [orderList, productList, supplierList, warehouseList] = await Promise.all([
      getPurchaseOrders(),
      getInventoryItems({ kind: "producto" }),
      getSuppliers(),
      getWarehouses(),
    ]);
    setOrders(orderList);
    setProducts(productList);
    setSuppliers(supplierList.filter((item) => item.isActive));
    setWarehouses(warehouseList);
    const defaultWarehouse =
      warehouseList.find((item) => item.isDefault) ?? warehouseList[0];
    if (defaultWarehouse && !warehouseId) setWarehouseId(defaultWarehouse.id);
  }

  useEffect(() => {
    void refresh()
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Error al cargar pedidos")
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!warehouseId) {
      setLocations([]);
      return;
    }
    void getWarehouseLocations(warehouseId)
      .then((rows) => {
        setLocations(rows);
        setLocationId((current) =>
          rows.some((row) => row.id === current) ? current : rows[0]?.id ?? ""
        );
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "No se pudieron cargar ubicaciones")
      );
  }, [warehouseId]);

  function openReceive(order: PurchaseOrder) {
    setError("");
    setReceiving(order);
    setAuthorizeOverReceipt(false);
    setReceiveDrafts(
      order.items.map((line) => ({
        lineId: line.id,
        receiveNow: pendingQty(line),
        lotNumber: "",
        expiryDate: "",
        manufacturedAt: "",
        serialNumber: "",
      }))
    );
  }

  function updateDraft(lineId: string, patch: Partial<ReceiveDraft>) {
    setReceiveDrafts((current) =>
      current.map((row) => (row.lineId === lineId ? { ...row, ...patch } : row))
    );
  }

  async function handleReceive(event: FormEvent) {
    event.preventDefault();
    if (!receiving) return;
    setReceivingNow(true);
    setError("");
    try {
      const session = getSession();
      if (!session?.username) {
        throw new Error("Inicia sesión para recibir el pedido.");
      }
      await receivePurchaseOrderLines(
        receiving.id,
        receiveDrafts.map((draft) => ({
          lineId: draft.lineId,
          itemId: receiving.items.find((item) => item.id === draft.lineId)?.itemId ?? null,
          receiveNow: draft.receiveNow,
          lotNumber: draft.lotNumber,
          expiryDate: draft.expiryDate,
          manufacturedAt: draft.manufacturedAt,
          serialNumber: draft.serialNumber,
          authorizeOverReceipt,
        })),
        session.username,
        { warehouseId: warehouseId || null, locationId: locationId || null }
      );
      setReceiving(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo recibir");
    } finally {
      setReceivingNow(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando pedidos...</p>;
  }

  function orderActions(order: PurchaseOrder) {
    if (!canWrite || order.status === "recibido" || order.status === "cancelado") {
      return undefined;
    }
    return (
      <>
        <Button size="sm" className="h-9" onClick={() => openReceive(order)}>
          Recibir
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9"
          onClick={() =>
            void cancelPurchaseOrder(order.id)
              .then(refresh)
              .catch((err) =>
                setError(err instanceof Error ? err.message : "No se pudo cancelar")
              )
          }
        >
          Cancelar
        </Button>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <ReadOnlyBanner visible={!canWrite} />
      {!formOpen && error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {formOpen ? (
        <NewOrderForm
          products={products}
          suppliers={suppliers}
          onCancel={() => {
            setFormOpen(false);
            setError("");
          }}
          onCreated={async () => {
            setFormOpen(false);
            setError("");
            await refresh();
          }}
        />
      ) : (
        <>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Pedidos de compra</h2>
            <p className="text-sm text-muted-foreground">
              Solicita productos consumibles y recibe parcial o total contra la OC.
            </p>
          </div>
          {canWrite ? (
            <Button
              onClick={() => {
                setError("");
                setFormOpen(true);
              }}
              className="h-10 border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90"
            >
              Nuevo pedido
            </Button>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <ResponsiveDataList
          emptyMessage="No hay pedidos. Crea el primero para reabastecer insumos o medicamentos."
          items={orders.map((order) => ({
            key: order.id,
            title: order.orderNumber,
            subtitle: order.supplierName,
            badge: (
              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                {order.status}
              </span>
            ),
            fields: [
              { label: "Líneas", value: order.items.length },
              {
                label: "Pendiente",
                value: order.items.reduce((sum, line) => sum + pendingQty(line), 0),
              },
            ],
            actions: orderActions(order),
          }))}
        />

        <DesktopTable>
          <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Pedido</th>
              <th className="px-4 py-3 font-medium">Proveedor</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Pendiente</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No hay pedidos. Crea el primero para reabastecer insumos o medicamentos.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-t border-border/70">
                  <td className="px-4 py-3 font-medium">{order.orderNumber}</td>
                  <td className="px-4 py-3">{order.supplierName}</td>
                  <td className="px-4 py-3 capitalize">{order.status}</td>
                  <td className="px-4 py-3">
                    {order.items.reduce((sum, line) => sum + pendingQty(line), 0)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">{orderActions(order)}</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </DesktopTable>
      </section>
        </>
      )}

      {receiving ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <form
            onSubmit={handleReceive}
            className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
          >
            <div className="border-b border-border px-4 py-4 sm:px-5">
              <h3 className="text-lg font-semibold">Recibir {receiving.orderNumber}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Recibe línea por línea. El pendiente se calcula contra lo ya ingresado.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Almacén destino</span>
                  <select
                    value={warehouseId}
                    onChange={(event) => setWarehouseId(event.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.code} — {warehouse.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Ubicación</span>
                  <select
                    value={locationId}
                    onChange={(event) => setLocationId(event.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.code} — {location.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="min-w-[720px] w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Producto</th>
                      <th className="px-3 py-2 font-medium">Pedido</th>
                      <th className="px-3 py-2 font-medium">Recibido</th>
                      <th className="px-3 py-2 font-medium">Recibir ahora</th>
                      <th className="px-3 py-2 font-medium">Pendiente</th>
                      <th className="px-3 py-2 font-medium">Lote / caducidad / serie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiving.items.map((line) => {
                      const draft = receiveDrafts.find((item) => item.lineId === line.id);
                      const pending = pendingQty(line);
                      const receiveNow = draft?.receiveNow ?? 0;
                      return (
                        <tr key={line.id} className="border-t border-border/70 align-top">
                          <td className="px-3 py-2">
                            <p className="font-medium">{line.itemName}</p>
                            <p className="font-mono text-xs text-muted-foreground">{line.itemSku}</p>
                          </td>
                          <td className="px-3 py-2">{line.quantity}</td>
                          <td className="px-3 py-2">{line.receivedQuantity}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              value={receiveNow}
                              onChange={(event) =>
                                updateDraft(line.id, {
                                  receiveNow: Number(event.target.value),
                                })
                              }
                              className="h-9 w-24 rounded-lg border border-input bg-background px-2 text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">{Math.max(pending - receiveNow, 0)}</td>
                          <td className="px-3 py-2">
                            <div className="grid gap-2 sm:grid-cols-3">
                              <input
                                value={draft?.lotNumber ?? ""}
                                onChange={(event) =>
                                  updateDraft(line.id, { lotNumber: event.target.value })
                                }
                                placeholder="Lote"
                                className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                              />
                              <input
                                type="date"
                                value={
                                  categoryRequiresManufactureDate(
                                    products.find((item) => item.id === line.itemId)
                                      ?.category ?? "insumos"
                                  )
                                    ? (draft?.manufacturedAt ?? "")
                                    : (draft?.expiryDate ?? "")
                                }
                                onChange={(event) =>
                                  categoryRequiresManufactureDate(
                                    products.find((item) => item.id === line.itemId)
                                      ?.category ?? "insumos"
                                  )
                                    ? updateDraft(line.id, {
                                        manufacturedAt: event.target.value,
                                      })
                                    : updateDraft(line.id, {
                                        expiryDate: event.target.value,
                                      })
                                }
                                title={
                                  categoryRequiresManufactureDate(
                                    products.find((item) => item.id === line.itemId)
                                      ?.category ?? "insumos"
                                  )
                                    ? "Fecha de fabricación"
                                    : "Fecha de caducidad"
                                }
                                className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                              />
                              <input
                                value={draft?.serialNumber ?? ""}
                                onChange={(event) =>
                                  updateDraft(line.id, { serialNumber: event.target.value })
                                }
                                placeholder="Serie"
                                className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <label className="mt-4 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={authorizeOverReceipt}
                  onChange={(event) => setAuthorizeOverReceipt(event.target.checked)}
                />
                <span>
                  Autorizar sobre-recibo si la cantidad a recibir supera el pendiente de la OC.
                </span>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReceiving(null)}
                disabled={receivingNow}
              >
                Cerrar
              </Button>
              <Button
                type="submit"
                disabled={receivingNow}
                className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
              >
                {receivingNow ? "Recibiendo..." : "Confirmar recepción"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
