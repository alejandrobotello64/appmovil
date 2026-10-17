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

function dateOf(value) {
  const text = cell(value);
  if (!text || NA.test(text)) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const m = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
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

async function rest(base, key, method, path, body) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
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

async function ensureLocation(base, key, warehouseId, label, category) {
  const fallback = {
    insumos: "INSUMOS",
    medicamentos: "MEDICAMENTOS",
    refacciones: "REFACCIONES",
    accesorios: "ACCESORIOS",
    equipos: "EQUIPOS",
  }[category] || "GENERAL";
  const name = (label || fallback).trim() || fallback;
  const code = locCode(name);
  const existing = await rest(
    base,
    key,
    "GET",
    `/rest/v1/locations?warehouse_id=eq.${warehouseId}&or=(code.eq.${encodeURIComponent(code)},name.eq.${encodeURIComponent(name)})&select=id,code,name&limit=1`
  );
  if (existing?.[0]?.id) return existing[0].id;
  const created = await rest(base, key, "POST", "/rest/v1/locations", {
    warehouse_id: warehouseId,
    code,
    name,
  });
  return created?.[0]?.id || created?.id;
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

  const warehouses = await rest(
    base,
    key,
    "GET",
    "/rest/v1/warehouses?is_active=eq.true&select=id,code,name,is_default&order=is_default.desc"
  );
  const defaultWh =
    warehouses.find((row) => row.is_default) || warehouses[0];
  if (!defaultWh) throw new Error("No hay almacén.");

  const items = await rest(
    base,
    key,
    "GET",
    "/rest/v1/inventory_items?select=id,sku,name,part_number,quantity,item_kind,category,tracks_lot,tracks_expiry,tracks_serial,color_tag,notes&limit=5000"
  );
  const byPart = new Map();
  for (const item of items ?? []) {
    const keyPart = partKey(item.part_number);
    if (!keyPart) continue;
    const list = byPart.get(keyPart) || [];
    list.push(item);
    byPart.set(keyPart, list);
  }

  const stats = {
    rows: lines.length,
    applied: 0,
    skippedHasStock: 0,
    skippedMissing: 0,
    errors: 0,
  };

  if (dryRun) {
    console.log(`Workbook ${xlsx}`);
    console.log(`Lines with qty>0: ${lines.length}`);
    console.log(`Target ${cloud ? "cloud" : "local"} ${base}`);
    console.log(lines.slice(0, 8));
    return;
  }

  for (const line of lines) {
    const matches = byPart.get(line.partKey) || [];
    if (!matches.length) {
      stats.skippedMissing += 1;
      continue;
    }
    const item =
      matches.find((row) => Number(row.quantity) === 0) || matches[0];
    if (Number(item.quantity) > 0) {
      stats.skippedHasStock += 1;
      continue;
    }

    const patch = {};
    if (line.lot && !item.tracks_serial) patch.tracks_lot = true;
    if (line.expiry) patch.tracks_expiry = true;
    if (item.item_kind === "equipo" && line.lot) patch.tracks_serial = true;
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

    const locationId = await ensureLocation(
      base,
      key,
      defaultWh.id,
      line.location,
      item.category
    );
    const serial =
      item.item_kind === "equipo" && line.lot ? line.lot : null;
    const lotNumber =
      item.item_kind === "equipo" ? null : line.lot || null;

    try {
      await rest(base, key, "POST", "/rest/v1/rpc/apply_stock_movement", {
        p_product_id: item.id,
        p_movement_type: "entrada",
        p_quantity: line.qty,
        p_note: `Cedros ${line.sheet} · ${line.part}`,
        p_created_by: "cedros-stock",
        p_reason: REASON,
        p_warehouse_id: defaultWh.id,
        p_location_id: locationId,
        p_lot_number: lotNumber,
        p_expiry_date: line.expiry || null,
        p_serial_number: serial,
        p_supplier_name: "",
        p_purchase_order_id: null,
      });
      item.quantity = Number(item.quantity) + line.qty;
      stats.applied += 1;
    } catch (error) {
      stats.errors += 1;
      console.warn(`entrada ${item.sku} ${line.part} lote=${line.lot}: ${error.message}`);
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
