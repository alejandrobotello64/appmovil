import * as XLSX from "xlsx";
import type {
  AssetStatus,
  InventoryCategoryId,
  InventoryItem,
  InventoryItemInput,
  InventoryUnit,
  ItemKind,
} from "@/lib/inventory/types";
import {
  ASSET_STATUS_OPTIONS,
  INVENTORY_CATEGORIES,
  INVENTORY_UNITS,
} from "@/lib/inventory/types";

export const PRODUCT_EXCEL_HEADERS = [
  "sku",
  "nombre",
  "categoria",
  "tipo",
  "descripcion",
  "existencia",
  "stock_minimo",
  "unidad",
  "ubicacion",
  "marca",
  "modelo",
  "serie",
  "numero_parte",
  "precio",
  "proveedor",
  "fabricante",
  "caducidad",
  "notas",
  "subcategoria",
  "stock_maximo",
  "punto_reorden",
  "controla_lote",
  "controla_serie",
  "controla_caducidad",
  "estado_equipo",
  "ultimo_mantenimiento",
  "proximo_mantenimiento",
  "activo",
] as const;

export type ProductExcelRow = InventoryItemInput & { rowNumber: number };

export type ParsedProductWorkbook = {
  rows: ProductExcelRow[];
  errors: Array<{ row: number; sku: string; message: string }>;
};

