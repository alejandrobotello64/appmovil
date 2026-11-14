import { supabase } from "@/lib/supabase/client";
import {
  getInventoryItemsByIds,
  setInventoryItemBarcodes,
} from "@/lib/inventory/storage";
import type { InventoryItem } from "@/lib/inventory/types";
import { normalizeBarcode, parseScan, type ParsedScan } from "./codes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Row = Record<string, unknown>;

export type ScanMatchKind =
  | "barcode"
  | "sku"
  | "part_number"
  | "serial"
  | "lot"
  | "equipment_serial";

export const SCAN_MATCH_LABELS: Record<ScanMatchKind, string> = {
  barcode: "Código de barras",
  sku: "SKU / etiqueta QR",
  part_number: "Número de parte",
  serial: "Número de serie",
  lot: "Lote",
  equipment_serial: "Serie del equipo",
};

export type ScanMatch = {
  item: InventoryItem;
  kind: ScanMatchKind;
  lotNumber?: string;
  serialNumber?: string;
  expiryDate?: string;
};

export type ScanResult = {
  scan: ParsedScan;
  matches: ScanMatch[];
};

/** Comillas de PostgREST: la barra invertida escapa cualquier carácter. */
function quoted(value: string) {
  return `"${value.replace(/[\\"]/g, (char) => `\\${char}`)}"`;
}

/** Filtro `or` de igualdad sin distinguir mayúsculas (sin comodines de ilike). */
function exactIlike(column: string, value: string) {
  const pattern = value.replace(/[\\%_]/g, (char) => `\\${char}`);
  return `${column}.ilike.${quoted(pattern)}`;
}

/** Literal de arreglo de Postgres para `overlaps`, seguro con comas y llaves. */
function pgArray(values: string[]) {
  return `{${values.map(quoted).join(",")}}`;
}

function anyOf(column: string, values: string[]) {
  return values.map((value) => exactIlike(column, value)).join(",");
}

function caseVariants(values: string[]) {
  const set = new Set<string>();
  for (const value of values) {
    set.add(value);
    set.add(value.toUpperCase());
    set.add(value.toLowerCase());
  }
  return [...set];
}

async function idsWhere(table: string, select: string, filter: string) {
  const { data, error } = await db.from(table).select(select).or(filter).limit(25);
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

export async function resolveScan(raw: string): Promise<ScanResult> {
  const scan = parseScan(raw);
  const candidates = scan.candidates;
  if (!candidates.length) return { scan, matches: [] };

  const found = new Map<string, Omit<ScanMatch, "item">>();
  const add = (productId: unknown, match: Omit<ScanMatch, "item">) => {
    const id = productId ? String(productId) : "";
    if (id && !found.has(id)) found.set(id, match);
  };
  const gs1 = scan.gs1;
  const fromGs1 = {
    lotNumber: gs1?.lot,
    serialNumber: gs1?.serial,
    expiryDate: gs1?.expiry,
  };

  const { data: byBarcode, error: barcodeError } = await supabase
    .from("inventory_items")
    .select("id")
    .overlaps("barcodes", pgArray(caseVariants(candidates)))
    .limit(25);
  if (barcodeError) throw new Error(barcodeError.message);
  for (const row of byBarcode ?? []) add(row.id, { kind: "barcode", ...fromGs1 });

  if (!found.size) {
    const rows = await idsWhere(
      "inventory_items",
      "id, sku, part_number",
      `${anyOf("sku", candidates)},${anyOf("part_number", candidates)}`
    );
    const lower = new Set(candidates.map((value) => value.toLowerCase()));
    for (const row of rows) {
      const kind = lower.has(String(row.sku ?? "").toLowerCase()) ? "sku" : "part_number";
      add(row.id, { kind, ...fromGs1 });
    }
  }

  if (!found.size) {
    const serials = [...new Set([gs1?.serial, scan.code].filter(Boolean) as string[])];
    const rows = await idsWhere(
      "serial_numbers",
      "product_id, serial_number",
      anyOf("serial_number", serials)
    );
    for (const row of rows) {
      add(row.product_id, {
        kind: "serial",
        serialNumber: String(row.serial_number ?? ""),
        lotNumber: gs1?.lot,
        expiryDate: gs1?.expiry,
      });
    }
  }

  if (!found.size) {
    const lots = [...new Set([gs1?.lot, scan.code].filter(Boolean) as string[])];
    const rows = await idsWhere(
      "lots",
      "product_id, lot_number, expiry_date",
      anyOf("lot_number", lots)
    );
    for (const row of rows) {
      add(row.product_id, {
        kind: "lot",
        lotNumber: String(row.lot_number ?? ""),
        expiryDate: row.expiry_date ? String(row.expiry_date) : gs1?.expiry,
      });
    }
  }

  if (!found.size) {
    const rows = await idsWhere(
      "inventory_items",
      "id",
      anyOf("serial_number", [scan.code])
    );
    for (const row of rows) add(row.id, { kind: "equipment_serial", serialNumber: scan.code });
  }

  const items = await getInventoryItemsByIds([...found.keys()]);
  const matches = items
    .map((item) => ({ item, ...found.get(item.id)! }))
    .sort((a, b) => Number(b.item.isActive) - Number(a.item.isActive));
  return { scan, matches };
}

/** Código que conviene guardar en el producto (GTIN si es GS1). */
export function linkableCode(scan: ParsedScan) {
  return scan.gs1?.gtin ?? scan.code;
}

/** Productos que ya tienen asignado el código (para evitar duplicados). */
export async function productsWithBarcode(code: string, exceptId?: string) {
  const value = normalizeBarcode(code);
  if (!value) return [];
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, sku, name")
    .overlaps("barcodes", pgArray(caseVariants([value])))
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? []).filter((row) => row.id !== exceptId);
}

export async function addProductBarcode(item: InventoryItem, code: string) {
  const value = normalizeBarcode(code);
  if (!value) throw new Error("El código está vacío.");
  const taken = await productsWithBarcode(value, item.id);
  if (taken.length) {
    throw new Error(
      `El código ya está asignado a ${taken.map((row) => `${row.sku} ${row.name}`).join(", ")}.`
    );
  }
  return setInventoryItemBarcodes(item.id, [...(item.barcodes ?? []), value]);
}
