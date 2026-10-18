#!/usr/bin/env node
/**
 * Cruza un listado capturado (ITEM + descripción + marca) con el catálogo.
 * No toca existencias ni precios de productos que ya existen.
 * Da de alta los códigos nuevos con alerta de agotado apagada.
 *
 *   node scripts/cargar-listado-catalogo.mjs [--dry-run] [--cloud] [json]
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_JSON = join(ROOT, "scripts/data/listado-catalogo-captura.json");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const cloud = args.includes("--cloud");
const jsonPath = resolve(
  args.find((value) => !value.startsWith("--")) || DEFAULT_JSON
);
const INSERT_BATCH = 40;

const BRAND_COLOR = {
  Dräger: "turquesa",
  Masimo: "morado",
  "Welch Allyn": "naranja",
  "3M": "amarillo",
  "F&P": "naranja",
  Philips: "azul",
  ASP: "verde",
};

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
    const chunk = await rest(base, key, "GET", path, null, {
      Range: `${from}-${from + page - 1}`,
    });
    if (Array.isArray(chunk)) rows.push(...chunk);
    if (!Array.isArray(chunk) || chunk.length < page) break;
  }
  return rows;
}

function fold(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizePn(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function isMissingColumn(error, column) {
  const text = String(error?.message ?? error ?? "").toLowerCase();
  return (
    text.includes(column.toLowerCase()) &&
    (text.includes("does not exist") ||
      text.includes("could not find") ||
      text.includes("schema cache") ||
      text.includes("pgrst204") ||
      text.includes("42703"))
  );
}

function unitFromPresentation(presentation) {
  const pres = fold(presentation);
  if (pres.includes("caja")) return "caja";
  if (pres.includes("paquete") || pres.includes("pack") || pres.includes("bolsa")) {
    return "paquete";
  }
  if (pres.includes("rollo")) return "rollo";
  if (pres.includes("par")) return "par";
  if (pres.includes("frasco")) return "frasco";
  if (pres.includes("kit") || pres.includes("juego") || pres.includes("set")) return "paquete";
  return "pieza";
}

function loadList(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`No está el listado: ${filePath}`);
  }
  const rows = JSON.parse(readFileSync(filePath, "utf8"));
  if (!Array.isArray(rows)) throw new Error("El JSON debe ser un arreglo.");
  const byPn = new Map();
  for (const row of rows) {
    const item = String(row.item ?? row.sku ?? "").trim();
    const pn = normalizePn(item);
    if (!pn || pn.length < 3) continue;
    if (byPn.has(pn)) continue;
    byPn.set(pn, {
      item,
      name: String(row.name ?? item).trim() || item,
      presentation: String(row.presentation ?? "").trim(),
      brand: String(row.brand ?? "Dräger").trim() || "Dräger",
    });
  }
  return byPn;
}

function catalogCodeKeys(items) {
  const keys = new Set();
  for (const item of items) {
    const sku = normalizePn(item.sku);
    const pn = normalizePn(item.part_number);
    if (sku) keys.add(sku);
    if (pn) keys.add(pn);
  }
  return keys;
}

function noteWithoutStockAlert(notes) {
  const cleaned = String(notes ?? "").replace(/\n?<!--mas-no-stock-alert-->\s*/g, "");
  return `${cleaned}\n<!--mas-no-stock-alert-->`.trim();
}

function buildNewRow(list, options = {}) {
  const sku = String(list.item).trim();
  const brand = list.brand || "Dräger";
  const details = [];
  if (list.presentation) details.push(`Presentación: ${list.presentation}`);
  details.push(
    "Alta desde listado de catálogo. Existencia 0, alerta de agotado apagada, venta pendiente."
  );
  let notes = "Alta desde listado capturado (ITEM / descripción / marca).";
  if (options.useAlertMarker) notes = noteWithoutStockAlert(notes);
  const row = {
    sku,
    name: list.name.slice(0, 500),
    category: "accesorios",
    item_kind: "producto",
    description: details.join(". "),
    quantity: 0,
    min_stock: 0,
    unit: unitFromPresentation(list.presentation),
    location: "",
    brand,
    color_tag: BRAND_COLOR[brand] || "",
    model: "",
    serial_number: "",
    unit_price: 0,
    cost_price: 0,
    stock_alerts_enabled: false,
    supplier: brand,
    notes,
    asset_status: "operativo",
    is_active: true,
    tracks_lot: false,
    tracks_serial: false,
    tracks_expiry: false,
    max_stock: 0,
    reorder_point: 0,
    part_number: sku,
    manufacturer: brand,
    subcategory: "listado",
  };
  if (options.omitCost) delete row.cost_price;
  if (options.omitAlerts) delete row.stock_alerts_enabled;
  if (options.omitColor) delete row.color_tag;
  return row;
}

