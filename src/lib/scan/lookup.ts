import { supabase } from "@/lib/supabase/client";
import {
  getInventoryItemsByIds,
  setInventoryItemBarcodes,
} from "@/lib/inventory/storage";
import type { InventoryItem } from "@/lib/inventory/types";
import {
  hillRomBedAliases,
  isHillRomPartNumber,
  normalizeBarcode,
  parseScan,
  type ParsedScan,
} from "./codes";

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

function isEquipmentRow(item: InventoryItem) {
  return item.itemKind === "equipo" || item.category === "equipos";
}

function matchRank(match: ScanMatch, scannedCode = "") {
  const kindOrder: Record<ScanMatchKind, number> = {
    barcode: 0,
    sku: 1,
    part_number: 2,
    serial: 3,
    equipment_serial: 4,
    lot: 5,
  };
  const code = scannedCode.trim().toLowerCase();
  const exactCode =
    !!code &&
    [match.item.sku, match.item.partNumber, ...(match.item.barcodes ?? [])]
      .filter(Boolean)
      .some((value) => String(value).trim().toLowerCase() === code);
  // Un n.º de parte exacto (refacción HR900…) gana a un alias de cama/equipo.
  const exactPartBonus = exactCode && (match.kind === "part_number" || match.kind === "sku") ? -40 : 0;
  const exactAnyBonus = exactCode ? -25 : 0;
  return (
    (match.item.isActive === false ? 100 : 0) +
    exactPartBonus +
    exactAnyBonus +
    (isEquipmentRow(match.item) ? 0 : 20) +
    (kindOrder[match.kind] ?? 9)
  );
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
  const serialHint = gs1?.serial || "";
  const partHint = gs1?.ais?.["241"] || "";
  const fromGs1 = {
    lotNumber: gs1?.lot,
    serialNumber: serialHint || undefined,
    expiryDate: gs1?.expiry,
  };

  // Primero n.º de parte / SKU exactos del código crudo (evita que HR900… vaya a la cama).
  {
    const primaryKeys = [
      ...new Set(
        [scan.code, scan.code.replace(/^21/i, ""), partHint, serialHint].filter(Boolean)
      ),
    ];
    if (primaryKeys.length) {
      const rows = await idsWhere(
        "inventory_items",
        "id, sku, part_number, item_kind, category",
        `${anyOf("sku", primaryKeys)},${anyOf("part_number", primaryKeys)}`
      );
      const lower = new Set(primaryKeys.map((value) => value.toLowerCase()));
      for (const row of rows) {
        const kind = lower.has(String(row.sku ?? "").toLowerCase())
          ? "sku"
          : "part_number";
        add(row.id, { kind, ...fromGs1 });
      }
    }
  }

  // Si ya hay match exacto de refacción/parte, no ampliar con aliases de cama.
  const skipBedAliasExpand = [...found.values()].some(
    (match) => match.kind === "part_number" || match.kind === "sku"
  ) || isHillRomPartNumber(scan.code);

  const lookupCandidates = skipBedAliasExpand
    ? candidates.filter(
        (value) =>
          !["centuris", "centuris pro", "li900b1", "cs900b1", "hr900", "cs900", "li900"].includes(
            value.toLowerCase()
          )
      )
    : candidates;

  const { data: byBarcode, error: barcodeError } = await supabase
    .from("inventory_items")
    .select("id")
    .overlaps("barcodes", pgArray(caseVariants(lookupCandidates)))
    .limit(25);
  if (barcodeError) throw new Error(barcodeError.message);
  for (const row of byBarcode ?? []) {
    add(row.id, {
      kind: "barcode",
      ...fromGs1,
      serialNumber: serialHint || fromGs1.serialNumber,
    });
  }

  // SKU / n.º de parte restantes (candidatos amplios, sin pisar matches ya hallados).
  if (!skipBedAliasExpand) {
    const keys = [...new Set([...lookupCandidates, partHint].filter(Boolean))];
    if (keys.length) {
      const rows = await idsWhere(
        "inventory_items",
        "id, sku, part_number, item_kind, category",
        `${anyOf("sku", keys)},${anyOf("part_number", keys)}`
      );
      const lower = new Set(keys.map((value) => value.toLowerCase()));
      for (const row of rows) {
        const kind = lower.has(String(row.sku ?? "").toLowerCase())
          ? "sku"
          : "part_number";
        add(row.id, { kind, ...fromGs1 });
      }
    }
  }

  if (!found.size || serialHint) {
    const serials = [...new Set([serialHint, scan.code].filter(Boolean))];
    if (serials.length) {
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
    const serials = [...new Set([serialHint, scan.code].filter(Boolean))];
    const rows = await idsWhere(
      "inventory_items",
      "id",
      anyOf("serial_number", serials)
    );
    for (const row of rows) {
      add(row.id, {
        kind: "equipment_serial",
        serialNumber: serialHint || scan.code,
      });
    }
  }

  // Serie registrada en equipos de cliente → producto de catálogo por modelo/nombre.
  if (!found.size && !isHillRomPartNumber(scan.code)) {
    const serials = [...new Set([serialHint, scan.code, scan.code.replace(/^21/i, "")].filter(Boolean))];
    if (serials.length) {
      const rows = await idsWhere(
        "client_equipment",
        "serial_number, name, brand, model",
        anyOf("serial_number", serials)
      );
      for (const row of rows) {
        const needles = [
          String(row.model ?? ""),
          String(row.name ?? ""),
          ...hillRomBedAliases(String(row.serial_number ?? "")),
          ...hillRomBedAliases(String(row.model ?? "")),
        ].filter((value) => value.trim().length >= 3);
        for (const needle of needles.slice(0, 6)) {
          const pattern = `%${needle.replace(/[%_]/g, "")}%`;
          const { data, error } = await db
            .from("inventory_items")
            .select("id, item_kind, category")
            .or(`model.ilike.${quoted(pattern)},name.ilike.${quoted(pattern)}`)
            .eq("item_kind", "equipo")
            .limit(10);
          if (error) throw new Error(error.message);
          for (const item of (data ?? []) as Row[]) {
            add(item.id, {
              kind: "equipment_serial",
              serialNumber: String(row.serial_number ?? serialHint ?? scan.code),
            });
          }
          if (found.size) break;
        }
        if (found.size) break;
      }
    }
  }

  // Último recurso: modelo / nombre (Centuris, Vista 120…) — no buscar part_number con alias de cama.
  if (!found.size && !isHillRomPartNumber(scan.code)) {
    const baseTokens = lookupCandidates.filter(
      (value) => /[A-Za-z]/.test(value) && value.length >= 4 && !/^HRP\d+$/i.test(value)
    );
    const bedTokens = [
      ...hillRomBedAliases(serialHint),
      ...hillRomBedAliases(partHint),
      ...baseTokens.flatMap((token) => hillRomBedAliases(token)),
    ];
    const tokens = [...baseTokens, ...bedTokens];
    const seenToken = new Set<string>();
    for (const token of tokens) {
      const key = token.toLowerCase();
      if (seenToken.has(key) || token.length < 4) continue;
      seenToken.add(key);
      if (seenToken.size > 10) break;
      const pattern = `%${token.replace(/[%_]/g, "")}%`;
      const isBedAlias = bedTokens.some((value) => value.toLowerCase() === key);
      const { data, error } = await db
        .from("inventory_items")
        .select("id, item_kind, category")
        .or(
          isBedAlias
            ? `model.ilike.${quoted(pattern)},name.ilike.${quoted(pattern)}`
            : `model.ilike.${quoted(pattern)},name.ilike.${quoted(pattern)},part_number.ilike.${quoted(pattern)},sku.ilike.${quoted(pattern)}`
        )
        .limit(15);
      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as Row[]) {
        const kind = String(row.item_kind ?? "");
        const category = String(row.category ?? "");
        if (isBedAlias && kind !== "equipo" && category !== "equipos") continue;
        add(row.id, {
          kind: "part_number",
          serialNumber: serialHint || undefined,
        });
      }
      if (found.size) break;
    }
  }

  const items = await getInventoryItemsByIds([...found.keys()]);
  const preferredCode = scan.code.replace(/^21/i, "") || scan.code;
  const matches = items
    .map((item) => ({ item, ...found.get(item.id)! }))
    .sort((a, b) => matchRank(a, preferredCode) - matchRank(b, preferredCode));
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
