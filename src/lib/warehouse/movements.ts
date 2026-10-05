import { supabase } from "@/lib/supabase/client";
import { applyStockMovement } from "@/lib/warehouse/stock";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Row = Record<string, unknown>;

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));

export type MovementKind =
  | "entrada"
  | "salida"
  | "traspaso"
  | "cambio_ubicacion"
  | "canje_caducado"
  | "devolucion"
  | "ajuste";

export const MOVEMENT_KIND_LABELS: Record<MovementKind, string> = {
  entrada: "Entrada",
  salida: "Salida",
  traspaso: "Traspaso",
  cambio_ubicacion: "Cambio de ubicación",
  canje_caducado: "Canje caducado",
  devolucion: "Devolución",
  ajuste: "Ajuste",
};

export type MovementPlace = {
  warehouseId: string;
  warehouseCode: string;
  locationName: string;
};

export type MovementRecord = {
  id: string;
  folio: string;
  occurredAt: string;
  kind: MovementKind;
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  quantity: number;
  qtyIn: number;
  qtyOut: number;
  resultingQty: number;
  from: MovementPlace | null;
  to: MovementPlace | null;
  lotNumber: string;
  lotExpiry: string;
  serials: string;
  reason: string;
  note: string;
  technician: string;
  createdBy: string;
};

export function placeLabel(place: MovementPlace | null) {
  if (!place) return "";
  return [place.warehouseCode, place.locationName].filter(Boolean).join(" — ");
}

function place(warehouse: unknown, location: unknown): MovementPlace | null {
  const wh = (warehouse ?? null) as Row | null;
  const loc = (location ?? null) as Row | null;
  if (!wh && !loc) return null;
  return {
    warehouseId: str(wh?.id),
    warehouseCode: str(wh?.code),
    locationName: str(loc?.name),
  };
}

function mapMovement(row: Row): MovementRecord {
  const rawType = str(row.movement_type);
  const reason = str(row.reason);
  const kind = (
    /^canje/i.test(reason) && (rawType === "entrada" || rawType === "salida")
      ? "canje_caducado"
      : rawType
  ) as MovementKind;
  const qtyIn = Number(row.qty_in ?? 0);
  const qtyOut = Number(row.qty_out ?? 0);
  const isMove = rawType === "traspaso" || rawType === "cambio_ubicacion";
  const here = place(row.warehouse, row.location);
  const lot = (row.lot ?? {}) as Row;
  const product = (row.product ?? {}) as Row;

  return {
    id: str(row.id),
    folio: str(row.folio),
    occurredAt: str(row.occurred_at),
    kind,
    productId: str(row.product_id),
    productSku: str(row.product_sku),
    productName: str(row.product_name),
    unit: str(product.unit),
    quantity: Math.max(qtyIn, qtyOut),
    qtyIn,
    qtyOut,
    resultingQty: Number(row.resulting_qty ?? 0),
    from: isMove ? place(row.from_warehouse, row.from_location) : qtyOut > 0 ? here : null,
    to: isMove ? place(row.to_warehouse, row.to_location) : qtyIn > 0 ? here : null,
    lotNumber: str(lot.lot_number),
    lotExpiry: str(lot.expiry_date),
    serials: str(row.related_serial),
    reason,
    note: str(row.note),
    technician: str(row.related_technician),
    createdBy: str(row.created_by),
  };
}

const MOVEMENT_SELECT = `id, folio, occurred_at, movement_type, product_id, product_sku, product_name,
  qty_in, qty_out, resulting_qty, reason, note, created_by, related_serial, related_technician,
  product:inventory_items(unit),
  warehouse:warehouses!inventory_movements_warehouse_id_fkey(id, code),
  location:locations!inventory_movements_location_id_fkey(name),
  from_warehouse:warehouses!inventory_movements_from_warehouse_id_fkey(id, code),
  from_location:locations!inventory_movements_from_location_id_fkey(name),
  to_warehouse:warehouses!inventory_movements_to_warehouse_id_fkey(id, code),
  to_location:locations!inventory_movements_to_location_id_fkey(name),
  lot:lots(lot_number, expiry_date)`;

