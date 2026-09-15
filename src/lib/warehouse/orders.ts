import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type OrderRow = Database["public"]["Tables"]["purchase_orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["purchase_order_items"]["Row"];

export type PurchaseOrderStatus =
  | "borrador"
  | "enviado"
  | "parcial"
  | "recibido"
  | "cancelado";

export type PurchaseOrderItem = {
  id: string;
  orderId: string;
  itemId: string | null;
  itemSku: string;
  itemName: string;
  quantity: number;
  receivedQuantity: number;
  unitPrice: number;
};

export type PurchaseOrder = {
  id: string;
  orderNumber: string;
  supplierId: string | null;
  supplierName: string;
  status: PurchaseOrderStatus;
  expectedDate: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: PurchaseOrderItem[];
};

export type PurchaseOrderInput = {
  supplierId: string | null;
  supplierName: string;
  expectedDate: string;
  notes: string;
  createdBy?: string;
  items: Array<{
    itemId: string | null;
    itemSku: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
  }>;
};

function mapItem(row: OrderItemRow): PurchaseOrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    itemId: row.item_id,
    itemSku: row.item_sku,
    itemName: row.item_name,
    quantity: row.quantity,
    receivedQuantity: row.received_quantity,
    unitPrice: Number(row.unit_price),
  };
}

function mapOrder(row: OrderRow, items: PurchaseOrderItem[] = []): PurchaseOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    status: row.status as PurchaseOrderStatus,
    expectedDate: row.expected_date ?? "",
    notes: row.notes ?? "",
    createdBy: row.created_by ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
  };
}

function nextOrderNumber() {
  const stamp = new Date();
  const y = stamp.getFullYear();
  const m = String(stamp.getMonth() + 1).padStart(2, "0");
  const d = String(stamp.getDate()).padStart(2, "0");
  const r = Math.floor(Math.random() * 900 + 100);
  return `PED-${y}${m}${d}-${r}`;
}

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  const { data: orders, error } = await supabase
    .from("purchase_orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const { data: items, error: itemsError } = await supabase
    .from("purchase_order_items")
    .select("*");

  if (itemsError) throw new Error(itemsError.message);

  const mappedItems = (items ?? []).map(mapItem);
  return (orders ?? []).map((order) =>
    mapOrder(
      order,
      mappedItems.filter((item) => item.orderId === order.id)
    )
  );
}

export async function createPurchaseOrder(
  input: PurchaseOrderInput
): Promise<PurchaseOrder> {
  if (input.items.length === 0) {
    throw new Error("Agrega al menos un producto al pedido.");
  }

  const { data: order, error } = await supabase
    .from("purchase_orders")
    .insert({
      order_number: nextOrderNumber(),
      supplier_id: input.supplierId,
      supplier_name: input.supplierName,
      status: "enviado",
      expected_date: input.expectedDate || null,
      notes: input.notes,
      created_by: input.createdBy ?? "",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const { data: items, error: itemsError } = await supabase
    .from("purchase_order_items")
    .insert(
      input.items.map((item) => ({
        order_id: order.id,
        item_id: item.itemId,
        item_sku: item.itemSku,
        item_name: item.itemName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      }))
    )
    .select("*");

  if (itemsError) throw new Error(itemsError.message);

  return mapOrder(order, (items ?? []).map(mapItem));
}

export async function receivePurchaseOrder(
  orderId: string
): Promise<PurchaseOrder> {
  const orders = await getPurchaseOrders();
  const order = orders.find((item) => item.id === orderId);
  if (!order) throw new Error("Pedido no encontrado.");

  for (const line of order.items) {
    if (!line.itemId) continue;
    const pending = line.quantity - line.receivedQuantity;
    if (pending <= 0) continue;

    const { data: product, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("id", line.itemId)
      .single();

    if (error || !product) continue;

    await supabase
      .from("inventory_items")
      .update({ quantity: product.quantity + pending })
      .eq("id", line.itemId);

    await supabase
      .from("purchase_order_items")
      .update({ received_quantity: line.quantity })
      .eq("id", line.id);

    await supabase.from("warehouse_movements").insert({
      item_id: line.itemId,
      item_sku: line.itemSku,
      item_name: line.itemName,
      movement_type: "entrada",
      quantity: pending,
      previous_quantity: product.quantity,
      new_quantity: product.quantity + pending,
      note: `Recepción pedido ${order.orderNumber}`,
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from("purchase_orders")
    .update({ status: "recibido" })
    .eq("id", orderId)
    .select("*")
    .single();

  if (updateError) throw new Error(updateError.message);

  const refreshed = await getPurchaseOrders();
  return refreshed.find((item) => item.id === orderId) ?? mapOrder(updated);
}

export async function cancelPurchaseOrder(orderId: string): Promise<void> {
  const { error } = await supabase
    .from("purchase_orders")
    .update({ status: "cancelado" })
    .eq("id", orderId);

  if (error) throw new Error(error.message);
}