async function insertNewProducts(base, key, unmatched) {
  const result = {
    inserted: 0,
    skipped: 0,
    errors: 0,
    sample: [],
    missingColumns: [],
  };
  if (unmatched.length === 0) return result;
  const missing = new Set();
  let useAlertMarker = false;

  const postBatch = async (batch) => {
    const payload = batch.map((list) => {
      const row = buildNewRow(list, {
        omitCost: missing.has("cost_price"),
        omitAlerts: missing.has("stock_alerts_enabled"),
        omitColor: missing.has("color_tag"),
        useAlertMarker,
      });
      for (const column of missing) delete row[column];
      return row;
    });
    try {
      const created = await rest(base, key, "POST", "/rest/v1/inventory_items", payload);
      const count = Array.isArray(created) ? created.length : payload.length;
      result.inserted += count;
      for (const row of payload) {
        if (result.sample.length < 12) {
          result.sample.push({ sku: row.sku, name: row.name, brand: row.brand });
        }
      }
    } catch (error) {
      if (isMissingColumn(error, "cost_price") && !missing.has("cost_price")) {
        missing.add("cost_price");
        result.missingColumns.push("cost_price");
        await postBatch(batch);
        return;
      }
      if (
        isMissingColumn(error, "stock_alerts_enabled") &&
        !missing.has("stock_alerts_enabled")
      ) {
        missing.add("stock_alerts_enabled");
        useAlertMarker = true;
        result.missingColumns.push("stock_alerts_enabled");
        await postBatch(batch);
        return;
      }
      if (isMissingColumn(error, "color_tag") && !missing.has("color_tag")) {
        missing.add("color_tag");
        result.missingColumns.push("color_tag");
        await postBatch(batch);
        return;
      }
      throw error;
    }
  };

  for (let i = 0; i < unmatched.length; i += INSERT_BATCH) {
    const batch = unmatched.slice(i, i + INSERT_BATCH);
    try {
      await postBatch(batch);
    } catch (error) {
      for (const list of batch) {
        try {
          await postBatch([list]);
        } catch (inner) {
          const msg = String(inner.message ?? inner);
          if (msg.includes("23505") || /duplicate|unique/i.test(msg)) {
            result.skipped += 1;
            continue;
          }
          result.errors += 1;
          console.warn(`${list.item}: ${msg}`);
        }
      }
    }
  }
  return result;
}

async function main() {
  const env = loadEnv();
  const { url: base, key } = envForTarget(env);
  if (!base || !key) throw new Error("Faltan URL/anon de Supabase.");

  const list = loadList(jsonPath);
  const items = await restAll(
    base,
    key,
    "/rest/v1/inventory_items?select=id,sku,name,brand,part_number,quantity&order=sku"
  );
  const catalogKeys = catalogCodeKeys(items);
  const matched = [];
  const unmatched = [];
  for (const row of list.values()) {
    const pn = normalizePn(row.item);
    if (catalogKeys.has(pn)) matched.push(row);
    else unmatched.push(row);
  }

  const byBrand = {};
  for (const row of unmatched) {
    byBrand[row.brand] = (byBrand[row.brand] || 0) + 1;
  }

  const summary = {
    target: cloud ? "cloud" : "local",
    source: jsonPath,
    listItems: list.size,
    catalog: items.length,
    matched: matched.length,
    toInsert: unmatched.length,
    newByBrand: byBrand,
    sampleMatched: matched.slice(0, 8).map((row) => ({
      item: row.item,
      name: row.name,
    })),
    sampleNew: unmatched.slice(0, 12).map((row) => ({
      sku: row.item,
      brand: row.brand,
      name: row.name,
    })),
  };

  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const inserted = await insertNewProducts(base, key, unmatched);
  console.log(
    JSON.stringify(
      {
        ...summary,
        inserted: inserted.inserted,
        insertSkipped: inserted.skipped,
        insertErrors: inserted.errors,
        insertSample: inserted.sample,
        insertMissingColumns: inserted.missingColumns,
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
