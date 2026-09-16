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
  sheetName: string;
  headers: string[];
};

const HEADER_ALIASES: Record<string, (typeof PRODUCT_EXCEL_HEADERS)[number]> = {
  sku: "sku",
  codigo: "sku",
  codigo_mas: "sku",
  codigo_interno: "sku",
  codigo_producto: "sku",
  clave: "sku",
  clave_producto: "sku",
  cve: "sku",
  cod: "sku",
  code: "sku",
  id_producto: "sku",
  no_parte: "numero_parte",
  nombre: "nombre",
  name: "nombre",
  producto: "nombre",
  articulo: "nombre",
  concepto: "nombre",
  nombre_producto: "nombre",
  descripcion: "descripcion",
  description: "descripcion",
  desc: "descripcion",
  categoria: "categoria",
  category: "categoria",
  familia: "categoria",
  linea: "categoria",
  rubro: "categoria",
  grupo: "categoria",
  tipo: "tipo",
  item_kind: "tipo",
  clase: "tipo",
  existencia: "existencia",
  existencia_inicial: "existencia",
  cantidad: "existencia",
  cant: "existencia",
  stock: "existencia",
  stock_actual: "existencia",
  quantity: "existencia",
  piezas: "existencia",
  inventario: "existencia",
  stock_minimo: "stock_minimo",
  min_stock: "stock_minimo",
  minimo: "stock_minimo",
  unidad: "unidad",
  unit: "unidad",
  um: "unidad",
  udm: "unidad",
  presentacion: "unidad",
  ubicacion: "ubicacion",
  location: "ubicacion",
  almacen: "ubicacion",
  bodega: "ubicacion",
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
  precio_unitario: "precio",
  p_unitario: "precio",
  precio_unit: "precio",
  unit_price: "precio",
  costo: "precio",
  pu: "precio",
  proveedor: "proveedor",
  supplier: "proveedor",
  fabricante: "fabricante",
  manufacturer: "fabricante",
  caducidad: "caducidad",
  expiry: "caducidad",
  fecha_caducidad: "caducidad",
  vencimiento: "caducidad",
  fecha_vencimiento: "caducidad",
  cad: "caducidad",
  notas: "notas",
  notes: "notas",
  observaciones: "notas",
  obs: "notas",
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
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).replace(/\u00a0/g, " ").trim();
}

function cellNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  let text = String(value ?? "").trim();
  if (!text) return fallback;
  text = text.replace(/[^0-9,.-]/g, "");
  if (text.includes(",") && text.includes(".")) {
    text = text.replace(/,/g, "");
  } else if (text.includes(",")) {
    const decimals = text.split(",")[1] ?? "";
    text = decimals.length === 2 ? text.replace(",", ".") : text.replace(/,/g, "");
  }
  const parsed = Number(text);
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
    const year = value.getFullYear();
    if (year < 1990 || year > 2100) return "";
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value < 30000 || value > 80000) return "";
    const epoch = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(epoch.getTime())) return epoch.toISOString().slice(0, 10);
  }
  const text = cellText(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    const [, day, month, yearRaw] = match;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return "";
}

function parseCategory(value: unknown): InventoryCategoryId {
  const raw = stripAccents(cellText(value)).toLowerCase();
  if (!raw) return "otros";
  if (/farmac|medicament|solucion/.test(raw)) return "medicamentos";
  if (/repuest|refacc/.test(raw)) return "refacciones";
  if (/equipo|monitor|dispositivo/.test(raw)) return "equipos";
  if (/reactivo|laboratorio/.test(raw)) return "reactivos";
  if (/accesor/.test(raw)) return "accesorios";
  if (/insumo|material|consumible/.test(raw)) return "insumos";
  const match = INVENTORY_CATEGORIES.find(
    (item) => item.id === raw || stripAccents(item.label).toLowerCase() === raw
  );
  return match?.id ?? "otros";
}

function parseUnit(value: unknown): InventoryUnit {
  const raw = stripAccents(cellText(value)).toLowerCase();
  if (!raw) return "pieza";
  if (raw === "pza" || raw === "pzas" || raw === "pz" || raw === "pzas.") return "pieza";
  if (raw === "cajas") return "caja";
  if (raw === "frascos") return "frasco";
  if (raw === "paquetes") return "paquete";
  if ((INVENTORY_UNITS as readonly string[]).includes(raw)) {
    return raw as InventoryUnit;
  }
  return "pieza";
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

function pickSheetName(workbook: XLSX.WorkBook): string | undefined {
  const names = workbook.SheetNames;
  if (names.length === 0) return undefined;
  const skip = (name: string) => /instrucc|instruction|ayuda|readme/i.test(name);
  const scored = names
    .filter((name) => !skip(name))
    .map((name) => {
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        blankrows: false,
      }) as unknown[][];
      const preferred = /producto|inventario|catalogo|articulo|stock|datos|lista/i.test(
        name
      );
      return { name, rows: matrix.length, preferred };
    })
    .filter((item) => item.rows > 1)
    .sort((a, b) => Number(b.preferred) - Number(a.preferred) || b.rows - a.rows);
  return scored[0]?.name ?? names.find((name) => !skip(name)) ?? names[0];
}