const HEADER_ALIASES: Record<string, (typeof PRODUCT_EXCEL_HEADERS)[number]> = {
  sku: "sku",
  codigo: "sku",
  codigo_mas: "sku",
  code: "sku",
  nombre: "nombre",
  name: "nombre",
  producto: "nombre",
  categoria: "categoria",
  category: "categoria",
  tipo: "tipo",
  item_kind: "tipo",
  clase: "tipo",
  descripcion: "descripcion",
  description: "descripcion",
  existencia: "existencia",
  existencia_inicial: "existencia",
  cantidad: "existencia",
  stock: "existencia",
  quantity: "existencia",
  stock_minimo: "stock_minimo",
  min_stock: "stock_minimo",
  minimo: "stock_minimo",
  unidad: "unidad",
  unit: "unidad",
  ubicacion: "ubicacion",
  location: "ubicacion",
  marca: "marca",
  brand: "marca",
  modelo: "modelo",
  model: "modelo",
  serie: "serie",
  serial: "serie",
  numero_serie: "serie",
  numero_parte: "numero_parte",
  part_number: "numero_parte",
  n_parte: "numero_parte",
  precio: "precio",
  unit_price: "precio",
  costo: "precio",
  proveedor: "proveedor",
  supplier: "proveedor",
  fabricante: "fabricante",
  manufacturer: "fabricante",
  caducidad: "caducidad",
  expiry: "caducidad",
  fecha_caducidad: "caducidad",
  notas: "notas",
  notes: "notas",
  subcategoria: "subcategoria",
  stock_maximo: "stock_maximo",
  max_stock: "stock_maximo",
  punto_reorden: "punto_reorden",
  reorder_point: "punto_reorden",
  controla_lote: "controla_lote",
  tracks_lot: "controla_lote",
  lote: "controla_lote",
  controla_serie: "controla_serie",
  tracks_serial: "controla_serie",
  controla_caducidad: "controla_caducidad",
  tracks_expiry: "controla_caducidad",
  estado_equipo: "estado_equipo",
  asset_status: "estado_equipo",
  ultimo_mantenimiento: "ultimo_mantenimiento",
  proximo_mantenimiento: "proximo_mantenimiento",
  activo: "activo",
  is_active: "activo",
};

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeHeader(value: string) {
  return stripAccents(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function cellNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(",", ".").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cellBoolean(value: unknown, fallback = false): boolean {
  const text = cellText(value).toLowerCase();
  if (!text) return fallback;
  return ["si", "sí", "yes", "true", "1", "x", "activo"].includes(text);
}

function excelDate(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const epoch = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(epoch.getTime())) return epoch.toISOString().slice(0, 10);
  }
  const text = cellText(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return "";
}

function parseCategory(value: unknown): InventoryCategoryId {
  const raw = stripAccents(cellText(value)).toLowerCase();
  const match = INVENTORY_CATEGORIES.find(
    (item) => item.id === raw || stripAccents(item.label).toLowerCase() === raw
  );
  return match?.id ?? "otros";
}

function parseUnit(value: unknown): InventoryUnit {
  const raw = stripAccents(cellText(value)).toLowerCase();
  return (INVENTORY_UNITS as readonly string[]).includes(raw)
    ? (raw as InventoryUnit)
    : "pieza";
}

function parseKind(
  value: unknown,
  category: InventoryCategoryId,
  defaultKind: ItemKind
): ItemKind {
  const raw = stripAccents(cellText(value)).toLowerCase();
  if (raw === "equipo" || raw === "equipos" || raw === "activo") return "equipo";
  if (raw === "producto" || raw === "productos" || raw === "consumible") {
    return "producto";
  }
  if (category === "equipos") return "equipo";
  return defaultKind;
}

function parseAssetStatus(value: unknown): AssetStatus {
  const raw = stripAccents(cellText(value)).toLowerCase().replace(/\s+/g, "_");
  const match = ASSET_STATUS_OPTIONS.find(
    (item) =>
      item.id === raw || stripAccents(item.label).toLowerCase().replace(/\s+/g, "_") === raw
  );
  return match?.id ?? "operativo";
}

function yesNo(value: boolean) {
  return value ? "si" : "no";
}

export function itemToExcelRecord(item: InventoryItem): Record<string, string | number> {
  return {
    sku: item.sku,
    nombre: item.name,
    categoria: item.category,
    tipo: item.itemKind,
    descripcion: item.description,
    existencia: item.quantity,
    stock_minimo: item.minStock,
    unidad: item.unit,
    ubicacion: item.location,
    marca: item.brand,
    modelo: item.model,
    serie: item.serialNumber,
    numero_parte: item.partNumber,
    precio: item.unitPrice,
    proveedor: item.supplier,
    fabricante: item.manufacturer,
    caducidad: item.expiryDate,
    notas: item.notes,
    subcategoria: item.subcategory,
    stock_maximo: item.maxStock,
    punto_reorden: item.reorderPoint,
    controla_lote: yesNo(item.tracksLot),
    controla_serie: yesNo(item.tracksSerial),
    controla_caducidad: yesNo(item.tracksExpiry),
    estado_equipo: item.assetStatus,
    ultimo_mantenimiento: item.lastMaintenanceDate,
    proximo_mantenimiento: item.nextMaintenanceDate,
    activo: yesNo(item.isActive),
  };
}

function exampleRow(): Record<string, string | number> {
  return {
    sku: "INS-100",
    nombre: "Guantes de nitrilo talla M",
    categoria: "insumos",
    tipo: "producto",
    descripcion: "Caja con 100 piezas",
    existencia: 20,
    stock_minimo: 10,
    unidad: "caja",
    ubicacion: "Villahermosa",
    marca: "MAS",
    modelo: "",
    serie: "",
    numero_parte: "",
    precio: 185,
    proveedor: "",
    fabricante: "",
    caducidad: "2027-12-31",
    notas: "",
    subcategoria: "",
    stock_maximo: 80,
    punto_reorden: 15,
    controla_lote: "si",
    controla_serie: "no",
    controla_caducidad: "si",
    estado_equipo: "operativo",
    ultimo_mantenimiento: "",
    proximo_mantenimiento: "",
    activo: "si",
  };
}

function downloadWorkbook(workbook: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(workbook, filename);
}

function withInstructionSheet(workbook: XLSX.WorkBook) {
  const lines = [
    ["Plantilla de catálogo MAS"],
    ["1. Completa la hoja Productos. La primera fila son encabezados y no se importa."],
    ["2. sku y nombre son obligatorios. El sku no se debe repetir."],
    ["3. categoria: insumos, medicamentos, refacciones, accesorios, equipos, reactivos, otros."],
    ["4. tipo: producto o equipo. Si la categoria es equipos, se guarda como equipo."],
    ["5. existencia: solo se usa como stock inicial al crear un sku nuevo. No cambia existencias de productos que ya existen."],
    ["6. controla_lote, controla_serie, controla_caducidad y activo: si / no."],
    ["7. Fechas en formato AAAA-MM-DD. unidad: pieza, caja, paquete, litro, ml, kg, g, par, rollo, frasco."],
    ["8. Puedes exportar el catálogo, editarlo en Excel y volver a importarlo. Los sku existentes se actualizan."],
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(lines),
    "Instrucciones"
  );
}

export function downloadProductTemplate() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet([exampleRow()], {
    header: [...PRODUCT_EXCEL_HEADERS],
  });
  XLSX.utils.book_append_sheet(workbook, sheet, "Productos");
  withInstructionSheet(workbook);
  downloadWorkbook(workbook, "plantilla-catalogo-mas.xlsx");
}

