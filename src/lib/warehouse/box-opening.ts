import type { InventoryItem } from "@/lib/inventory/types";
import { supabase } from "@/lib/supabase/client";
import { applyStockMovement } from "@/lib/warehouse/stock";

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

/** Cuántas piezas trae la caja o el paquete, si el nombre lo dice. */
export function piecesPerBoxFromName(name: string): number | null {
  const match =
    name.match(/(\d+)\s*bolsas?\s*\/\s*caja/i) ||
    name.match(/(\d+)\s*pz(?:as?)?\s*\/\s*caja/i) ||
    name.match(/(\d+)\s*\/\s*caja/i) ||
    name.match(/(\d+)\s*pz(?:as?)?\s*\/\s*bolsa/i) ||
    name.match(/(\d+)\s*\/\s*case/i) ||
    name.match(/(\d+)\s*(?:uds?\.?|unidades|piezas|pzas?)\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isInteger(value) || value <= 0 || value > 100000) return null;
  return value;
}

/** Nombre de la ficha en piezas: quita el empaque y deja la palabra pieza. */
export function piecePresentationName(name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const replaced = trimmed
    .replace(/\s*\d+\s*bolsas?\s*\/\s*caja\b/i, " pieza")
    .replace(/\s*\d+\s*pz(?:as?)?\s*\/\s*caja\b/i, " pieza")
    .replace(/\s*\d+\s*\/\s*caja\b/i, " pieza")
    .replace(/\s*\d+\s*pz(?:as?)?\s*\/\s*bolsa\b/i, " pieza")
    .replace(/\s+/g, " ")
    .trim();
  if (replaced !== trimmed) return replaced;
  if (/\bpiezas?\s*$/i.test(trimmed)) return trimmed;
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
  if (error) {
    if (!/schema cache|open_box_to_pieces/i.test(error.message ?? "")) {
      throw new Error(error.message);
    }
    return openBoxWithMovements(input);
  }
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

export type QuickOpenTarget = {
  productId: string;
  partNumber: string;
  unit: string;
  pending: number;
  available: number;
};

export type QuickOpenBalance = {
  id: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  locationId: string;
  locationName: string;
  lotNumber: string;
  expiryDate: string;
  available: number;
};

export type QuickOpenBox = {
  boxId: string;
  sku: string;
  name: string;
  partNumber: string;
  model: string;
  piecesPerUnit: number | null;
  pieceId: string;
  pieceSku: string;
  pieceName: string;
  pieceModel: string;
  /** Piezas que aún faltan del pedido, descontando lo ya disponible. */
  shortage: number;
  balances: QuickOpenBalance[];
};

async function openBoxWithMovements(input: {
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
  if (!input.createdBy.trim()) throw new Error("La apertura requiere un usuario responsable");
  if (!Number.isInteger(input.boxes) || input.boxes <= 0) {
    throw new Error("Indica cuántas cajas vas a abrir");
  }
  if (!Number.isInteger(input.piecesPerBox) || input.piecesPerBox <= 0) {
    throw new Error("Indica cuántas piezas trae cada caja");
  }
  if (input.boxes > 100000 || input.piecesPerBox > 100000) {
    throw new Error("La cantidad es demasiado grande");
  }
  if (input.boxProductId === input.pieceProductId) {
    throw new Error("La presentación en piezas debe ser otro código");
  }

  const { data: products, error: productError } = await db
    .from("inventory_items")
    .select("id, sku, unit, is_active")
    .in("id", [input.boxProductId, input.pieceProductId]);
  if (productError) throw new Error(productError.message);
  const box = (products ?? []).find((row: { id: string }) => row.id === input.boxProductId);
  const piece = (products ?? []).find((row: { id: string }) => row.id === input.pieceProductId);
  if (!box) throw new Error("No se encontró el artículo en caja");
  if (box.is_active === false) throw new Error("El artículo en caja está inactivo");
  if (box.unit !== "caja" && box.unit !== "paquete") {
    throw new Error("El artículo de origen debe estar en unidad caja o paquete");
  }
  if (!piece) throw new Error("No se encontró la presentación en piezas");
  if (piece.is_active === false) throw new Error("La presentación en piezas está inactiva");
  if (piece.unit !== "pieza") throw new Error("El destino debe ser un artículo en piezas");

  const pieces = input.boxes * input.piecesPerBox;
  const extra = input.note?.trim();
  const note = [
    `Apertura de ${input.boxes} ${box.unit}(s) × ${input.piecesPerBox} = ${pieces} piezas. ${box.sku} → ${piece.sku}.`,
    extra,
  ]
    .filter(Boolean)
    .join(" ");
  const lotNumber = input.lotNumber?.trim() || null;
  const expiryDate = input.expiryDate || null;

  const boxMove = await applyStockMovement({
    productId: input.boxProductId,
    movementType: "salida",
    quantity: input.boxes,
    note,
    createdBy: input.createdBy,
    reason: "apertura_caja",
    warehouseId: input.warehouseId,
    locationId: input.locationId,
    lotNumber,
    expiryDate,
  });

  let pieceMove;
  try {
    pieceMove = await applyStockMovement({
      productId: input.pieceProductId,
      movementType: "entrada",
      quantity: pieces,
      note,
      createdBy: input.createdBy,
      reason: "apertura_caja",
      warehouseId: input.warehouseId,
      locationId: input.locationId,
      lotNumber,
      expiryDate,
    });
  } catch (pieceError) {
    await applyStockMovement({
      productId: input.boxProductId,
      movementType: "entrada",
      quantity: input.boxes,
      note: `Reverso de apertura. ${note}`,
      createdBy: input.createdBy,
      reason: "apertura_caja",
      warehouseId: input.warehouseId,
      locationId: input.locationId,
      lotNumber,
      expiryDate,
    }).catch(() => undefined);
    throw pieceError;
  }

  const { error: linkError } = await db
    .from("inventory_items")
    .update({
      pieces_per_unit: input.piecesPerBox,
      piece_product_id: input.pieceProductId,
    })
    .eq("id", input.boxProductId);
  if (linkError) throw new Error(linkError.message);

  return {
    boxFolio: boxMove.folio,
    pieceFolio: pieceMove.folio,
    piecesAdded: pieces,
    boxesLeft: boxMove.newQuantity,
    pieceQuantity: pieceMove.newQuantity,
  };
}

function isPieceUnit(unit: string) {
  const value = unit.trim().toLowerCase();
  return value === "pieza" || value === "pza" || value === "piezas";
}

/** Cuántas cajas abren el faltante sin pasar la existencia de esa ubicación. */
export function suggestedBoxCount(shortage: number, perBox: number, available: number) {
  const cap = Math.max(0, Math.floor(available));
  if (cap <= 0 || shortage <= 0) return 0;
  if (!Number.isInteger(perBox) || perBox <= 0) return 1;
  const need = shortage > 0 ? Math.ceil(shortage / perBox) : 1;
  return Math.min(cap, Math.max(1, need));
}

type BoxRow = {
  id?: string;
  sku?: string;
  name?: string;
  model?: string;
  part_number?: string;
  pieces_per_unit?: number | null;
  piece_product_id?: string | null;
};

/** Cajas con existencia que alimentan las piezas pedidas en el surtimiento. */
export async function listQuickOpenBoxes(targets: QuickOpenTarget[]): Promise<QuickOpenBox[]> {
  const pieces = targets.filter((target) => target.productId && isPieceUnit(target.unit));
  const pieceIds = [...new Set(pieces.map((target) => target.productId))];
  const parts = [
    ...new Set(pieces.map((target) => target.partNumber.trim()).filter(Boolean)),
  ];
  if (!pieceIds.length && !parts.length) return [];

  const boxColumns = "id, sku, name, model, part_number, pieces_per_unit, piece_product_id";
  const boxColumnsLegacy = "id, sku, name, model, part_number";
  async function loadBoxes(columns: string, linkPieces: boolean) {
    const [linkedRes, partRes] = await Promise.all([
      linkPieces && pieceIds.length
        ? db
            .from("inventory_items")
            .select(columns)
            .eq("unit", "caja")
            .eq("is_active", true)
            .in("piece_product_id", pieceIds)
        : Promise.resolve({ data: [], error: null }),
      parts.length
        ? db
            .from("inventory_items")
            .select(columns)
            .eq("unit", "caja")
            .eq("is_active", true)
            .in("part_number", parts)
        : Promise.resolve({ data: [], error: null }),
    ]);
    return [linkedRes, partRes] as const;
  }
  let [linkedRes, partRes] = await loadBoxes(boxColumns, true);
  const columnError = linkedRes.error ?? partRes.error;
  if (
    columnError &&
    /pieces_per_unit|piece_product_id/i.test(columnError.message ?? "")
  ) {
    [linkedRes, partRes] = await loadBoxes(boxColumnsLegacy, false);
  }
  if (linkedRes.error) throw new Error(linkedRes.error.message);
  if (partRes.error) throw new Error(partRes.error.message);

  const byId = new Map<string, BoxRow>();
  for (const row of [...(linkedRes.data ?? []), ...(partRes.data ?? [])] as BoxRow[]) {
    if (row.id) byId.set(String(row.id), row);
  }
  const boxes = [...byId.values()];
  if (!boxes.length) return [];

  const destinationIds = [
    ...new Set(
      boxes.flatMap((row) => {
        const linked = row.piece_product_id ? String(row.piece_product_id) : "";
        if (linked && pieceIds.includes(linked)) return [linked];
        const part = String(row.part_number ?? "").trim().toLowerCase();
        const match = pieces.find((target) => target.partNumber.trim().toLowerCase() === part);
        return match ? [match.productId] : [];
      })
    ),
  ];
  const boxIds = boxes.map((row) => String(row.id));
  const [piecesRes, balancesRes] = await Promise.all([
    destinationIds.length
      ? db.from("inventory_items").select("id, sku, name, model").in("id", destinationIds)
      : Promise.resolve({ data: [], error: null }),
    db
      .from("inventory_balances")
      .select(
        "id, product_id, qty_on_hand, qty_reserved, warehouse:warehouses(id, code, name), location:locations(id, name), lot:lots(lot_number, expiry_date)"
      )
      .in("product_id", boxIds)
      .gt("qty_on_hand", 0),
  ]);
  if (piecesRes.error) throw new Error(piecesRes.error.message);
  if (balancesRes.error) throw new Error(balancesRes.error.message);

  const pieceById = new Map<string, { sku: string; name: string; model: string }>();
  for (const row of piecesRes.data ?? []) {
    pieceById.set(String(row.id), {
      sku: String(row.sku ?? ""),
      name: String(row.name ?? ""),
      model: String(row.model ?? ""),
    });
  }

  const balancesByBox = new Map<string, QuickOpenBalance[]>();
  for (const row of (balancesRes.data ?? []) as Record<string, unknown>[]) {
    const warehouse = (row.warehouse ?? {}) as Record<string, unknown>;
    const location = (row.location ?? {}) as Record<string, unknown>;
    const lot = (row.lot ?? {}) as Record<string, unknown>;
    const available = Math.max(0, Number(row.qty_on_hand ?? 0) - Number(row.qty_reserved ?? 0));
    if (available <= 0) continue;
    const productId = String(row.product_id ?? "");
    const list = balancesByBox.get(productId) ?? [];
    list.push({
      id: String(row.id),
      warehouseId: String(warehouse.id ?? ""),
      warehouseCode: String(warehouse.code ?? ""),
      warehouseName: String(warehouse.name ?? ""),
      locationId: String(location.id ?? ""),
      locationName: String(location.name ?? ""),
      lotNumber: String(lot.lot_number ?? ""),
      expiryDate: String(lot.expiry_date ?? ""),
      available,
    });
    balancesByBox.set(productId, list);
  }

  const result: QuickOpenBox[] = [];
  for (const row of boxes) {
    const boxId = String(row.id);
    const balances = (balancesByBox.get(boxId) ?? []).sort(
      (a, b) =>
        a.warehouseCode.localeCompare(b.warehouseCode) ||
        a.locationName.localeCompare(b.locationName) ||
        (a.expiryDate || "9999").localeCompare(b.expiryDate || "9999")
    );
    if (!balances.length) continue;
    const part = String(row.part_number ?? "").trim().toLowerCase();
    const linked = row.piece_product_id ? String(row.piece_product_id) : "";
    const pieceId = pieceIds.includes(linked)
      ? linked
      : !linked
        ? pieces.find((target) => target.partNumber.trim().toLowerCase() === part)?.productId ?? ""
        : "";
    if (!pieceId || pieceId === boxId) continue;
    const piece = pieceById.get(pieceId);
    if (!piece) continue;
    const pending = pieces
      .filter((target) => target.productId === pieceId)
      .reduce((sum, target) => sum + target.pending, 0);
    const onHand = pieces.find((target) => target.productId === pieceId)?.available ?? 0;
    const per = Number(row.pieces_per_unit ?? 0);
    result.push({
      boxId,
      sku: String(row.sku ?? ""),
      name: String(row.name ?? ""),
      partNumber: String(row.part_number ?? ""),
      model: String(row.model ?? ""),
      piecesPerUnit: per > 0 ? per : null,
      pieceId,
      pieceSku: piece.sku,
      pieceName: piece.name,
      pieceModel: piece.model,
      shortage: Math.max(0, pending - onHand),
      balances,
    });
  }
  result.sort((a, b) => b.shortage - a.shortage || a.name.localeCompare(b.name, "es"));
  return result;
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