function mapHeaders(cells: unknown[]) {
  return cells.map((cell) => HEADER_ALIASES[normalizeHeader(cellText(cell))] ?? null);
}

function headerScore(mapping: ReturnType<typeof mapHeaders>) {
  return mapping.filter(Boolean).length;
}

function applyFallbacks(mapping: ReturnType<typeof mapHeaders>) {
  const next = [...mapping];
  if (!next.includes("nombre")) {
    const descriptionIndex = next.findIndex((key) => key === "descripcion");
    if (descriptionIndex >= 0) next[descriptionIndex] = "nombre";
  }
  if (!next.includes("sku")) {
    const partIndex = next.findIndex((key) => key === "numero_parte");
    if (partIndex >= 0) next[partIndex] = "sku";
  }
  return next;
}

function fallbackSku(name: string, rowNumber: number) {
  const slug = stripAccents(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return slug || `MAS-${String(rowNumber).padStart(4, "0")}`;
}

function readWorkbook(file: File, buffer: ArrayBuffer) {
  const name = file.name.toLowerCase();
  const isCsv =
    name.endsWith(".csv") ||
    file.type.includes("csv") ||
    file.type === "text/plain";
  if (isCsv) {
    const text = new TextDecoder("utf-8").decode(buffer);
    return XLSX.read(text, { type: "string", cellDates: true });
  }
  return XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });
}

export async function parseProductWorkbook(
  file: File,
  defaultKind: ItemKind = "producto"
): Promise<ParsedProductWorkbook> {
  const buffer = await file.arrayBuffer();
  const workbook = readWorkbook(file, buffer);
  const sheetName = pickSheetName(workbook);
  if (!sheetName) {
    return {
      rows: [],
      errors: [{ row: 0, sku: "", message: "El archivo no tiene hojas." }],
      sheetName: "",
      headers: [],
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  }) as (string | number | Date | null)[][];
  if (matrix.length < 2) {
    return {
      rows: [],
      errors: [{ row: 1, sku: "", message: "No hay filas de productos. Descarga la plantilla." }],
      sheetName,
      headers: [],
    };
  }

  let headerIndex = 0;
  let columnMap = applyFallbacks(mapHeaders(matrix[0] ?? []));
  let bestScore = headerScore(columnMap);
  for (let index = 1; index < Math.min(matrix.length, 20); index += 1) {
    const candidate = applyFallbacks(mapHeaders(matrix[index] ?? []));
    const score = headerScore(candidate);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = index;
      columnMap = candidate;
    }
  }

  const headers = (matrix[headerIndex] ?? []).map((cell) => cellText(cell));
  if (!columnMap.includes("nombre")) {
    return {
      rows: [],
      errors: [
        {
          row: headerIndex + 1,
          sku: "",
          message: `No encontré una columna de nombre. Columnas leídas: ${
            headers.filter(Boolean).join(", ") || "(vacías)"
          }. Sirve nombre, producto, artículo o descripción.`,
        },
      ],
      sheetName,
      headers,
    };
  }

  const rows: ProductExcelRow[] = [];
  const errors: ParsedProductWorkbook["errors"] = [];
  const seen = new Set<string>();

  for (let index = headerIndex + 1; index < matrix.length; index += 1) {
    const line = matrix[index] ?? [];
    const record: Partial<Record<(typeof PRODUCT_EXCEL_HEADERS)[number], unknown>> = {};
    columnMap.forEach((key, columnIndex) => {
      if (!key) return;
      record[key] = line[columnIndex];
    });

    let sku = cellText(record.sku);
    const name = cellText(record.nombre);
    const rowNumber = index + 1;
    const empty = !sku && !name && !cellText(record.categoria) && !cellText(record.existencia);
    if (empty) continue;

    if (!name) {
      errors.push({
        row: rowNumber,
        sku,
        message: "La fila no tiene nombre o descripción del producto.",
      });
      continue;
    }
    if (!sku) sku = fallbackSku(name, rowNumber);

    const skuKey = sku.toLowerCase();
    if (seen.has(skuKey)) {
      errors.push({
        row: rowNumber,
        sku,
        message: "sku duplicado en el archivo; se omitió esta fila.",
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

  return { rows, errors, sheetName, headers };
}
