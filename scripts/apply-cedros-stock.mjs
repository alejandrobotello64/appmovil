#!/usr/bin/env node
/**
 * Loads CANTIDAD + LOTE/SN + CADUCIDAD from INVENTARIO_GENERAL_CEDROS_VERIFICADO.xlsx
 * into warehouse movements (entrada). Does not rename or replace existing catalog codes.
 *
 * Products that already have on-hand quantity are skipped so live stock is not doubled.
 * New Cedros rows (existencia 0) receive the workbook qty/lot.
 *
 * Usage:
 *   node --input-type=module scripts/apply-cedros-stock.mjs [--dry-run] [--cloud] [path.xlsx]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const REASON = "Inventario Cedros verificado";
const SHEETS = new Set(["ASP", "DRAGER", "PHILIPS", "MASIMO", "WA", "3M"]);
const NA = /^(n\/?a|na|-|\.|none|sin lote)$/i;

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

function findWorkbook() {
  if (pathArg) return resolve(pathArg);
  const dirs = [
    join(ROOT, "data"),
    join(homedir(), ".cursor/projects/workspace/uploads"),
    join(ROOT, "uploads"),
    "/home/ubuntu/.cursor/projects/workspace/uploads",
    "/tmp",
  ];
  const names = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (/inventario_general_cedros.*\.xlsx$/i.test(name)) {
        names.push(join(dir, name));
      }
    }
  }
  names.sort((a, b) => {
    const score = (p) => (/verificado/i.test(p) ? 0 : 1);
    return score(a) - score(b) || b.localeCompare(a);
  });
  return names[0] || "";
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
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
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
  const iso = validIsoDate(text);
  if (iso) return iso;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return validIsoDate(value.toISOString().slice(0, 10));
  }
  const m = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return validIsoDate(`${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
  }
  return "";
}

function locCode(name) {
  return fold(name).replace(/_/g, "-").toUpperCase().slice(0, 24).replace(/^-+|-+$/g, "") || "GENERAL";
}

function headerIndex(header, aliases) {
  const wanted = new Set(aliases.map(fold));
  for (let i = 0; i < header.length; i += 1) {
    if (wanted.has(fold(header[i]))) return i;
  }
  return -1;
}

function parseWorkbook(path) {
  const wb = XLSX.readFile(path, { cellDates: true });
  const lines = [];
  for (const sheet of wb.SheetNames) {
    if (!SHEETS.has(sheet.trim().toUpperCase())) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], {
      header: 1,
      defval: "",
      raw: true,
      blankrows: false,
    });
    if (rows.length < 2) continue;
    const header = rows[0];
    const partIdx = headerIndex(header, ["no_de_parte", "n_de_parte", "no_parte"]);
    const lotIdx = headerIndex(header, ["lote", "lote_sn", "sn", "serie"]);
    const cadIdx = headerIndex(header, ["caducidad", "caducidad_fabricacion"]);
    const mfgIdx = headerIndex(header, ["fabricacion", "fecha_fabricacion"]);
    const qtyIdx = headerIndex(header, ["cantidad", "existencia", "stock"]);
    const ubiIdx = headerIndex(header, ["ubicacion"]);
    const whIdx = headerIndex(header, ["almacen"]);
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      const part = cell(row[partIdx]);
      if (!part || NA.test(part)) continue;
      const qty = qtyOf(row[qtyIdx]);
      if (qty <= 0) continue;
      let lot = cell(row[lotIdx]);
      if (NA.test(lot)) lot = "";
      if (/^\d+\.0+$/.test(lot)) lot = lot.replace(/\.0+$/, "");
      lines.push({
        sheet,
        part,
        partKey: partKey(part),
        lot,
        qty,
        expiry: dateOf(row[cadIdx]),
        manufactured: mfgIdx >= 0 ? dateOf(row[mfgIdx]) : "",
        location: cell(row[ubiIdx]),
        warehouse: cell(row[whIdx]),
      });
    }
  }
  return lines;
}

function envForTarget(env) {
  if (cloud) {
    return {
      url: env.CLOUD_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL,
      key: env.CLOUD_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
  }
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
    key: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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

async function ensureLocation(base, key, warehouseId, label, category, cache) {
  const fallback = {
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

async function main() {
  const env = loadEnv();
  const xlsx = findWorkbook();
  if (!xlsx || !existsSync(xlsx)) {
    console.error(
      "No está el Excel INVENTARIO_GENERAL_CEDROS_VERIFICADO.xlsx en este entorno.\n" +
        "Vuelve a adjuntarlo en el chat (el mismo archivo de Cedros) y lo cargo entero:\n" +
        "cantidad, lote/SN, caducidad y ubicación, sin cambiar códigos que ya tenían existencia."
    );
    process.exit(2);
  }

  const lines = parseWorkbook(xlsx);
  const { url: base, key } = envForTarget(env);
  if (!base || !key) throw new Error("Faltan URL/anon de Supabase.");

  const warehouses = await restAll(
    base,
    key,
    "/rest/v1/warehouses?is_active=eq.true&select=id,code,name,is_default&order=is_default.desc"
  );
  const defaultWh =
    warehouses.find((row) => row.is_default) || warehouses[0];
  if (!defaultWh) throw new Error("No hay almacén.");

  const items = await restAll(
    base,
    key,
    "/rest/v1/inventory_items?select=id,sku,name,part_number,quantity,item_kind,category,tracks_lot,tracks_expiry,tracks_serial,is_active&order=sku"
  );
  const byPart = new Map();
  for (const item of items ?? []) {
    const keyPart = partKey(item.part_number);
    if (!keyPart) continue;
    const list = byPart.get(keyPart) || [];
    list.push(item);
    byPart.set(keyPart, list);
  }
  for (const list of byPart.values()) {
    list.sort((a, b) => {
      const active = Number(b.is_active !== false) - Number(a.is_active !== false);
      if (active) return active;
      return Number(b.quantity) - Number(a.quantity);
    });
  }

  const locations = await restAll(
    base,
    key,
    `/rest/v1/locations?warehouse_id=eq.${defaultWh.id}&select=id,code,name`
  );
  const locationCache = new Map();
  for (const loc of locations ?? []) {
    if (loc.code) locationCache.set(String(loc.code).toUpperCase(), loc.id);
    if (loc.name) locationCache.set(String(loc.name).toUpperCase(), loc.id);
  }

  const lotById = new Map();
  try {
    const existingLots = await restAll(
      base,
      key,
      "/rest/v1/lots?select=id,product_id,lot_number"
    );
    for (const lot of existingLots ?? []) {
      lotById.set(lot.id, String(lot.lot_number || "").trim().toUpperCase());
    }
  } catch (error) {
    console.warn(`lots lookup skipped: ${error.message}`);
  }

  const balanceQty = new Map();
  try {
    const balances = await restAll(
      base,
      key,
      "/rest/v1/inventory_balances?select=product_id,lot_id,location_id,qty_on_hand"
    );
    for (const row of balances ?? []) {
      const lot = row.lot_id ? lotById.get(row.lot_id) || "" : "";
      const keyBal = `${row.product_id}::${lot}::${row.location_id || ""}`;
      balanceQty.set(keyBal, (balanceQty.get(keyBal) || 0) + Number(row.qty_on_hand || 0));
    }
  } catch (error) {
    console.warn(`balances lookup skipped: ${error.message}`);
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
        `${row.product_id}::${String(row.serial_number || "").replace(/^\/+/, "").trim().toUpperCase()}`
      );
    }
  } catch (error) {
    console.warn(`serials lookup skipped: ${error.message}`);
  }

  const stats = {
    rows: lines.length,
    catalog: items.length,
    applied: 0,
    units: 0,
    skippedCovered: 0,
    skippedMissing: 0,
    skippedDuplicateLot: 0,
    errors: 0,
  };

  if (dryRun) {
    console.log(`Workbook ${xlsx}`);
    console.log(`Lines with qty>0: ${lines.length}`);
    console.log(`Catalog items: ${items.length}`);
    console.log(`Target ${cloud ? "cloud" : "local"} ${base}`);
    console.log(lines.slice(0, 8));
    return;
  }

  const patched = new Set();
  const grouped = new Map();
  const excelByProduct = new Map();

  for (const line of lines) {
    const matches = byPart.get(line.partKey) || [];
    if (!matches.length) {
      stats.skippedMissing += 1;
      continue;
    }
    const item = matches[0];
    let locationId = "";
    try {
      locationId =
        (await ensureLocation(
          base,
          key,
          defaultWh.id,
          line.location,
          item.category,
          locationCache
        )) || "";
    } catch (error) {
      stats.errors += 1;
      console.warn(`ubicacion ${line.part}: ${error.message}`);
      continue;
    }

    const lot = String(line.lot || "").replace(/^\/+/, "").trim().toUpperCase();
    const serial = item.item_kind === "equipo" ? lot : "";
    const lotNumber = item.item_kind === "equipo" ? "" : lot;
    const groupKey = serial
      ? `${item.id}::SN::${serial}`
      : `${item.id}::${lotNumber}::${locationId}`;
    excelByProduct.set(item.id, (excelByProduct.get(item.id) || 0) + line.qty);
    const current = grouped.get(groupKey);
    if (current) {
      current.qty += line.qty;
      if (!current.expiry && line.expiry) current.expiry = line.expiry;
      continue;
    }
    grouped.set(groupKey, {
      item,
      line,
      qty: line.qty,
      locationId,
      lotNumber,
      serial,
      expiry: line.expiry,
    });
  }

  const remainingNeed = new Map();
  for (const [productId, excelQty] of excelByProduct) {
    const item = items.find((row) => row.id === productId);
    remainingNeed.set(
      productId,
      Math.max(0, excelQty - Number(item?.quantity || 0))
    );
  }

  for (const group of grouped.values()) {
    const { item, line, locationId, lotNumber, serial, expiry } = group;
    const need = remainingNeed.get(item.id) || 0;
    if (need <= 0) {
      stats.skippedCovered += 1;
      continue;
    }

    if (serial) {
      const serialKey = `${item.id}::${serial}`;
      if (existingSerials.has(serialKey)) {
        stats.skippedDuplicateLot += 1;
        continue;
      }
    } else {
      const balKey = `${item.id}::${lotNumber}::${locationId}`;
      const already = balanceQty.get(balKey) || 0;
      const delta = group.qty - already;
      if (delta <= 0) {
        stats.skippedDuplicateLot += 1;
        continue;
      }
      group.qty = Math.min(delta, need);
    }
    group.qty = Math.min(group.qty, remainingNeed.get(item.id) || 0);
    if (group.qty <= 0) {
      stats.skippedCovered += 1;
      continue;
    }

    if (!patched.has(item.id)) {
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
        } catch (error) {
          console.warn(`flags ${item.sku}: ${error.message}`);
        }
      }
      patched.add(item.id);
    }

    try {
      await rest(base, key, "POST", "/rest/v1/rpc/apply_stock_movement", {
        p_product_id: item.id,
        p_movement_type: "entrada",
        p_quantity: group.qty,
        p_note: `Cedros ${line.sheet} · ${line.part}`,
        p_created_by: "cedros-stock",
        p_reason: REASON,
        p_warehouse_id: defaultWh.id,
        p_location_id: locationId || null,
        p_lot_number: lotNumber || null,
        p_expiry_date: expiry || null,
        p_serial_number: serial || null,
        p_supplier_name: "",
        p_purchase_order_id: null,
      });
      if (serial) existingSerials.add(`${item.id}::${serial}`);
      remainingNeed.set(item.id, (remainingNeed.get(item.id) || 0) - group.qty);
      item.quantity = Number(item.quantity || 0) + group.qty;
      stats.applied += 1;
      stats.units += group.qty;
      if (stats.applied % 50 === 0) {
        console.log(
          `progress ${stats.applied} unidades=${stats.units} errores=${stats.errors}`
        );
      }
    } catch (error) {
      stats.errors += 1;
      console.warn(
        `entrada ${item.sku} ${line.part} lote=${line.lot}: ${error.message}`
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        workbook: xlsx,
        target: cloud ? "cloud" : "local",
        warehouse: defaultWh.code,
        ...stats,
      },
      null,
      2
    )
  );
}

export { parseWorkbook, partKey };

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || "")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
