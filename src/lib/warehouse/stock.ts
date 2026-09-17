import { supabase } from "@/lib/supabase/client";

export type StockMovementResult = {
  folio: string;
  movementId: string;
  newQuantity: number;
};

export type Warehouse = {
  id: string;
  code: string;
  name: string;
  city: string;
  isDefault: boolean;
};

export type WarehouseLocation = {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
};

export type KardexRow = {
  id: string;
  occurredAt: string;
  folio: string;
  movementType: string;
  productSku: string;
  productName: string;
  qtyIn: number;
  qtyOut: number;
  resultingQty: number;
  unitCost: number;
  reason: string;
  note: string;
  createdBy: string;
};

// New tables live in the SQL migration; keep queries loosely typed until gen:types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function getWarehouses(): Promise<Warehouse[]> {
  const { data, error } = await db
    .from("warehouses")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    city: String(row.city ?? ""),
    isDefault: Boolean(row.is_default),
  }));
}

export async function getWarehouseLocations(
  warehouseId?: string
): Promise<WarehouseLocation[]> {
  let query = db.from("locations").select("*").eq("is_active", true);
  if (warehouseId) query = query.eq("warehouse_id", warehouseId);
  const { data, error } = await query.order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    warehouseId: String(row.warehouse_id),
    code: String(row.code),
    name: String(row.name),
  }));
}

export async function applyStockMovement(input: {
  productId: string;
  movementType:
    | "entrada"
    | "salida"
    | "devolucion"
    | "ajuste_sobrante"
    | "ajuste_faltante"
    | "canje_caducado";
  quantity: number;
  note?: string;
  createdBy: string;
  reason?: string;
  warehouseId?: string | null;
  locationId?: string | null;
  lotNumber?: string | null;
  expiryDate?: string | null;
  manufacturedAt?: string | null;
  serialNumber?: string | null;
  supplierName?: string;
  purchaseOrderId?: string | null;
}): Promise<StockMovementResult> {
  const { data, error } = await supabase.rpc("apply_stock_movement", {
    p_product_id: input.productId,
    p_movement_type: input.movementType,
    p_quantity: input.quantity,
    p_note: input.note ?? "",
    p_created_by: input.createdBy,
    p_reason: input.reason ?? "",
    p_warehouse_id: input.warehouseId ?? null,
    p_location_id: input.locationId ?? null,
    p_lot_number: input.lotNumber ?? null,
    p_expiry_date: input.expiryDate || null,
    p_serial_number: input.serialNumber ?? null,
    p_supplier_name: input.supplierName ?? "",
    p_purchase_order_id: input.purchaseOrderId ?? null,
  });

  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("El movimiento no devolvió folio.");

  if (input.manufacturedAt) {
    const { error: itemError } = await db
      .from("inventory_items")
      .update({ manufactured_at: input.manufacturedAt })
      .eq("id", input.productId);
    if (itemError) throw new Error(itemError.message);

    if (input.lotNumber) {
      const { error: lotError } = await db
        .from("lots")
        .update({ manufactured_at: input.manufacturedAt })
        .eq("product_id", input.productId)
        .eq("lot_number", input.lotNumber);
      if (lotError) throw new Error(lotError.message);
    }
  }

  return {
    folio: row.folio,
    movementId: row.movement_id,
    newQuantity: row.new_quantity,
  };
}

export async function transferStock(input: {
  productId: string;
  quantity: number;
  toLocationName: string;
  note?: string;
  createdBy: string;
}): Promise<StockMovementResult> {
  const { data, error } = await supabase.rpc("transfer_stock", {
    p_product_id: input.productId,
    p_quantity: input.quantity,
    p_to_location_name: input.toLocationName,
    p_note: input.note ?? "",
    p_created_by: input.createdBy,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("El traspaso no devolvió folio.");
  return {
    folio: row.folio,
    movementId: row.movement_id,
    newQuantity: row.new_quantity,
  };
}

export type ProductLot = {
  id: string;
  lotNumber: string;
  expiryDate: string;
  manufacturedAt: string;
};

export async function getProductLots(productId: string): Promise<ProductLot[]> {
  const { data, error } = await db
    .from("lots")
    .select("id, lot_number, expiry_date, manufactured_at")
    .eq("product_id", productId)
    .order("expiry_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    lotNumber: String(row.lot_number ?? ""),
    expiryDate: String(row.expiry_date ?? ""),
    manufacturedAt: String(row.manufactured_at ?? ""),
  }));
}

export async function getOpenTransferCount(): Promise<number> {
  const { count, error } = await db
    .from("stock_transfers")
    .select("*", { count: "exact", head: true })
    .not("status", "in", "(recibido,cancelado)");
  if (error) {
    console.error("Error counting transfers:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getKardex(productId?: string): Promise<KardexRow[]> {
  let query = db
    .from("inventory_movements")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(400);
  if (productId) query = query.eq("product_id", productId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    occurredAt: String(row.occurred_at),
    folio: String(row.folio),
    movementType: String(row.movement_type),
    productSku: String(row.product_sku),
    productName: String(row.product_name),
    qtyIn: Number(row.qty_in),
    qtyOut: Number(row.qty_out),
    resultingQty: Number(row.resulting_qty),
    unitCost: Number(row.unit_cost),
    reason: String(row.reason ?? ""),
    note: String(row.note ?? ""),
    createdBy: String(row.created_by ?? ""),
  }));
}
