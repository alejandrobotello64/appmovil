import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { getInventoryItems } from "@/lib/inventory/storage";
import { applyStockMovement, transferStock } from "@/lib/warehouse/stock";

type MovementRow = Database["public"]["Tables"]["warehouse_movements"]["Row"];

export type MovementType =
  | "entrada"
  | "salida"
  | "cambio_ubicacion"
  | "canje_caducado";

export type WarehouseMovement = {
  id: string;
  itemId: string | null;
  itemSku: string;
  itemName: string;
  movementType: MovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  note: string;
  createdBy: string;
  createdAt: string;
  fromLocation: string;
  toLocation: string;
  supplierName: string;
  previousExpiry: string;
  newExpiry: string;
};

export type WarehouseMovementInput = {
  itemId: string;
  itemSku: string;
  itemName: string;
  movementType: MovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  note?: string;
  createdBy?: string;
  fromLocation?: string;
  toLocation?: string;
  supplierName?: string;
  previousExpiry?: string;
  newExpiry?: string;
};

function mapRow(row: MovementRow): WarehouseMovement {
  return {
    id: row.id,
    itemId: row.item_id,
    itemSku: row.item_sku,
    itemName: row.item_name,
    movementType: row.movement_type as MovementType,
    quantity: row.quantity,
    previousQuantity: row.previous_quantity,
    newQuantity: row.new_quantity,
    note: row.note ?? "",
    createdBy: row.created_by ?? "",
    createdAt: row.created_at,
    fromLocation: row.from_location ?? "",
    toLocation: row.to_location ?? "",
    supplierName: row.supplier_name ?? "",
    previousExpiry: row.previous_expiry ?? "",
    newExpiry: row.new_expiry ?? "",
  };
}

export async function getWarehouseMovements(): Promise<WarehouseMovement[]> {
  const { data, error } = await supabase
    .from("warehouse_movements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Error loading movements:", error.message);
    throw new Error(error.message);
  }

  return (data ?? []).map(mapRow);
}

export async function createWarehouseMovement(
  input: WarehouseMovementInput
): Promise<WarehouseMovement> {
  const { data, error } = await supabase
    .from("warehouse_movements")
    .insert({
      item_id: input.itemId,
      item_sku: input.itemSku,
      item_name: input.itemName,
      movement_type: input.movementType,
      quantity: input.quantity,
      previous_quantity: input.previousQuantity,
      new_quantity: input.newQuantity,
      note: input.note ?? "",
      created_by: input.createdBy ?? "",
      from_location: input.fromLocation ?? "",
      to_location: input.toLocation ?? "",
      supplier_name: input.supplierName ?? "",
      previous_expiry: input.previousExpiry || null,
      new_expiry: input.newExpiry || null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating movement:", error.message);
    throw new Error(error.message);
  }

  return mapRow(data);
}

export async function transferProductLocation(input: {
  itemId: string;
  newLocation: string;
  note?: string;
  createdBy?: string;
}): Promise<WarehouseMovement> {
  const products = await getInventoryItems({ kind: "producto" });
  const product = products.find((item) => item.id === input.itemId);
  if (!product) throw new Error("Producto no encontrado.");

  const newLocation = input.newLocation.trim();
  if (!newLocation) throw new Error("Indica la nueva ubicación.");
  if (newLocation === product.location) {
    throw new Error("La nueva ubicación es igual a la actual.");
  }

  if (product.quantity <= 0) {
    throw new Error("No hay existencia para traspasar. Usa una entrada primero.");
  }

  await transferStock({
    productId: product.id,
    quantity: product.quantity,
    toLocationName: newLocation,
    note: input.note,
    createdBy: input.createdBy || "sistema",
  });

  return {
    id: crypto.randomUUID(),
    itemId: product.id,
    itemSku: product.sku,
    itemName: product.name,
    movementType: "cambio_ubicacion",
    quantity: product.quantity,
    previousQuantity: product.quantity,
    newQuantity: product.quantity,
    note: input.note ?? "",
    createdBy: input.createdBy ?? "",
    createdAt: new Date().toISOString(),
    fromLocation: product.location || "Sin ubicación",
    toLocation: newLocation,
    supplierName: "",
    previousExpiry: "",
    newExpiry: "",
  };
}

export async function exchangeExpiredProduct(input: {
  itemId: string;
  quantity: number;
  supplierName: string;
  outgoingLotNumber: string;
  newLotNumber: string;
  newExpiryDate: string;
  note?: string;
  createdBy?: string;
}): Promise<WarehouseMovement> {
  const products = await getInventoryItems({ kind: "producto" });
  const product = products.find((item) => item.id === input.itemId);
  if (!product) throw new Error("Producto no encontrado.");
  if (product.category !== "insumos") {
    throw new Error(
      "El canje de caducados solo aplica para productos del inventario de insumos."
    );
  }

  const outgoingLot = input.outgoingLotNumber.trim();
  const newLot = input.newLotNumber.trim();
  if (!outgoingLot) {
    throw new Error("Indica el lote caducado o por canjear.");
  }
  if (!newLot) {
    throw new Error("Indica el lote nuevo que entrega el proveedor.");
  }

  if (input.quantity <= 0) {
    throw new Error("La cantidad a canjear debe ser mayor a 0.");
  }
  if (input.quantity > product.quantity) {
    throw new Error("No puedes canjear más unidades de las disponibles.");
  }
  if (!input.supplierName.trim()) {
    throw new Error("Indica el proveedor del canje.");
  }
  if (!input.newExpiryDate) {
    throw new Error("Indica la nueva fecha de caducidad.");
  }

  const createdBy = input.createdBy || "sistema";
  const noteBase = [
    input.note?.trim(),
    `Lote canjeado: ${outgoingLot}`,
    `Lote nuevo: ${newLot}`,
  ]
    .filter(Boolean)
    .join(" · ");

  if (outgoingLot === newLot) {
    await applyStockMovement({
      productId: product.id,
      movementType: "canje_caducado",
      quantity: input.quantity,
      createdBy,
      note: noteBase,
      supplierName: input.supplierName.trim(),
      expiryDate: input.newExpiryDate,
      lotNumber: newLot,
      reason: "Canje de insumo caducado",
    });
  } else {
    await applyStockMovement({
      productId: product.id,
      movementType: "salida",
      quantity: input.quantity,
      createdBy,
      note: noteBase,
      supplierName: input.supplierName.trim(),
      lotNumber: outgoingLot,
      reason: "Canje caducado · salida de lote",
    });
    await applyStockMovement({
      productId: product.id,
      movementType: "entrada",
      quantity: input.quantity,
      createdBy,
      note: noteBase,
      supplierName: input.supplierName.trim(),
      expiryDate: input.newExpiryDate,
      lotNumber: newLot,
      reason: "Canje caducado · entrada de lote nuevo",
    });
  }

  return {
    id: crypto.randomUUID(),
    itemId: product.id,
    itemSku: product.sku,
    itemName: product.name,
    movementType: "canje_caducado",
    quantity: input.quantity,
    previousQuantity: product.quantity,
    newQuantity: product.quantity,
    note: noteBase,
    createdBy: input.createdBy ?? "",
    createdAt: new Date().toISOString(),
    fromLocation: product.location,
    toLocation: product.location,
    supplierName: input.supplierName.trim(),
    previousExpiry: product.expiryDate,
    newExpiry: input.newExpiryDate,
  };
}
