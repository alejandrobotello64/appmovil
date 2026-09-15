import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type {
  InventoryCategoryId,
  InventoryItem,
  InventoryItemInput,
  InventoryUnit,
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
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category as InventoryCategoryId,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInputToRow(input: InventoryItemInput): InventoryInsert {
  return {
    sku: input.sku.trim(),
    name: input.name.trim(),
    category: input.category,
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
  };
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .order("created_at", { ascending: false });

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