export function exportProductsToExcel(items: InventoryItem[], filename?: string) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(items.map(itemToExcelRecord), {
    header: [...PRODUCT_EXCEL_HEADERS],
  });
  XLSX.utils.book_append_sheet(workbook, sheet, "Productos");
  withInstructionSheet(workbook);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadWorkbook(workbook, filename ?? `catalogo-mas-${stamp}.xlsx`);
}

export async function parseProductWorkbook(
  file: File,
  defaultKind: ItemKind = "producto"
): Promise<ParsedProductWorkbook> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName =
    workbook.SheetNames.find((name) => name.toLowerCase() === "productos") ??
    workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [{ row: 0, sku: "", message: "El archivo no tiene hojas." }] };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  if (matrix.length < 2) {
    return {
      rows: [],
      errors: [{ row: 1, sku: "", message: "No hay filas de productos. Descarga la plantilla." }],
    };
  }

  const headerCells = (matrix[0] ?? []).map((cell) => normalizeHeader(cellText(cell)));
  const columnMap = headerCells.map((header) => HEADER_ALIASES[header] ?? null);
  if (!columnMap.includes("sku") || !columnMap.includes("nombre")) {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          sku: "",
          message: "Faltan las columnas sku y nombre. Usa la plantilla de Excel.",
        },
      ],
    };
  }

  const rows: ProductExcelRow[] = [];
  const errors: ParsedProductWorkbook["errors"] = [];
  const seen = new Set<string>();

  for (let index = 1; index < matrix.length; index += 1) {
    const line = matrix[index] ?? [];
    const record: Partial<Record<(typeof PRODUCT_EXCEL_HEADERS)[number], unknown>> = {};
    columnMap.forEach((key, columnIndex) => {
      if (!key) return;
      record[key] = line[columnIndex];
    });

    const sku = cellText(record.sku);
    const name = cellText(record.nombre);
    const rowNumber = index + 1;
    const empty = !sku && !name && !cellText(record.categoria);
    if (empty) continue;

    if (!sku || !name) {
      errors.push({
        row: rowNumber,
        sku,
        message: "La fila necesita sku y nombre.",
      });
      continue;
    }

    const skuKey = sku.toLowerCase();
    if (seen.has(skuKey)) {
      errors.push({
        row: rowNumber,
        sku,
        message: "sku duplicado en el archivo.",
      });
      continue;
    }
    seen.add(skuKey);

    const category = parseCategory(record.categoria);
    const itemKind = parseKind(record.tipo, category, defaultKind);
    const resolvedCategory = itemKind === "equipo" ? "equipos" : category;
    const tracksExpiry = cellBoolean(
      record.controla_caducidad,
      resolvedCategory === "medicamentos" || Boolean(excelDate(record.caducidad))
    );

    rows.push({
      rowNumber,
      sku,
      name,
      category: resolvedCategory,
      itemKind,
      description: cellText(record.descripcion),
      quantity: Math.max(0, Math.round(cellNumber(record.existencia, 0))),
      minStock: Math.max(0, Math.round(cellNumber(record.stock_minimo, 0))),
      unit: parseUnit(record.unidad),
      location: cellText(record.ubicacion),
      brand: cellText(record.marca),
      model: cellText(record.modelo),
      serialNumber: cellText(record.serie),
      unitPrice: Math.max(0, cellNumber(record.precio, 0)),
      supplier: cellText(record.proveedor),
      expiryDate: excelDate(record.caducidad),
      notes: cellText(record.notas),
      assetStatus: parseAssetStatus(record.estado_equipo),
      lastMaintenanceDate: excelDate(record.ultimo_mantenimiento),
      nextMaintenanceDate: excelDate(record.proximo_mantenimiento),
      isActive: cellBoolean(record.activo, true),
      tracksLot: cellBoolean(
        record.controla_lote,
        itemKind !== "equipo" && (resolvedCategory === "medicamentos" || tracksExpiry)
      ),
      tracksSerial: cellBoolean(record.controla_serie, itemKind === "equipo"),
      tracksExpiry,
      maxStock: Math.max(0, Math.round(cellNumber(record.stock_maximo, 0))),
      reorderPoint: Math.max(0, Math.round(cellNumber(record.punto_reorden, 0))),
      partNumber: cellText(record.numero_parte),
      manufacturer: cellText(record.fabricante),
      subcategory: cellText(record.subcategoria),
    });
  }

  return { rows, errors };
}
