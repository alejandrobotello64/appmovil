#!/usr/bin/env node
/**
 * Importa INVENTARIO GENERAL CEDROS.xlsx:
 * - Match por n.º de parte / REFERENCIA contra el catálogo
 * - Alta de productos faltantes
 * - Entradas de existencia (lotes / series) vía apply_stock_movement
 *
 *   node --input-type=module scripts/import-cedros-inventario.mjs --cloud [--dry-run] [path.xlsx]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { createSkuAllocator } from "./lib/catalog-sku.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_XLSX =
  "C:/Users/aleja/Downloads/INVENTARIO GENERAL CEDROS (2).xlsx";
const REASON = "Inventario Cedros";
const NA = /^(n\/?a|na|-|\.|none|sin lote|sin serie)?$/i;

const SHEET_META = {
  DRAGER: { brand: "Dräger", category: "accesorios" },
  "FISHER & PAYKEL": { brand: "Fisher & Paykel", category: "accesorios" },
  "3M": { brand: "3M", category: "insumos" },
  "3M ": { brand: "3M", category: "insumos" },
  PHILIPS: { brand: "Philips", category: "accesorios" },
  MASIMO: { brand: "Masimo", category: "accesorios" },
  WA: { brand: "Welch Allyn", category: "accesorios" },
  ASP: { brand: "ASP", category: "insumos" },
  "ASP ": { brand: "ASP", category: "insumos" },
  "EQUIPOS SALA DE CAMARAS": { brand: "Dräger", category: "equipos", equipment: true },
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const cloud = args.includes("--cloud");
const pathArg = args.find((value) => !value.startsWith("--"));

function loadEnv() {
  const env = { ...process.env };
  const file = join(ROOT, ".env.local");
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

function fold(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function cell(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) return String(value);
    if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
    return String(value);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).replace(/\u00a0/g, " ").trim();
}

function partKey(value) {
  return cell(value)
    .toUpperCase()
    .replace(/\.0+$/, "")
    .replace(/[^A-Z0-9]/g, "");
}

function qtyOf(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  const text = cell(value).replace(/[^0-9,.-]/g, "").replace(",", ".");
  const n = Number(text);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function validIsoDate(text) {
  const m = String(text).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  let year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year >= 2820 && year < 2920) year -= 800;
  if (year < 1990 || year > 2045 || month < 1 || month > 12 || day < 1 || day > 31) {
    return "";
  }
  return `${String(year).padStart(4, "0")}-${m[2]}-${m[3]}`;
}

function dateOf(value) {
  const text = cell(value);
  if (!text || NA.test(text)) return "";
  const fab = text.match(/FAB(?:RICACION)?\s*[:=]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
  const raw = fab ? fab[1] : text.replace(/^\/+/, "").trim();
  const iso = validIsoDate(raw);
  if (iso) return iso;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return validIsoDate(value.toISOString().slice(0, 10));
  }
  const m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return validIsoDate(`${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
  }
  const ym = raw.match(/^(\d{4})-(\d{2})$/);
  if (ym) return validIsoDate(`${ym[1]}-${ym[2]}-01`);
  return "";
}

function unitOf(presentation, equipment) {
  if (equipment) return "pieza";
  const text = cell(presentation).toLowerCase();
  if (/caja/.test(text)) return "caja";
  if (/paquete|bolsa|pack/.test(text)) return "paquete";
  if (/kit/.test(text)) return "pieza";
  return "pieza";
}

function categoryOf(meta, presentation, name) {
  if (meta.equipment || /equipo/i.test(presentation) || /equipo/i.test(name)) {
    return "equipos";
  }
  const blob = `${presentation} ${name}`.toLowerCase();
  if (/refaccion|spare|battery replacement|tool kit/.test(blob)) return "refacciones";
  if (meta.category === "insumos") return "insumos";
  return meta.category || "accesorios";
}

function locCode(name) {
  return (
    fold(name).replace(/_/g, "-").toUpperCase().slice(0, 24).replace(/^-+|-+$/g, "") ||
    "GENERAL"
  );
}

function headerIndex(header, aliases) {
  const wanted = aliases.map(fold);
  // Exact match first (avoids "existencia" matching "entrada" via substring)
  for (let i = 0; i < header.length; i += 1) {
    const h = fold(header[i]);
    if (wanted.includes(h)) return i;
  }
  for (let i = 0; i < header.length; i += 1) {
    const h = fold(header[i]);
    for (const alias of wanted) {
      if (alias.length < 4) continue;
      // Only allow header containing alias, never alias containing header
      if (h.includes(alias)) return i;
    }
  }
  return -1;
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(6, rows.length); i += 1) {
    const folded = (rows[i] || []).map(fold);
    if (
      folded.some(
        (h) =>
          h === "referencia" ||
          h.includes("referencia") ||
          h.includes("no_de_parte") ||
          h === "no_serie"
      )
    ) {
      return i;
    }
  }
  return 0;
}

function pickName(header, row, partIdx) {
  const idxs = [];
  for (let i = 0; i < header.length; i += 1) {
    const h = fold(header[i]);
    if (h === "producto" || h === "descripcion" || h === "nombre") idxs.push(i);
  }
  // DRAGER: segunda columna PRESENTACION es el nombre
  const presentacionIdxs = [];
  for (let i = 0; i < header.length; i += 1) {
    if (fold(header[i]).startsWith("presentacion")) presentacionIdxs.push(i);
  }
  for (const i of idxs) {
    const value = cell(row[i]);
    if (value && !NA.test(value) && value.length > 2) return value;
  }
  if (presentacionIdxs.length >= 2) {
    const value = cell(row[presentacionIdxs[1]]);
    if (value && value.length > 2) return value;
  }
  if (presentacionIdxs.length === 1) {
    const value = cell(row[presentacionIdxs[0]]);
    if (value && value.length > 2 && !/^(pieza|caja|kit|bolsa)/i.test(value)) {
      return value;
    }
  }
  return cell(row[partIdx]) || "Sin nombre";
}

function presentationOf(header, row) {
  for (let i = 0; i < header.length; i += 1) {
    if (fold(header[i]).startsWith("presentacion")) {
      const value = cell(row[i]);
      if (value) return value;
    }
  }
  return "";
}

function parseWorkbook(path) {
  const wb = XLSX.readFile(path, { cellDates: true });
  const lines = [];
  for (const sheetName of wb.SheetNames) {
    const metaKey =
      Object.keys(SHEET_META).find(
        (key) => key.trim().toUpperCase() === sheetName.trim().toUpperCase()
      ) || sheetName;
    const meta = SHEET_META[metaKey] || {
      brand: sheetName.trim(),
      category: "accesorios",
    };
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: true,
      blankrows: false,
    });
    if (rows.length < 2) continue;
    const headerRow = findHeaderRow(rows);
    const header = rows[headerRow];
    const partIdx = headerIndex(header, [
      "referencia",
      "no_de_parte",
      "n_de_parte",
      "no_parte",
      "part_number",
    ]);
    const lotIdx = headerIndex(header, [
      "lote_sn",
      "lote",
      "no_serie",
      "serie",
      "sn",
      "serial",
    ]);
    const cadIdx = headerIndex(header, [
      "caducidad_fabricacion",
      "caducidad",
      "expiry",
    ]);
    const mfgIdx = headerIndex(header, ["fabricacion", "fecha_fabricacion"]);
    const qtyIdx = headerIndex(header, ["existencia", "cantidad", "stock"]);
    const entradaIdx = headerIndex(header, ["entrada"]);
    const ubiIdx = headerIndex(header, ["ubicacion"]);
    const tipoIdx = headerIndex(header, ["tipo", "comentarios"]);

    if (partIdx < 0) {
      console.warn(`Hoja ${sheetName}: sin columna REFERENCIA, se omite.`);
      continue;
    }

    for (let i = headerRow + 1; i < rows.length; i += 1) {
      const row = rows[i];
      const part = cell(row[partIdx]);
      if (!part || NA.test(part)) continue;
      let qty = qtyIdx >= 0 ? qtyOf(row[qtyIdx]) : 0;
      if (qty <= 0 && entradaIdx >= 0) qty = qtyOf(row[entradaIdx]);
      if (qty <= 0) continue;

      let lot = lotIdx >= 0 ? cell(row[lotIdx]) : "";
      if (NA.test(lot)) lot = "";
      lot = lot.replace(/^\/+/, "").trim();
      if (/^\d+\.0+$/.test(lot)) lot = lot.replace(/\.0+$/, "");

      const name = pickName(header, row, partIdx);
      const presentation = presentationOf(header, row);
      const category = categoryOf(meta, presentation, name);
      const equipment = category === "equipos" || Boolean(meta.equipment);
      const tipo = tipoIdx >= 0 ? cell(row[tipoIdx]) : "";
      if (/insumo/i.test(tipo) && !equipment) {
        // keep
      } else if (/accesorio/i.test(tipo)) {
        // prefer accesorios when typed
      }

      let expiry = cadIdx >= 0 ? dateOf(row[cadIdx]) : "";
      let manufactured = mfgIdx >= 0 ? dateOf(row[mfgIdx]) : "";
      if (!manufactured && /FAB/i.test(cell(row[cadIdx]))) {
        manufactured = dateOf(row[cadIdx]);
        if (manufactured) expiry = "";
      }

      lines.push({
        sheet: sheetName.trim(),
        brand: meta.brand,
        category,
        equipment,
        part,
        partKey: partKey(part),
        name: name.replace(/\s+/g, " ").trim(),
        presentation,
        unit: unitOf(presentation, equipment),
        lot,
        qty,
        expiry,
        manufactured,
        location: ubiIdx >= 0 ? cell(row[ubiIdx]) : "",
      });
    }
  }
  return lines;
}

function envForTarget(env) {
  if (cloud) {
    return {
      url: env.CLOUD_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL,
      key:
        env.CLOUD_SUPABASE_SERVICE_ROLE_KEY ||
        env.SUPABASE_SERVICE_ROLE_KEY ||
        env.CLOUD_SUPABASE_ANON_KEY ||
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
  }
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
    key: env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

async function rest(base, key, method, path, body, extraHeaders = {}) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...extraHeaders,
  };
  const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || text || res.statusText;
    throw new Error(`${method} ${path} ${res.status}: ${msg}`);
  }
  return data;
}

async function restAll(base, key, path) {
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const to = from + page - 1;
    const chunk = await rest(base, key, "GET", path, null, {
      Range: `${from}-${to}`,
      Prefer: "count=exact",
    });
    if (Array.isArray(chunk)) rows.push(...chunk);
    if (!Array.isArray(chunk) || chunk.length < page) break;
  }
  return rows;
}

function quoteFilter(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

async function ensureWarehouse(base, key) {
  const warehouses = await restAll(
    base,
    key,
    "/rest/v1/warehouses?is_active=eq.true&select=id,code,name,is_default&order=code"
  );
  const cedros = warehouses.find((row) => /cedro/i.test(row.code) || /cedro/i.test(row.name));
  if (cedros) return cedros;
  const created = await rest(base, key, "POST", "/rest/v1/warehouses", {
    code: "CEDROS",
    name: "Almacén Cedros",
    is_active: true,
    is_default: false,
  });
  return created?.[0] || created;
}

async function ensureLocation(base, key, warehouseId, label, category, cache) {
  const fallback =
    {
      insumos: "INSUMOS",
      medicamentos: "MEDICAMENTOS",
      refacciones: "REFACCIONES",
      accesorios: "ACCESORIOS",
      equipos: "EQUIPOS",
    }[category] || "GENERAL";
  const name = (label || fallback).trim() || fallback;
  const code = locCode(name);
  const cached = cache.get(code) || cache.get(name.toUpperCase());
  if (cached) return cached;
  try {
    const created = await rest(base, key, "POST", "/rest/v1/locations", {
      warehouse_id: warehouseId,
      code,
      name,
    });
    const id = created?.[0]?.id || created?.id;
    if (id) {
      cache.set(code, id);
      cache.set(name.toUpperCase(), id);
      return id;
    }
  } catch (error) {
    if (!String(error.message).includes("23505")) throw error;
  }
  const existing = await rest(
    base,
    key,
    "GET",
    `/rest/v1/locations?warehouse_id=eq.${warehouseId}&or=(code.eq.${quoteFilter(code)},name.eq.${quoteFilter(name)})&select=id,code,name&limit=1`
  );
  const id = existing?.[0]?.id;
  if (id) {
    cache.set(code, id);
    cache.set(name.toUpperCase(), id);
  }
  return id;
}

function preferCatalogMatch(list) {
  return [...list].sort((a, b) => {
    const active = Number(b.is_active !== false) - Number(a.is_active !== false);
    if (active) return active;
    const equip =
      Number(a.item_kind === "equipo") - Number(b.item_kind === "equipo");
    if (equip) return equip;
    // Prefer pieza siblings for piece presentation later; otherwise any match
    return String(a.sku).localeCompare(String(b.sku));
  })[0];
}

function matchItem(byPart, line) {
  const list = byPart.get(line.partKey) || [];
  if (!list.length) return null;
  if (line.equipment) {
    const equip = list.find(
      (item) => item.item_kind === "equipo" || item.category === "equipos"
    );
    if (equip) return equip;
  }
  // Prefer same unit when multiple (caja vs pieza)
  const sameUnit = list.filter(
    (item) => String(item.unit || "").toLowerCase() === line.unit
  );
  if (sameUnit.length) return preferCatalogMatch(sameUnit);
  return preferCatalogMatch(list);
}

async function createProduct(base, key, line, nextSku) {
  const category = line.category;
  const itemKind = category === "equipos" ? "equipo" : "producto";
  const sku = nextSku(category);
  const payload = {
    sku,
    name: line.name.slice(0, 200),
    part_number: line.part,
    brand: line.brand || "",
    model: "",
    category,
    item_kind: itemKind,
    unit: line.unit,
    quantity: 0,
    is_active: true,
    tracks_lot: !line.equipment && Boolean(line.lot),
    tracks_expiry: Boolean(line.expiry),
    tracks_serial: line.equipment,
    description: `Importado Cedros · ${line.sheet}`,
  };
  const created = await rest(base, key, "POST", "/rest/v1/inventory_items", payload);
  return created?.[0] || created;
}

async function main() {
  const env = loadEnv();
  const xlsx = resolve(pathArg || DEFAULT_XLSX);
  if (!existsSync(xlsx)) {
    console.error(`No se encontró el Excel: ${xlsx}`);
    process.exit(2);
  }

  const lines = parseWorkbook(xlsx);
  const { url: base, key } = envForTarget(env);
  if (!base || !key) throw new Error("Faltan URL/key de Supabase.");

  const items = await restAll(
    base,
    key,
    "/rest/v1/inventory_items?select=id,sku,name,part_number,quantity,item_kind,category,unit,tracks_lot,tracks_expiry,tracks_serial,is_active,brand&order=sku"
  );
  const byPart = new Map();
  for (const item of items) {
    const keyPart = partKey(item.part_number);
    if (!keyPart) continue;
    const list = byPart.get(keyPart) || [];
    list.push(item);
    byPart.set(keyPart, list);
  }

  const matched = [];
  const missing = [];
  for (const line of lines) {
    const item = matchItem(byPart, line);
    if (item) matched.push({ line, item });
    else missing.push(line);
  }

  const missingParts = [...new Map(missing.map((line) => [line.partKey, line])).values()];
  const report = {
    workbook: xlsx,
    rowsWithQty: lines.length,
    unitsInExcel: lines.reduce((sum, line) => sum + line.qty, 0),
    matchedRows: matched.length,
    missingRows: missing.length,
    missingUniqueParts: missingParts.length,
    bySheet: {},
  };
  for (const line of lines) {
    const sheet = report.bySheet[line.sheet] || {
      rows: 0,
      units: 0,
      matched: 0,
      missing: 0,
    };
    sheet.rows += 1;
    sheet.units += line.qty;
    report.bySheet[line.sheet] = sheet;
  }
  for (const { line } of matched) {
    report.bySheet[line.sheet].matched += 1;
  }
  for (const line of missing) {
    report.bySheet[line.sheet].missing += 1;
  }

  writeFileSync(
    join(ROOT, "tmp-cedros-import-report.json"),
    JSON.stringify(
      {
        ...report,
        sampleMissing: missingParts.slice(0, 40).map((line) => ({
          sheet: line.sheet,
          part: line.part,
          name: line.name,
          qty: line.qty,
          unit: line.unit,
        })),
      },
      null,
      2
    )
  );

  console.log(JSON.stringify(report, null, 2));
  if (dryRun) {
    console.log(`Dry-run OK. Faltantes únicos: ${missingParts.length}`);
    return;
  }

  const warehouse = await ensureWarehouse(base, key);
  const locations = await restAll(
    base,
    key,
    `/rest/v1/locations?warehouse_id=eq.${warehouse.id}&select=id,code,name`
  );
  const locationCache = new Map();
  for (const loc of locations ?? []) {
    if (loc.code) locationCache.set(String(loc.code).toUpperCase(), loc.id);
    if (loc.name) locationCache.set(String(loc.name).toUpperCase(), loc.id);
  }

  const nextSku = createSkuAllocator(items);
  const createdItems = [];
  for (const line of missingParts) {
    try {
      const item = await createProduct(base, key, line, nextSku);
      createdItems.push(item);
      const list = byPart.get(line.partKey) || [];
      list.push(item);
      byPart.set(line.partKey, list);
      items.push(item);
      console.log(`alta ${item.sku} · ${line.part} · ${line.name}`);
    } catch (error) {
      console.warn(`no se pudo crear ${line.part}: ${error.message}`);
    }
  }

  // Re-match all lines after creates
  const work = [];
  for (const line of lines) {
    const item = matchItem(byPart, line);
    if (!item) continue;
    work.push({ line, item });
  }

  const existingSerials = new Set();
  try {
    const serials = await restAll(
      base,
      key,
      "/rest/v1/serial_numbers?select=product_id,serial_number"
    );
    for (const row of serials ?? []) {
      existingSerials.add(
        `${row.product_id}::${String(row.serial_number || "")
          .replace(/^\/+/, "")
          .trim()
          .toUpperCase()}`
      );
    }
  } catch (error) {
    console.warn(`serials: ${error.message}`);
  }

  const lotById = new Map();
  try {
    const lots = await restAll(base, key, "/rest/v1/lots?select=id,lot_number");
    for (const lot of lots ?? []) {
      lotById.set(lot.id, String(lot.lot_number || "").trim().toUpperCase());
    }
  } catch (error) {
    console.warn(`lots: ${error.message}`);
  }

  const balanceQty = new Map();
  const productQty = new Map();
  try {
    const balances = await restAll(
      base,
      key,
      `/rest/v1/inventory_balances?warehouse_id=eq.${warehouse.id}&select=product_id,lot_id,location_id,qty_on_hand`
    );
    for (const row of balances ?? []) {
      const lot = row.lot_id ? lotById.get(row.lot_id) || "" : "";
      const keyBal = `${row.product_id}::${lot}::${row.location_id || ""}`;
      balanceQty.set(
        keyBal,
        (balanceQty.get(keyBal) || 0) + Number(row.qty_on_hand || 0)
      );
      productQty.set(
        row.product_id,
        (productQty.get(row.product_id) || 0) + Number(row.qty_on_hand || 0)
      );
    }
  } catch (error) {
    console.warn(`balances: ${error.message}`);
  }

  // Target total per product from Excel (all lots/locations)
  const excelQtyByProduct = new Map();
  for (const { line, item } of work) {
    excelQtyByProduct.set(
      item.id,
      (excelQtyByProduct.get(item.id) || 0) + line.qty
    );
  }

  const stats = {
    createdProducts: createdItems.length,
    applied: 0,
    units: 0,
    skippedSerialDup: 0,
    skippedCovered: 0,
    errors: 0,
  };

  // Group by product+lot/serial+location
  const grouped = new Map();
  for (const { line, item } of work) {
    let locationId = "";
    try {
      locationId =
        (await ensureLocation(
          base,
          key,
          warehouse.id,
          line.location,
          item.category,
          locationCache
        )) || "";
    } catch (error) {
      stats.errors += 1;
      console.warn(`ubicacion ${line.part}: ${error.message}`);
      continue;
    }
    const serial =
      item.item_kind === "equipo" || item.category === "equipos"
        ? String(line.lot || "").trim().toUpperCase()
        : "";
    const lotNumber =
      item.item_kind === "equipo" || item.category === "equipos"
        ? ""
        : String(line.lot || "").trim();
    const keyGroup = serial
      ? `${item.id}::SN::${serial}`
      : `${item.id}::${lotNumber.toUpperCase()}::${locationId}::${line.expiry || ""}`;
    const current = grouped.get(keyGroup);
    if (current) {
      current.qty += line.qty;
      if (!current.expiry && line.expiry) current.expiry = line.expiry;
      if (!current.manufactured && line.manufactured) {
        current.manufactured = line.manufactured;
      }
      continue;
    }
    grouped.set(keyGroup, {
      item,
      line,
      qty: line.qty,
      locationId,
      lotNumber,
      serial,
      expiry: line.expiry,
      manufactured: line.manufactured,
    });
  }

  for (const group of grouped.values()) {
    const { item, line, locationId, lotNumber, serial, expiry, manufactured } = group;
    if (serial) {
      const serialKey = `${item.id}::${serial}`;
      if (existingSerials.has(serialKey)) {
        stats.skippedSerialDup += 1;
        continue;
      }
    } else {
      // Product-level cover first (avoids re-import when lot/location keys differ)
      const target = excelQtyByProduct.get(item.id) || 0;
      const have = productQty.get(item.id) || 0;
      if (have >= target) {
        stats.skippedCovered += 1;
        continue;
      }
      const room = target - have;
      const balKey = `${item.id}::${String(lotNumber || "").trim().toUpperCase()}::${locationId || ""}`;
      const alreadyLot = balanceQty.get(balKey) || 0;
      let delta = group.qty - alreadyLot;
      if (delta <= 0) {
        stats.skippedCovered += 1;
        continue;
      }
      delta = Math.min(delta, room);
      if (delta <= 0) {
        stats.skippedCovered += 1;
        continue;
      }
      group.qty = delta;
    }

    const patch = {};
    if (lotNumber) patch.tracks_lot = true;
    if (expiry) patch.tracks_expiry = true;
    if (serial) patch.tracks_serial = true;
    if (Object.keys(patch).length) {
      try {
        await rest(
          base,
          key,
          "PATCH",
          `/rest/v1/inventory_items?id=eq.${item.id}`,
          patch
        );
      } catch {
        /* flags opcionales */
      }
    }

    try {
      await rest(base, key, "POST", "/rest/v1/rpc/apply_stock_movement", {
        p_product_id: item.id,
        p_movement_type: "entrada",
        p_quantity: group.qty,
        p_note: `Cedros ${line.sheet} · ${line.part}`,
        p_created_by: "cedros-import",
        p_reason: REASON,
        p_warehouse_id: warehouse.id,
        p_location_id: locationId || null,
        p_lot_number: lotNumber || null,
        p_expiry_date: expiry || null,
        p_serial_number: serial || null,
        p_supplier_name: line.brand || "",
        p_purchase_order_id: null,
      });
      if (manufactured && lotNumber) {
        try {
          await rest(
            base,
            key,
            "PATCH",
            `/rest/v1/lots?product_id=eq.${item.id}&lot_number=eq.${encodeURIComponent(lotNumber)}`,
            { manufactured_at: manufactured }
          );
        } catch {
          /* optional */
        }
      }
      if (serial) existingSerials.add(`${item.id}::${serial}`);
      else {
        const balKey = `${item.id}::${String(lotNumber || "").trim().toUpperCase()}::${locationId || ""}`;
        balanceQty.set(balKey, (balanceQty.get(balKey) || 0) + group.qty);
        productQty.set(item.id, (productQty.get(item.id) || 0) + group.qty);
      }
      stats.applied += 1;
      stats.units += group.qty;
      if (stats.applied % 40 === 0) {
        console.log(
          `progress entradas=${stats.applied} unidades=${stats.units} errores=${stats.errors}`
        );
      }
    } catch (error) {
      stats.errors += 1;
      console.warn(
        `entrada ${item.sku} ${line.part} lote=${line.lot}: ${error.message}`
      );
    }
  }

  const summary = {
    workbook: xlsx,
    warehouse: warehouse.code,
    matchedRows: matched.length,
    missingUniqueParts: missingParts.length,
    ...stats,
  };
  writeFileSync(
    join(ROOT, "tmp-cedros-import-result.json"),
    JSON.stringify(summary, null, 2)
  );
  console.log(JSON.stringify(summary, null, 2));
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || "")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
