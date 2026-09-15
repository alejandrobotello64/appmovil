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
    quantity: input.quantity,
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
  };
}

export async function getInventoryItems(options?: {
  kind?: ItemKind;
}): Promise<InventoryItem[]> {
  let query = supabase
    .from("inventory_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (options?.kind) {
    query = query.eq("item_kind", options.kind);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error loading inventory:", error.message);
    throw new Error(error.message);
  }

  return (data ?? []).map(mapRowToItem);
}

export async function createInventoryItem(
  input: InventoryItemInput
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

  return mapRowToItem(data);
}

export async function updateInventoryItem(
  id: string,
  input: InventoryItemInput
): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from("inventory_items")
    .update(mapInputToRow(input))
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating inventory item:", error.message);
    throw new Error(error.message);
  }

  return mapRowToItem(data);
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const { error } = await supabase
    .from("inventory_items")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting inventory item:", error.message);
    throw new Error(error.message);
  }
}

export async function adjustInventoryQuantity(
  id: string,
  delta: number
): Promise<InventoryItem> {
  const items = await getInventoryItems();
  const current = items.find((item) => item.id === id);
  if (!current) {
    throw new Error("Producto no encontrado.");
  }

  const nextQuantity = current.quantity + delta;
  if (nextQuantity < 0) {
    throw new Error("No hay suficiente stock para esta salida.");
  }

  return updateInventoryItem(id, {
    ...current,
    quantity: nextQuantity,
  });
}
