import type { InventoryItem } from "@/lib/inventory/types";
import { supabase } from "@/lib/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type BoxOpeningResult = {
  boxFolio: string;
  pieceFolio: string;
  piecesAdded: number;
  boxesLeft: number;
  pieceQuantity: number;
};

export type BoxOpeningRecord = {
  id: string;
  folio: string;
  occurredAt: string;
  productSku: string;
  productName: string;
  qtyIn: number;
  qtyOut: number;
  note: string;
  createdBy: string;
};

function looseName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\d+\s*bolsas?\s*\/\s*caja/g, " ")
    .replace(/\d+\s*\/\s*caja/g, " ")
    .replace(/\bpiezas?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Cuántas piezas trae la caja, si el nombre lo dice (10/caja, 20 bolsa/caja, 25 uds). */
export function piecesPerBoxFromName(name: string): number | null {
  const match =
    name.match(/(\d+)\s*bolsas?\s*\/\s*caja/i) ||
    name.match(/(\d+)\s*\/\s*caja/i) ||
    name.match(/(\d+)\s*(?:uds?\.?|unidades|piezas)\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isInteger(value) || value <= 0 || value > 100000) return null;
  return value;
}

/** Nombre de la ficha en piezas a partir del nombre de la caja. */
export function piecePresentationName(name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const replaced = trimmed
    .replace(/\s*\d+\s*bolsas?\s*\/\s*caja\b/i, " pieza")
    .replace(/\s*\d+\s*\/\s*caja\b/i, " pieza")
    .replace(/\s+/g, " ")
    .trim();
  if (replaced !== trimmed) return replaced;
  if (/\bpiezas?\b/i.test(trimmed)) return trimmed;
  return `${trimmed} pieza`;
}

/** Presentaciones en piezas del mismo artículo: la guardada, el mismo n.º de parte o el mismo nombre. */
export function suggestPieceProducts(box: InventoryItem, products: InventoryItem[]) {
  const pieces = products.filter(
    (item) =>
      item.id !== box.id &&
      item.isActive &&
      item.unit === "pieza" &&
      item.itemKind !== "equipo"
  );
  const part = box.partNumber.trim().toLowerCase();
  const byPart = part
    ? pieces.filter((item) => item.partNumber.trim().toLowerCase() === part)
    : [];
  const byName = pieces.filter((item) => looseName(item.name) === looseName(box.name));
  const saved = box.pieceProductId
    ? pieces.find((item) => item.id === box.pieceProductId)
    : undefined;

  const ordered = [saved, ...byPart, ...byName].filter(
    (item): item is InventoryItem => Boolean(item)
  );
  const seen = new Set<string>();
  return ordered.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function openBoxToPieces(input: {
  boxProductId: string;
  pieceProductId: string;
  boxes: number;
  piecesPerBox: number;
  warehouseId: string;
  locationId: string;
  lotNumber?: string | null;
  expiryDate?: string | null;
  createdBy: string;
  note?: string;
}): Promise<BoxOpeningResult> {
  const { data, error } = await db.rpc("open_box_to_pieces", {
    p_box_product_id: input.boxProductId,
    p_piece_product_id: input.pieceProductId,
    p_boxes: input.boxes,
    p_pieces_per_box: input.piecesPerBox,
    p_warehouse_id: input.warehouseId,
    p_location_id: input.locationId,
    p_lot_number: input.lotNumber?.trim() || null,
    p_expiry_date: input.expiryDate || null,
    p_created_by: input.createdBy,
    p_note: input.note ?? "",
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("La apertura no devolvió folio.");
  return {
    boxFolio: String(row.box_folio ?? ""),
    pieceFolio: String(row.piece_folio ?? ""),
    piecesAdded: Number(row.pieces_added ?? 0),
    boxesLeft: Number(row.boxes_left ?? 0),
    pieceQuantity: Number(row.piece_quantity ?? 0),
  };
}

export async function listRecentBoxOpenings(): Promise<BoxOpeningRecord[]> {
  const { data, error } = await db
    .from("inventory_movements")
    .select(
      "id, folio, occurred_at, product_sku, product_name, qty_in, qty_out, note, created_by"
    )
    .eq("reason", "apertura_caja")
    .order("occurred_at", { ascending: false })
    .limit(12);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    folio: String(row.folio ?? ""),
    occurredAt: String(row.occurred_at ?? ""),
    productSku: String(row.product_sku ?? ""),
    productName: String(row.product_name ?? ""),
    qtyIn: Number(row.qty_in ?? 0),
    qtyOut: Number(row.qty_out ?? 0),
    note: String(row.note ?? ""),
    createdBy: String(row.created_by ?? ""),
  }));
}
