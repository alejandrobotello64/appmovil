"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarClock, Loader2, Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { SearchInput } from "@/components/ui/search-input";
import { matchesSearch } from "@/lib/search";
import {
  DesktopTable,
  ResponsiveDataList,
} from "@/components/ui/responsive-data-list";
import { NewOrderForm } from "@/components/warehouse/new-order-form";
import {
  PurchaseOrderInvoicesModal,
  formatMoney,
  invoiceSummary,
} from "@/components/warehouse/purchase-order-invoices";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { usePermissions } from "@/lib/auth/use-permissions";
import { catalogModelLabel } from "@/lib/inventory/product-label";
import { getInventoryItems } from "@/lib/inventory/storage";
import { type InventoryItem } from "@/lib/inventory/types";
import { getSuppliers } from "@/lib/suppliers/storage";
import type { Supplier } from "@/lib/suppliers/types";
import {
  cancelPurchaseOrder,
  getPurchaseOrders,
  purchaseOrderTotal,
  receivePurchaseOrderLines,
  schedulePurchaseOrderReceive,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from "@/lib/warehouse/orders";
import { downloadPurchaseOrderReceivePdf } from "@/lib/warehouse/orders-pdf";
import {
  getWarehouseLocations,
  getWarehouses,
  type Warehouse,
  type WarehouseLocation,
} from "@/lib/warehouse/stock";
import { SortableTable } from "@/components/ui/sortable-table";

type ReceiveDraft = {
  id: string;
  lineId: string;
  receiveNow: number;
  lotNumber: string;
  expiryDate: string;
  manufacturedAt: string;
  serialNumber: string;
};

function emptyLot(lineId: string, receiveNow = 0): ReceiveDraft {
  return {
    id: crypto.randomUUID(),
    lineId,
    receiveNow,
    lotNumber: "",
    expiryDate: "",
    manufacturedAt: "",
    serialNumber: "",
  };
}

function pendingQty(line: PurchaseOrderItem) {
  return Math.max(line.quantity - line.receivedQuantity, 0);
}

function supplierKey(order: PurchaseOrder) {
  return order.supplierId ?? `name:${order.supplierName.trim().toLowerCase()}`;
}

function invoicedTotal(order: PurchaseOrder) {
  return order.invoices.reduce((sum, invoice) => sum + invoice.total, 0);
}

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatReceiveAppointment(order: PurchaseOrder) {
  if (!order.scheduledReceiveAt) return "";
  const [year, month, day] = order.scheduledReceiveAt.split("-");
  const dateLabel = year && month && day ? `${day}/${month}/${year}` : order.scheduledReceiveAt;
  return order.scheduledReceiveTime ? `${dateLabel} ${order.scheduledReceiveTime}` : dateLabel;
}

export function OrdersPanel() {
  const { canWrite, canDelete } = usePermissions("pedidos");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [groupBySupplier, setGroupBySupplier] = useState(false);
  const [invoicesOrderId, setInvoicesOrderId] = useState<string | null>(null);
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
  const [query, setQuery] = useState("");
  const supplierOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const order of orders) {
      if (!byKey.has(supplierKey(order))) {
        byKey.set(supplierKey(order), order.supplierName || "Sin proveedor");
      }
    }
    return [...byKey.entries()]
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [orders]);
  const visibleOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          (!supplierFilter || supplierKey(order) === supplierFilter) &&
          matchesSearch(query, [
            order.orderNumber,
            order.supplierName,
            order.status,
            order.notes,
            order.createdBy,
            ...order.items.flatMap((line) => [line.itemSku, line.itemName]),
            ...order.invoices.flatMap((invoice) => [
              invoice.invoiceNumber,
              invoice.cfdiUuid,
              invoice.issuerRfc,
            ]),
          ])
      ),
    [orders, query, supplierFilter]
  );
  const supplierGroups = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; orders: PurchaseOrder[] }>();
    for (const order of visibleOrders) {
      const key = supplierKey(order);
      const group = groups.get(key) ?? {
        key,
        name: order.supplierName || "Sin proveedor",
        orders: [],
      };
      group.orders.push(order);
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [visibleOrders]);
  const emptyOrdersMessage =
    query.trim() || supplierFilter
      ? "Ningún pedido coincide con la búsqueda."
      : "No hay pedidos. Crea el primero para reabastecer insumos o medicamentos.";
  const invoicesOrder = orders.find((order) => order.id === invoicesOrderId) ?? null;
  const [authorizeOverReceipt, setAuthorizeOverReceipt] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [receivingNow, setReceivingNow] = useState(false);
  const [scheduling, setScheduling] = useState<PurchaseOrder | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");
  const [schedulingNow, setSchedulingNow] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);

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
    setReceiveDrafts(order.items.map((line) => emptyLot(line.id, pendingQty(line))));
  }

  function openSchedule(order: PurchaseOrder) {
    setError("");
    setScheduling(order);
    setScheduleDate(order.scheduledReceiveAt || order.expectedDate || todayKey());
    setScheduleTime(order.scheduledReceiveTime);
    setScheduleNote(order.scheduledReceiveNote);
  }

  async function handleSchedule(event: FormEvent) {
    event.preventDefault();
    if (!scheduling) return;
    setSchedulingNow(true);
    setError("");
    try {
      await schedulePurchaseOrderReceive(scheduling.id, {
        date: scheduleDate,
        time: scheduleTime,
        note: scheduleNote,
      });
      setScheduling(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agendar la recepción");
    } finally {
      setSchedulingNow(false);
    }
  }

  async function handlePrint(order: PurchaseOrder) {
    setPrintingId(order.id);
    setError("");
    try {
      await downloadPurchaseOrderReceivePdf(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo imprimir la recepción");
    } finally {
      setPrintingId(null);
    }
  }

  async function handleClearSchedule() {
    if (!scheduling) return;
    setSchedulingNow(true);
    setError("");
    try {
      await schedulePurchaseOrderReceive(scheduling.id, null);
      setScheduling(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar la cita");
    } finally {
      setSchedulingNow(false);
    }
  }

  function updateDraft(id: string, patch: Partial<ReceiveDraft>) {
    setReceiveDrafts((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addLot(lineId: string) {
    if (!receiving) return;
    const line = receiving.items.find((item) => item.id === lineId);
    if (!line) return;
    const used = receiveDrafts
      .filter((row) => row.lineId === lineId)
      .reduce((sum, row) => sum + row.receiveNow, 0);
    const remaining = Math.max(pendingQty(line) - used, 0);
    setReceiveDrafts((current) => [...current, emptyLot(lineId, remaining)]);
  }

  function removeLot(id: string) {
    setReceiveDrafts((current) => {
      const target = current.find((row) => row.id === id);
      if (!target) return current;
      const sameLine = current.filter((row) => row.lineId === target.lineId);
      if (sameLine.length <= 1) return current;
      return current.filter((row) => row.id !== id);
    });
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
    const open = canWrite && order.status !== "recibido" && order.status !== "cancelado";
    return (
      <>
        {open ? (
          <Button size="sm" className="h-9" onClick={() => openReceive(order)}>
            Recibir
          </Button>
        ) : null}
        {open ? (
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() => openSchedule(order)}
          >
            <CalendarClock className="size-3.5" />
            {order.scheduledReceiveAt ? "Reagendar" : "Agendar recepción"}
          </Button>
        ) : null}
        {order.status !== "cancelado" ? (
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            disabled={printingId === order.id}
            onClick={() => void handlePrint(order)}
          >
            {printingId === order.id ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Printer className="size-3.5" />
            )}
            Imprimir
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          className="h-9"
          onClick={() => setInvoicesOrderId(order.id)}
        >
          Facturas{order.invoices.length ? ` (${order.invoices.length})` : ""}
        </Button>
        {open ? (
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
        ) : null}
      </>
    );
  }

  function invoiceCell(order: PurchaseOrder) {
    if (!order.invoices.length) {
      return <span className="text-muted-foreground">Sin factura</span>;
    }
    const pending = purchaseOrderTotal(order) - invoicedTotal(order);
    return (
      <span>
        {invoiceSummary(order)}
        {Math.abs(pending) >= 0.01 ? (
          <span className="block text-xs text-amber-700 dark:text-amber-300">
            Diferencia {formatMoney(pending)}
          </span>
        ) : null}
      </span>
    );
  }

  function renderOrders(list: PurchaseOrder[]) {
    return (
      <>
        <ResponsiveDataList
          emptyMessage={emptyOrdersMessage}
          items={list.map((order) => ({
            key: order.id,
            title: order.orderNumber,
            subtitle: order.supplierName,
            badge: (
              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                {order.status}
              </span>
            ),
            fields: [
              { label: "Total", value: formatMoney(purchaseOrderTotal(order)) },
              {
                label: "Pendiente",
                value: order.items.reduce((sum, line) => sum + pendingQty(line), 0),
              },
              {
                label: "Recepción",
                value: formatReceiveAppointment(order) || "Sin agendar",
              },
              { label: "Factura", value: invoiceCell(order) },
            ],
            actions: orderActions(order),
          }))}
        />

        <DesktopTable>
          <SortableTable className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Pedido</th>
                <th className="px-4 py-3 font-medium">Proveedor</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Factura</th>
                <th className="px-4 py-3 font-medium">Pendiente</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    {emptyOrdersMessage}
                  </td>
                </tr>
              ) : (
                list.map((order) => (
                  <tr key={order.id} className="border-t border-border/70">
                    <td className="px-4 py-3 font-medium">
                      <p>{order.orderNumber}</p>
                      {order.scheduledReceiveAt ? (
                        <p className="mt-0.5 text-xs font-normal text-orange-700 dark:text-orange-300">
                          Recepción {formatReceiveAppointment(order)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{order.supplierName}</td>
                    <td className="px-4 py-3 capitalize">{order.status}</td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      {formatMoney(purchaseOrderTotal(order))}
                    </td>
                    <td className="px-4 py-3">{invoiceCell(order)}</td>
                    <td className="px-4 py-3">
                      {order.items.reduce((sum, line) => sum + pendingQty(line), 0)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">{orderActions(order)}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </SortableTable>
        </DesktopTable>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <ReadOnlyBanner visible={!canWrite} />
      {!formOpen && !scheduling && error ? (
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
              Órdenes de Compras. Agenda la recepción en el calendario, imprime la hoja de trabajo
              y captura la entrada parcial o total contra la OC.
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
        <div className="flex flex-col gap-2 border-b border-border p-4 lg:flex-row lg:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Buscar pedido, proveedor, producto, SKU o factura..."
            className="lg:flex-1"
          />
          <select
            value={supplierFilter}
            onChange={(event) => setSupplierFilter(event.target.value)}
            aria-label="Filtrar por proveedor"
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm lg:w-64"
          >
            <option value="">Todos los proveedores</option>
            {supplierOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.name}
              </option>
            ))}
          </select>
          <div className="inline-flex shrink-0 rounded-lg border border-input p-0.5 text-sm">
            {(
              [
                [false, "Lista"],
                [true, "Por proveedor"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => setGroupBySupplier(value)}
                className={cn(
                  "h-9 flex-1 rounded-md px-3 font-medium",
                  groupBySupplier === value
                    ? "bg-[#3B46A5] text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {groupBySupplier && supplierGroups.length > 0 ? (
          <div className="divide-y divide-border">
            {supplierGroups.map((group) => {
              const total = group.orders.reduce((sum, order) => sum + purchaseOrderTotal(order), 0);
              const invoiced = group.orders.reduce((sum, order) => sum + invoicedTotal(order), 0);
              return (
                <div key={group.key}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 bg-muted/30 px-4 py-3">
                    <h3 className="font-semibold">{group.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {group.orders.length} pedido{group.orders.length === 1 ? "" : "s"} · Total{" "}
                      {formatMoney(total)} · Facturado {formatMoney(invoiced)}
                    </p>
                  </div>
                  {renderOrders(group.orders)}
                </div>
              );
            })}
          </div>
        ) : (
          renderOrders(visibleOrders)
        )}
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
                Recibe línea por línea. Si un producto llega en más de un lote, agrega un lote por cada uno y reparte la
                cantidad. El pendiente se calcula contra lo ya ingresado.
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

              <div className="space-y-3">
                {receiving.items.map((line) => {
                  const drafts = receiveDrafts.filter((item) => item.lineId === line.id);
                  const pending = pendingQty(line);
                  const receiveNow = drafts.reduce((sum, item) => sum + item.receiveNow, 0);
                  const leftover = Math.max(pending - receiveNow, 0);
                  const product = products.find((item) => item.id === line.itemId);
                  return (
                    <section key={line.id} className="rounded-xl border border-border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{line.itemName}</p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-mono">{line.itemSku}</span>
                            {" · "}
                            {catalogModelLabel(product?.model || line.itemModel)}
                          </p>
                          {!line.itemId ? (
                            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                              Fuera de catálogo · se registra recibido sin entrar a inventario
                            </p>
                          ) : product?.tracksLot ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Este producto controla lote: captura cada lote que llegó.
                            </p>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Pedido {line.quantity} · Recibido {line.receivedQuantity} · Queda {leftover}
                        </p>
                      </div>

                      <div className="mt-3 space-y-3">
                        {drafts.map((draft, index) => (
                          <div
                            key={draft.id}
                            className="rounded-lg border border-border bg-muted/20 p-3"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-medium">
                                Lote {index + 1}
                                {drafts.length > 1 ? ` de ${drafts.length}` : ""}
                              </p>
                              {drafts.length > 1 ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-destructive"
                                  onClick={() => removeLot(draft.id)}
                                >
                                  <Trash2 className="size-3.5" /> Quitar
                                </Button>
                              ) : null}
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                              <label className="space-y-1">
                                <span className="text-xs text-muted-foreground">Recibir ahora</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={draft.receiveNow}
                                  aria-label={`Cantidad del lote ${index + 1} de ${line.itemName}`}
                                  onChange={(event) =>
                                    updateDraft(draft.id, { receiveNow: Number(event.target.value) })
                                  }
                                  className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-muted-foreground">Lote</span>
                                <input
                                  value={draft.lotNumber}
                                  onChange={(event) =>
                                    updateDraft(draft.id, { lotNumber: event.target.value })
                                  }
                                  placeholder="Lote"
                                  aria-label={`Número de lote ${index + 1} de ${line.itemName}`}
                                  className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-muted-foreground">Fabricación</span>
                                <input
                                  type="date"
                                  value={draft.manufacturedAt}
                                  onChange={(event) =>
                                    updateDraft(draft.id, { manufacturedAt: event.target.value })
                                  }
                                  title="Fecha de fabricación (opcional)"
                                  aria-label={`Fecha de fabricación del lote ${index + 1}`}
                                  className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-muted-foreground">Caducidad</span>
                                <input
                                  type="date"
                                  value={draft.expiryDate}
                                  onChange={(event) =>
                                    updateDraft(draft.id, { expiryDate: event.target.value })
                                  }
                                  title="Fecha de caducidad (opcional)"
                                  aria-label={`Fecha de caducidad del lote ${index + 1}`}
                                  className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-muted-foreground">Serie</span>
                                <input
                                  value={draft.serialNumber}
                                  onChange={(event) =>
                                    updateDraft(draft.id, { serialNumber: event.target.value })
                                  }
                                  placeholder="Serie"
                                  aria-label={`Serie del lote ${index + 1} de ${line.itemName}`}
                                  className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => addLot(line.id)}
                      >
                        <Plus className="size-3.5" /> Agregar otro lote
                      </Button>
                    </section>
                  );
                })}
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
            <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
              <Button
                type="button"
                variant="outline"
                className="sm:mr-auto"
                disabled={receivingNow || printingId === receiving.id}
                onClick={() => void handlePrint(receiving)}
              >
                {printingId === receiving.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Printer className="size-3.5" />
                )}
                Imprimir documento
              </Button>
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

      {scheduling ? (
        <ModalShell
          title={`Agendar recepción · ${scheduling.orderNumber}`}
          description="La cita aparece en el calendario operativo para almacén y compras. No cambia la fecha esperada del proveedor."
        >
          <form className="space-y-4" onSubmit={(event) => void handleSchedule(event)}>
            {error ? (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {scheduling.supplierName || "Sin proveedor"}
              {scheduling.expectedDate ? ` · llegada estimada ${scheduling.expectedDate}` : ""}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Fecha
                <input
                  required
                  type="date"
                  value={scheduleDate}
                  onChange={(event) => setScheduleDate(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </label>
              <label className="block text-sm font-medium">
                Hora
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(event) => setScheduleTime(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </label>
            </div>
            <label className="block text-sm font-medium">
              Nota para almacén
              <textarea
                value={scheduleNote}
                onChange={(event) => setScheduleNote(event.target.value)}
                className="mt-1 min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Andén, tarimas, horario de descarga..."
              />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="sm:mr-auto"
                disabled={schedulingNow || printingId === scheduling.id}
                onClick={() => void handlePrint(scheduling)}
              >
                {printingId === scheduling.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Printer className="size-3.5" />
                )}
                Imprimir documento
              </Button>
              {scheduling.scheduledReceiveAt ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={schedulingNow}
                  onClick={() => void handleClearSchedule()}
                >
                  Quitar del calendario
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={schedulingNow}
                onClick={() => {
                  setScheduling(null);
                  setError("");
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={schedulingNow}
                className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90"
              >
                {schedulingNow ? "Guardando..." : "Guardar en calendario"}
              </Button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {invoicesOrder ? (
        <PurchaseOrderInvoicesModal
          order={invoicesOrder}
          canAdd={canWrite}
          canDelete={canDelete}
          supplierRfc={suppliers.find((item) => item.id === invoicesOrder.supplierId)?.rfc}
          actor={getSession()?.fullName || getSession()?.username || "usuario"}
          onClose={() => setInvoicesOrderId(null)}
          onChanged={(invoices) =>
            setOrders((current) =>
              current.map((order) =>
                order.id === invoicesOrder.id ? { ...order, invoices } : order
              )
            )
          }
        />
      ) : null}
    </div>
  );
}
