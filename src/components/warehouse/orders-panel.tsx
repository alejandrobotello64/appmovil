"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  DesktopTable,
  ResponsiveDataList,
} from "@/components/ui/responsive-data-list";
import { getSession } from "@/lib/auth";
import { getInventoryItems } from "@/lib/inventory/storage";
import type { InventoryItem } from "@/lib/inventory/types";
import { getSuppliers } from "@/lib/suppliers/storage";
import type { Supplier } from "@/lib/suppliers/types";
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  getPurchaseOrders,
  receivePurchaseOrder,
  type PurchaseOrder,
} from "@/lib/warehouse/orders";

export function OrdersPanel() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<
    Array<{
      itemId: string;
      itemSku: string;
      itemName: string;
      quantity: number;
      unitPrice: number;
    }>
  >([]);

  async function refresh() {
    const [orderList, productList, supplierList] = await Promise.all([
      getPurchaseOrders(),
      getInventoryItems({ kind: "producto" }),
      getSuppliers(),
    ]);
    setOrders(orderList);
    setProducts(productList);
    setSuppliers(supplierList.filter((item) => item.isActive));
    if (productList[0]) setProductId(productList[0].id);
    if (supplierList[0]) setSupplierId(supplierList[0].id);
  }

  useEffect(() => {
    void refresh()
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Error al cargar pedidos")
      )
      .finally(() => setLoading(false));
  }, []);

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === productId) ?? null,
    [products, productId]
  );

  function addLine() {
    if (!selectedProduct) return;
    setLines((current) => [
      ...current,
      {
        itemId: selectedProduct.id,
        itemSku: selectedProduct.sku,
        itemName: selectedProduct.name,
        quantity,
        unitPrice: selectedProduct.unitPrice,
      },
    ]);
    setQuantity(1);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const supplier = suppliers.find((item) => item.id === supplierId);
      const session = getSession();
      await createPurchaseOrder({
        supplierId: supplier?.id ?? null,
        supplierName: supplier?.name ?? "Sin proveedor",
        expectedDate,
        notes,
        createdBy: session?.username ?? "",
        items: lines,
      });
      setFormOpen(false);
      setLines([]);
      setNotes("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el pedido");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando pedidos...</p>;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Pedidos de compra</h2>
            <p className="text-sm text-muted-foreground">
              Solicita productos consumibles a proveedores y recibe el stock.
            </p>
          </div>
          <Button
            onClick={() => setFormOpen(true)}
            className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90"
          >
            Nuevo pedido
          </Button>
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
            fields: [{ label: "Líneas", value: order.items.length }],
            actions:
              order.status !== "recibido" && order.status !== "cancelado" ? (
                <>
                  <Button
                    size="sm"
                    className="h-9"
                    onClick={() =>
                      void receivePurchaseOrder(order.id)
                        .then(refresh)
                        .catch((err) =>
                          setError(
                            err instanceof Error
                              ? err.message
                              : "No se pudo recibir"
                          )
                        )
                    }
                  >
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
                          setError(
                            err instanceof Error
                              ? err.message
                              : "No se pudo cancelar"
                          )
                        )
                    }
                  >
                    Cancelar
                  </Button>
                </>
              ) : undefined,
          }))}
        />

        <DesktopTable>
          <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Pedido</th>
              <th className="px-4 py-3 font-medium">Proveedor</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Líneas</th>
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
                  <td className="px-4 py-3">{order.items.length}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {order.status !== "recibido" &&
                      order.status !== "cancelado" ? (
                        <Button
                          size="sm"
                          onClick={() =>
                            void receivePurchaseOrder(order.id)
                              .then(refresh)
                              .catch((err) =>
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "No se pudo recibir"
                                )
                              )
                          }
                        >
                          Recibir
                        </Button>
                      ) : null}
                      {order.status !== "recibido" &&
                      order.status !== "cancelado" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void cancelPurchaseOrder(order.id)
                              .then(refresh)
                              .catch((err) =>
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "No se pudo cancelar"
                                )
                              )
                          }
                        >
                          Cancelar
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </DesktopTable>
      </section>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={handleCreate}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl"
          >
            <h3 className="text-lg font-semibold">Nuevo pedido</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Solo productos consumibles (insumos, medicamentos, etc.).
            </p>

            <div className="mt-4 grid gap-3">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Proveedor</span>
                <select
                  required
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
                <select
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} — {product.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                />
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={addLine}>
                  Agregar
                </Button>
              </div>

              <ul className="space-y-2">
                {lines.map((line, index) => (
                  <li
                    key={`${line.itemId}-${index}`}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    {line.itemName} · {line.quantity} pzas
                  </li>
                ))}
              </ul>

              <label className="space-y-1.5">
                <span className="text-sm font-medium">Fecha esperada</span>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(event) => setExpectedDate(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Notas</span>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
              >
                Crear pedido
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
