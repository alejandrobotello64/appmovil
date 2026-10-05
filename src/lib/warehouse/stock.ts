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
  isActive: boolean;
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

export async function getWarehouses(includeInactive = false): Promise<Warehouse[]> {
  let query = db.from("warehouses").select("*");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query.order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    city: String(row.city ?? ""),
    isDefault: Boolean(row.is_default),
    isActive: row.is_active !== false,
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

/** Ubicaciones genéricas por categoría que se crean con cada almacén; no son un lugar físico. */
export const DEFAULT_LOCATION_CODES = [
  "GENERAL",
  "INSUMOS",
  "MEDICAMENTOS",
  "REFACCIONES",
  "ACCESORIOS",
  "EQUIPOS",
];

function locationCode(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .slice(0, 24)
    .replace(/^-+|-+$/g, "");
}

export async function createWarehouse(input: {
  code: string;
  name: string;
  city: string;
}): Promise<Warehouse> {
  const code = locationCode(input.code);
  const name = input.name.trim();
  if (!code || !name) throw new Error("Captura la clave y el nombre del almacén.");
  const { data, error } = await db
    .from("warehouses")
    .insert({ code, name, city: input.city.trim() })
    .select("*")
    .single();
  if (error) {
    throw new Error(
      error.code === "23505" ? `Ya existe un almacén con la clave ${code}.` : error.message
    );
  }
  const { error: locError } = await db
    .from("locations")
    .insert(
      DEFAULT_LOCATION_CODES.map((locCode) => ({
        warehouse_id: data.id,
        code: locCode,
        name:
          locCode === "EQUIPOS"
            ? "Equipos médicos"
            : locCode.charAt(0) + locCode.slice(1).toLowerCase(),
      }))
    );
  if (locError) throw new Error(locError.message);
  return {
    id: String(data.id),
    code: String(data.code),
    name: String(data.name),
    city: String(data.city ?? ""),
    isDefault: Boolean(data.is_default),
    isActive: true,
  };
}

export async function setWarehouseActive(id: string, active: boolean) {
  if (!active) {
    const { count, error: countError } = await db
      .from("inventory_balances")
      .select("id", { count: "exact", head: true })
      .eq("warehouse_id", id)
      .gt("qty_on_hand", 0);
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) {
      throw new Error("No se puede desactivar un almacén que todavía tiene existencias.");
    }
  }
  const { error } = await db.from("warehouses").update({ is_active: active }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createWarehouseLocation(
  warehouseId: string,
  name: string
): Promise<WarehouseLocation> {
  const trimmed = name.trim();
  const code = locationCode(trimmed);
  if (!code) throw new Error("Captura un nombre de ubicación válido.");
  const { data, error } = await db
    .from("locations")
    .insert({ warehouse_id: warehouseId, code, name: trimmed })
    .select("*")
    .single();
  if (error) {
    throw new Error(
      error.code === "23505"
        ? `Ya existe una ubicación con la clave ${code} en este almacén.`
        : error.message
    );
  }
  return {
    id: String(data.id),
    warehouseId: String(data.warehouse_id),
    code: String(data.code),
    name: String(data.name),
  };
}

export async function deactivateWarehouseLocation(id: string) {
  const { count, error: countError } = await db
    .from("inventory_balances")
    .select("id", { count: "exact", head: true })
    .eq("location_id", id)
    .gt("qty_on_hand", 0);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) > 0) {
    throw new Error("La ubicación tiene existencias; reubícalas antes de darla de baja.");
  }
  const { error } = await db.from("locations").update({ is_active: false }).eq("id", id);
  if (error) throw new Error(error.message);
}

export type RelocateResult = {
  folio: string;
  movedQty: number;
  locationId: string;
  locationName: string;
};

/** Mueve toda la existencia (y series) del producto en el almacén a una ubicación existente o nueva. */
export async function relocateStock(input: {
  productId: string;
  warehouseId: string;
  locationId?: string | null;
  locationName?: string | null;
  note?: string;
  createdBy: string;
}): Promise<RelocateResult> {
  const { data, error } = await db.rpc("relocate_stock", {
    p_product_id: input.productId,
    p_warehouse_id: input.warehouseId,
    p_location_id: input.locationId || null,
    p_location_name: input.locationName?.trim() || null,
    p_note: input.note ?? "",
    p_created_by: input.createdBy,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("La reubicación no devolvió resultado.");
  return {
    folio: String(row.folio ?? ""),
    movedQty: Number(row.moved_qty ?? 0),
    locationId: String(row.target_location_id),
    locationName: String(row.target_location_name ?? ""),
  };
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

export type ProductLot = {
  id: string;
  lotNumber: string;
  expiryDate: string;
  manufacturedAt: string;
};

function mapLotRow(row: Record<string, unknown>): ProductLot {
  return {
    id: String(row.id),
    lotNumber: String(row.lot_number ?? ""),
    expiryDate: String(row.expiry_date ?? ""),
    manufacturedAt: String(row.manufactured_at ?? ""),
  };
}

export async function getProductLots(productId: string): Promise<ProductLot[]> {
  const { data, error } = await db
    .from("lots")
    .select("id, lot_number, expiry_date, manufactured_at")
    .eq("product_id", productId)
    .order("expiry_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>) => mapLotRow(row));
}

/** Carga lotes de varios productos en una sola consulta (listas de inventario). */
export async function getLotsByProductIds(
  productIds: string[]
): Promise<Map<string, ProductLot[]>> {
  const result = new Map<string, ProductLot[]>();
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  const chunkSize = 150;
  for (let index = 0; index < uniqueIds.length; index += chunkSize) {
    const chunk = uniqueIds.slice(index, index + chunkSize);
    const { data, error } = await db
      .from("lots")
      .select("id, product_id, lot_number, expiry_date, manufactured_at")
      .in("product_id", chunk)
      .order("expiry_date", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const productId = String(row.product_id ?? "");
      if (!productId) continue;
      const list = result.get(productId);
      const lot = mapLotRow(row);
      if (list) list.push(lot);
      else result.set(productId, [lot]);
    }
  }
  return result;
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

function mapKardexRow(row: Record<string, unknown>): KardexRow {
  return {
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
  };
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
  return (data ?? []).map(mapKardexRow);
}

/** Historial reciente solo de entradas o salidas (para el panel lateral). */
export async function getEntryExitHistory(
  mode: "entrada" | "salida",
  limit = 40
): Promise<KardexRow[]> {
  const { data, error } = await db
    .from("inventory_movements")
    .select("*")
    .eq("movement_type", mode)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapKardexRow);
}
