import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type {
  AssetStatus,
  InventoryCategoryId,
  InventoryItem,
  InventoryItemInput,
  InventoryUnit,
  ItemKind,
} from "./types";

type InventoryRow = Database["public"]["Tables"]["inventory_items"]["Row"];
type InventoryInsert =
  Database["public"]["Tables"]["inventory_items"]["Insert"];

export function getStockStatus(
  quantity: number,
  minStock: number
): "disponible" | "bajo_stock" | "agotado" {
  if (quantity <= 0) return "agotado";
  if (quantity <= minStock) return "bajo_stock";
  return "disponible";
}

function mapRowToItem(row: InventoryRow): InventoryItem {
  const category = row.category as InventoryCategoryId;
  const inferredKind: ItemKind =
    row.item_kind === "equipo" || category === "equipos" ? "equipo" : "producto";

  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category,
    itemKind: inferredKind,
    description: row.description ?? "",
    quantity: row.quantity,
    minStock: row.min_stock,
    unit: row.unit as InventoryUnit,
    location: row.location ?? "",
    brand: row.brand ?? "",
    model: row.model ?? "",
    serialNumber: row.serial_number ?? "",
    unitPrice: Number(row.unit_price ?? 0),
    supplier: row.supplier ?? "",
    expiryDate: row.expiry_date ?? "",
    notes: row.notes ?? "",
    assetStatus: (row.asset_status as AssetStatus) || "operativo",
    lastMaintenanceDate: row.last_maintenance_date ?? "",
    nextMaintenanceDate: row.next_maintenance_date ?? "",
    isActive: row.is_active !== false,
    tracksLot: Boolean(row.tracks_lot),
    tracksSerial: Boolean(row.tracks_serial),
    tracksExpiry: Boolean(row.tracks_expiry),
    maxStock: row.max_stock ?? 0,
    reorderPoint: row.reorder_point ?? row.min_stock,
    partNumber: row.part_number ?? "",
    manufacturer: row.manufacturer ?? "",
    subcategory: row.subcategory ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInputToRow(input: InventoryItemInput): InventoryInsert {
  const itemKind: ItemKind =
    input.itemKind === "equipo" || input.category === "equipos"
      ? "equipo"
      : "producto";

  return {
    sku: input.sku.trim(),
    name: input.name.trim(),
    category: itemKind === "equipo" ? "equipos" : input.category,
    item_kind: itemKind,
    description: input.description ?? "",
    quantity: 0,
    min_stock: input.minStock,
    unit: input.unit,
    location: input.location ?? "",
    brand: input.brand ?? "",
    model: input.model ?? "",
    serial_number: input.serialNumber ?? "",
    unit_price: input.unitPrice,
    supplier: input.supplier ?? "",
    expiry_date: input.expiryDate ? input.expiryDate : null,
    notes: input.notes ?? "",
    asset_status: input.assetStatus || "operativo",
    last_maintenance_date: input.lastMaintenanceDate
      ? input.lastMaintenanceDate
      : null,
    next_maintenance_date: input.nextMaintenanceDate
      ? input.nextMaintenanceDate
      : null,
    is_active: input.isActive !== false,
    tracks_lot:
      Boolean(input.tracksLot) ||
      (itemKind !== "equipo" &&
        (input.category === "medicamentos" || Boolean(input.expiryDate))),
    tracks_serial: input.tracksSerial || itemKind === "equipo",
    tracks_expiry:
      input.tracksExpiry ||
      input.category === "medicamentos" ||
      Boolean(input.expiryDate),
    max_stock: input.maxStock ?? 0,
    reorder_point: input.reorderPoint || input.minStock,
    part_number: input.partNumber ?? "",
    manufacturer: input.manufacturer ?? "",
    subcategory: input.subcategory ?? "",
  };
}

export async function getInventoryItems(options?: {
  kind?: ItemKind;
  includeInactive?: boolean;
}): Promise<InventoryItem[]> {
  let query = supabase
    .from("inventory_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (options?.kind) {
    query = query.eq("item_kind", options.kind);
  }
  if (!options?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error loading inventory:", error.message);
    throw new Error(error.message);
  }

  return (data ?? []).map(mapRowToItem);
}

export async function createInventoryItem(
  input: InventoryItemInput,
  createdBy = "sistema"
): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from("inventory_items")
    .insert(mapInputToRow(input))
    .select("*")
    .single();

  if (error) {
    console.error("Error creating inventory item:", error.message);
    throw new Error(error.message);
  }

  const created = mapRowToItem(data);
  if (input.quantity > 0) {
    const { applyStockMovement } = await import("@/lib/warehouse/stock");
    const result = await applyStockMovement({
      productId: created.id,
      movementType: "entrada",
      quantity: input.quantity,
      createdBy,
      note: "Existencia inicial de alta de producto",
      lotNumber: input.tracksLot ? input.serialNumber || "INICIAL" : null,
      expiryDate: input.expiryDate || null,
      serialNumber: input.itemKind === "equipo" ? input.serialNumber : null,
      supplierName: input.supplier,
    });
    return { ...created, quantity: result.newQuantity };
  }

  return created;
}

export async function updateInventoryItem(
  id: string,
  input: InventoryItemInput
): Promise<InventoryItem> {
  const payload = mapInputToRow(input);
  delete payload.quantity;

  const { data, error } = await supabase
    .from("inventory_items")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating inventory item:", error.message);
    throw new Error(error.message);
  }

  return mapRowToItem(data);
}

export async function deleteInventoryItem(
  id: string,
  createdBy = "sistema"
): Promise<void> {
  const { error } = await supabase.rpc("deactivate_product", {
    p_product_id: id,
    p_created_by: createdBy,
  });

  if (error) {
    console.error("Error deactivating inventory item:", error.message);
    throw new Error(error.message);
  }
}

export async function bulkImportInventoryItems(
  rows: InventoryItemInput[],
  createdBy: string
): Promise<{
  created: number;
  updated: number;
  errors: Array<{ sku: string; message: string }>;
}> {
  const existing = await getInventoryItems({ includeInactive: true });
  const bySku = new Map(
    existing.map((item) => [item.sku.trim().toLowerCase(), item])
  );
  let created = 0;
  let updated = 0;
  const errors: Array<{ sku: string; message: string }> = [];

  for (const input of rows) {
    const key = input.sku.trim().toLowerCase();
    try {
      const current = bySku.get(key);
      if (current) {
        await updateInventoryItem(current.id, {
          ...input,
          quantity: current.quantity,
        });
        updated += 1;
      } else {
        const item = await createInventoryItem(input, createdBy);
        bySku.set(key, item);
        created += 1;
      }
    } catch (err) {
      errors.push({
        sku: input.sku,
        message: err instanceof Error ? err.message : "No se pudo importar la fila.",
      });
    }
  }

  return { created, updated, errors };
}

export async function adjustInventoryQuantity(
  id: string,
  delta: number,
  createdBy = "sistema",
  note = ""
): Promise<InventoryItem> {
  const { applyStockMovement } = await import("@/lib/warehouse/stock");
  const movementType = delta >= 0 ? "entrada" : "salida";
  await applyStockMovement({
    productId: id,
    movementType,
    quantity: Math.abs(delta),
    createdBy,
    note,
    reason: movementType === "salida" ? "consumo interno" : "entrada de mercancia",
  });
  const items = await getInventoryItems({ includeInactive: true });
  const current = items.find((item) => item.id === id);
  if (!current) throw new Error("Producto no encontrado.");
  return current;
}