export async function getMovementsByFolio(folios: string[]): Promise<MovementRecord[]> {
  const list = folios.map((folio) => folio.trim()).filter(Boolean);
  if (!list.length) return [];
  const { data, error } = await db
    .from("inventory_movements")
    .select(MOVEMENT_SELECT)
    .in("folio", list)
    .order("occurred_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(mapMovement);
}

/**
 * Registros que forman un mismo documento: los del mismo folio y, en un canje con
 * lote distinto, la salida y la entrada del mismo producto registradas juntas.
 */
export function relatedMovements(movement: MovementRecord, all: MovementRecord[]) {
  const sameFolio = (item: MovementRecord) => Boolean(movement.folio) && item.folio === movement.folio;
  if (movement.kind !== "canje_caducado") {
    const group = all.filter(sameFolio);
    return group.length ? group : [movement];
  }
  const at = new Date(movement.occurredAt).getTime();
  const group = all.filter(
    (item) =>
      sameFolio(item) ||
      (item.kind === "canje_caducado" &&
        item.productId === movement.productId &&
        item.createdBy === movement.createdBy &&
        Math.abs(new Date(item.occurredAt).getTime() - at) <= 2 * 60 * 1000)
  );
  return (group.length ? group : [movement]).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

export async function getMovementHistory(options: {
  from?: string;
  to?: string;
  limit?: number;
} = {}): Promise<MovementRecord[]> {
  let query = db
    .from("inventory_movements")
    .select(MOVEMENT_SELECT)
    .order("occurred_at", { ascending: false })
    .limit(options.limit ?? 500);
  if (options.from) query = query.gte("occurred_at", `${options.from}T00:00:00`);
  if (options.to) query = query.lte("occurred_at", `${options.to}T23:59:59.999`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(mapMovement);
}

export type StockBalance = {
  id: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  locationId: string;
  locationName: string;
  lotId: string | null;
  lotNumber: string;
  expiryDate: string;
  onHand: number;
  reserved: number;
  available: number;
};

export type StockSerial = {
  serialNumber: string;
  warehouseId: string;
  locationId: string;
};

/** Existencias del producto por almacén, ubicación y lote, más sus series disponibles. */
export async function getProductStock(
  productId: string
): Promise<{ balances: StockBalance[]; serials: StockSerial[] }> {
  const [balancesRes, serialsRes] = await Promise.all([
    db
      .from("inventory_balances")
      .select(
        "id, qty_on_hand, qty_reserved, lot_id, warehouse:warehouses(id, code, name), location:locations(id, name), lot:lots(lot_number, expiry_date)"
      )
      .eq("product_id", productId)
      .gt("qty_on_hand", 0),
    db
      .from("serial_numbers")
      .select("serial_number, warehouse_id, location_id")
      .eq("product_id", productId)
      .eq("status", "disponible")
      .order("serial_number"),
  ]);
  if (balancesRes.error) throw new Error(balancesRes.error.message);
  if (serialsRes.error) throw new Error(serialsRes.error.message);

  const balances = ((balancesRes.data ?? []) as Row[]).map((row) => {
    const warehouse = (row.warehouse ?? {}) as Row;
    const location = (row.location ?? {}) as Row;
    const lot = (row.lot ?? {}) as Row;
    const onHand = Number(row.qty_on_hand ?? 0);
    const reserved = Number(row.qty_reserved ?? 0);
    return {
      id: str(row.id),
      warehouseId: str(warehouse.id),
      warehouseCode: str(warehouse.code),
      warehouseName: str(warehouse.name),
      locationId: str(location.id),
      locationName: str(location.name),
      lotId: row.lot_id ? str(row.lot_id) : null,
      lotNumber: str(lot.lot_number),
      expiryDate: str(lot.expiry_date),
      onHand,
      reserved,
      available: Math.max(0, onHand - reserved),
    };
  });
  balances.sort(
    (a, b) =>
      a.warehouseCode.localeCompare(b.warehouseCode) ||
      a.locationName.localeCompare(b.locationName) ||
      (a.expiryDate || "9999").localeCompare(b.expiryDate || "9999")
  );

  const serials = ((serialsRes.data ?? []) as Row[]).map((row) => ({
    serialNumber: str(row.serial_number),
    warehouseId: str(row.warehouse_id),
    locationId: str(row.location_id),
  }));

  return { balances, serials };
}

/** Series disponibles que pertenecen al saldo de origen (mismo almacén y ubicación o sin ubicación). */
export function serialsForBalance(serials: StockSerial[], balance: StockBalance) {
  return serials.filter(
    (serial) =>
      serial.warehouseId === balance.warehouseId &&
      (!serial.locationId || serial.locationId === balance.locationId)
  );
}

export type MoveStockResult = {
  folio: string;
  movedQty: number;
  locationName: string;
};

export async function moveStock(input: {
  productId: string;
  source: StockBalance;
  quantity: number;
  toWarehouseId: string;
  toLocationId?: string | null;
  toLocationName?: string | null;
  serialNumbers?: string[];
  note?: string;
  createdBy: string;
}): Promise<MoveStockResult> {
  const { data, error } = await db.rpc("move_stock", {
    p_product_id: input.productId,
    p_from_warehouse_id: input.source.warehouseId,
    p_from_location_id: input.source.locationId || null,
    p_lot_id: input.source.lotId,
    p_quantity: input.quantity,
    p_to_warehouse_id: input.toWarehouseId,
    p_to_location_id: input.toLocationId || null,
    p_to_location_name: input.toLocationName?.trim() || null,
    p_serial_numbers: input.serialNumbers?.length ? input.serialNumbers : null,
    p_note: input.note ?? "",
    p_created_by: input.createdBy,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("El movimiento no devolvió folio.");
  return {
    folio: str(row.folio),
    movedQty: Number(row.moved_qty ?? 0),
    locationName: str(row.target_location_name),
  };
}

export async function exchangeExpiredProduct(input: {
  productId: string;
  source: StockBalance;
  quantity: number;
  supplierName: string;
  newLotNumber: string;
  newExpiryDate: string;
  note?: string;
  createdBy: string;
}): Promise<string[]> {
  const outgoingLot = input.source.lotNumber.trim();
  const newLot = input.newLotNumber.trim();
  if (!outgoingLot) throw new Error("La existencia seleccionada no tiene lote.");
  if (!newLot) throw new Error("Indica el lote nuevo que entrega el proveedor.");
  if (input.quantity <= 0) throw new Error("La cantidad a canjear debe ser mayor a 0.");
  if (input.quantity > input.source.available) {
    throw new Error(`Solo hay ${input.source.available} disponible(s) en ese lote.`);
  }
  if (!input.supplierName.trim()) throw new Error("Indica el proveedor del canje.");
  if (!input.newExpiryDate) throw new Error("Indica la nueva fecha de caducidad.");

  const common = {
    productId: input.productId,
    quantity: input.quantity,
    createdBy: input.createdBy,
    note: [input.note?.trim(), `Lote canjeado: ${outgoingLot}`, `Lote nuevo: ${newLot}`]
      .filter(Boolean)
      .join(" · "),
    supplierName: input.supplierName.trim(),
    warehouseId: input.source.warehouseId,
    locationId: input.source.locationId || null,
  };

  if (outgoingLot === newLot) {
    const result = await applyStockMovement({
      ...common,
      movementType: "canje_caducado",
      expiryDate: input.newExpiryDate,
      lotNumber: newLot,
      reason: "Canje de insumo caducado",
    });
    return [result.folio];
  }

  const out = await applyStockMovement({
    ...common,
    movementType: "salida",
    lotNumber: outgoingLot,
    reason: "Canje caducado · salida de lote",
  });
  const entry = await applyStockMovement({
    ...common,
    movementType: "entrada",
    expiryDate: input.newExpiryDate,
    lotNumber: newLot,
    reason: "Canje caducado · entrada de lote nuevo",
  });
  return [out.folio, entry.folio];
}
