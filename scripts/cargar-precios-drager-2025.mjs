#!/usr/bin/env node
/**
 * Cruza LISTA DE PRECIOS CONSUMIBLE DRÄGER 2025 con el catálogo registrado.
 * - Actualiza cost_price (precio de lista) en coincidencias. No cambia unit_price (venta).
 * - Da de alta los ITEMs que no están registrados, con ese código como n.º de parte
 *   y SKU interno (ACCESORIOS-000123). Existencia 0, alerta de agotado apagada, venta pendiente.
 *
 *   node scripts/cargar-precios-drager-2025.mjs [--dry-run] [--cloud] [--no-insert]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createSkuAllocator } from "./lib/catalog-sku.mjs";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_XLSX = join(
  ROOT,
  "scripts/data/lista-precios-consumible-drager-2025.xlsx"
);
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const cloud = args.includes("--cloud");
const noInsert = args.includes("--no-insert");
const INSERT_BATCH = 40;

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

function parsePrice(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 10000) / 10000;
  }
  const raw = String(value ?? "")
    .replace(/[$\s]/g, "")
    .replace(/,/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : null;
}

function cellItem(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
    return String(value);
  }
  return String(value ?? "").trim();
}

function parsePackPieces(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  const n = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 1;
}

function headerKey(value) {
  return fold(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function readPriceList(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`No está el Excel de precios: ${filePath}`);
  }
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName =
    workbook.SheetNames.find((name) => /lista|precio/i.test(name)) ??
    workbook.SheetNames[0];
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  });

  let headerRow = -1;
  let itemCol = -1;
  let nameCol = -1;
  let packCol = -1;
  let piecesCol = -1;
  let priceCol = -1;
  for (let i = 0; i < Math.min(matrix.length, 40); i += 1) {
    const row = matrix[i].map((cell) => headerKey(cell));
    const item = row.findIndex((cell) => cell === "item" || cell === "pn" || cell === "n parte");
    const price = row.findIndex((cell) =>
      cell.includes("precio") && (cell.includes("lista") || cell.includes("2025") || cell === "precio")
    );
    if (item >= 0 && price >= 0) {
      headerRow = i;
      itemCol = item;
      nameCol = row.findIndex((cell) => cell.includes("descrip"));
      packCol = row.findIndex((cell) => cell.includes("present"));
      piecesCol = row.findIndex(
        (cell) =>
          (cell.includes("pzs") || cell.includes("pz") || cell.includes("piezas")) &&
          cell.includes("pack")
      );
      priceCol = price;
      break;
    }
  }
  if (headerRow < 0) {
    throw new Error(`No se encontraron columnas ITEM / PRECIO en ${sheetName}.`);
  }

  const byPn = new Map();
  for (let i = headerRow + 1; i < matrix.length; i += 1) {
    const row = matrix[i];
    const item = cellItem(row[itemCol]);
    const pn = normalizePn(item);
    const price = parsePrice(row[priceCol]);
    if (!pn || price == null || price < 0) continue;
    byPn.set(pn, {
      item,
      name: String(row[nameCol] ?? "").trim(),
      presentation: String(row[packCol] ?? "").trim(),
      packPieces: piecesCol >= 0 ? parsePackPieces(row[piecesCol]) : 1,
      price,
      excelRow: i + 1,
    });
  }
  return { sheetName, headerRow: headerRow + 1, byPn };
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

function matchCatalog(items, priceByPn) {
  const matched = [];
  const usedExcel = new Set();
  const catalogKeys = catalogCodeKeys(items);

  for (const item of items) {
    const pn = normalizePn(item.part_number) || normalizePn(item.sku);
    const exact = pn ? priceByPn.get(pn) : null;
    if (exact) {
      usedExcel.add(pn);
      matched.push({
        item,
        list: exact,
        how: normalizePn(item.part_number) ? "part_number" : "sku",
      });
    }
  }

  return {
    matched,
    catalogKeys,
    catalogWithoutPrice: items.filter(
      (item) => !matched.some((row) => row.item.id === item.id)
    ),
    excelUnmatched: [...priceByPn.entries()]
      .filter(([pn]) => !usedExcel.has(pn) && !catalogKeys.has(pn))
      .map(([, row]) => row),
  };
}

function noteWithCost(notes, cost) {
  const cleaned = String(notes ?? "")
    .replace(/\n?<!--mas-cost:[0-9.]+-->\s*/g, "")
    .trimEnd();
  return `${cleaned}\n<!--mas-cost:${cost}-->`.trim();
}

function noteWithoutStockAlert(notes) {
  const cleaned = String(notes ?? "").replace(/\n?<!--mas-no-stock-alert-->\s*/g, "");
  return `${cleaned}\n<!--mas-no-stock-alert-->`.trim();
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

function isMissingCostColumn(error) {
  return isMissingColumn(error, "cost_price");
}

function unitFromList(row) {
  const pres = fold(row.presentation);
  if (pres.includes("caja")) return "caja";
  if (pres.includes("paquete") || pres.includes("pack") || pres.includes("bolsa")) {
    return "paquete";
  }
  if (pres.includes("rollo")) return "rollo";
  if (pres.includes("par")) return "par";
  if (pres.includes("frasco")) return "frasco";
  if (Number(row.packPieces) > 1) return "paquete";
  return "pieza";
}

function buildNewRow(list, options = {}) {
  const part = String(list.item).trim();
  const sku = options.sku || part;
  const name = (list.name || part).slice(0, 500);
  const details = [];
  if (list.presentation) details.push(`Presentación: ${list.presentation}`);
  if (Number(list.packPieces) > 1) details.push(`${list.packPieces} pzs por pack`);
  details.push("Alta desde lista de precios consumible Dräger 2025. Precio de venta pendiente.");
  let notes = "Lista de precios consumible Dräger vigente 2025.";
  if (options.useCostMarker && list.price > 0) {
    notes = noteWithCost(notes, list.price);
  }
  if (options.useAlertMarker) {
    notes = noteWithoutStockAlert(notes);
  }
  const row = {
    sku,
    name,
    category: "accesorios",
    item_kind: "producto",
    description: details.join(". "),
    quantity: 0,
    min_stock: 0,
    unit: unitFromList(list),
    location: "",
    brand: "Dräger",
    color_tag: "turquesa",
    model: "",
    serial_number: "",
    unit_price: 0,
    supplier: "Dräger",
    notes,
    asset_status: "operativo",
    is_active: true,
    tracks_lot: false,
    tracks_serial: false,
    tracks_expiry: false,
    max_stock: 0,
    reorder_point: 0,
    part_number: part,
    manufacturer: "Dräger",
    subcategory: "consumible",
  };
  if (!options.omitCost) row.cost_price = list.price;
  if (!options.omitAlerts) row.stock_alerts_enabled = false;
  return row;
}

function omitUnknownColumns(row, missing) {
  const next = { ...row };
  for (const column of missing) delete next[column];
  return next;
}

async function insertNewProducts(base, key, unmatched, nextSku) {
  const result = {
    inserted: 0,
    skipped: 0,
    errors: 0,
    sample: [],
    missingColumns: [],
  };
  if (unmatched.length === 0) return result;

  const missing = new Set();
  let useCostMarker = false;
  let useAlertMarker = false;

  const postBatch = async (batch) => {
    const payload = batch.map((list) =>
      omitUnknownColumns(
        buildNewRow(list, {
          omitCost: missing.has("cost_price"),
          omitAlerts: missing.has("stock_alerts_enabled"),
          useCostMarker,
          useAlertMarker,
          sku: nextSku?.("accesorios"),
        }),
        missing
      )
    );
    try {
      const created = await rest(base, key, "POST", "/rest/v1/inventory_items", payload);
      const count = Array.isArray(created) ? created.length : payload.length;
      result.inserted += count;
      for (const row of payload.slice(0, 8)) {
        if (result.sample.length < 12) {
          result.sample.push({ sku: row.sku, name: row.name, cost: row.cost_price ?? null });
        }
      }
      return;
    } catch (error) {
      if (isMissingColumn(error, "cost_price") && !missing.has("cost_price")) {
        missing.add("cost_price");
        useCostMarker = true;
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

  const list = readPriceList(DEFAULT_XLSX);
  let items;
  try {
    items = await restAll(
      base,
      key,
      "/rest/v1/inventory_items?select=id,sku,name,brand,part_number,unit_price,cost_price,notes&order=sku"
    );
  } catch (error) {
    if (!isMissingCostColumn(error)) throw error;
    items = await restAll(
      base,
      key,
      "/rest/v1/inventory_items?select=id,sku,name,brand,part_number,unit_price,notes&order=sku"
    );
  }
  const result = matchCatalog(items, list.byPn);
  const updates = result.matched
    .map((row) => {
      const current = Number(row.item.cost_price ?? 0);
      const next = Number(row.list.price);
      if (!Number.isFinite(next)) return null;
      if (Math.abs(current - next) < 0.0001) return null;
      return {
        id: row.item.id,
        sku: row.item.sku,
        partNumber: row.item.part_number,
        name: row.item.name,
        how: row.how,
        from: current,
        to: next,
        notes: row.item.notes,
      };
    })
    .filter(Boolean);

  const toInsert = noInsert ? [] : result.excelUnmatched;

  const summary = {
    target: cloud ? "cloud" : "local",
    sheet: list.sheetName,
    excelItems: list.byPn.size,
    catalog: items.length,
    matched: result.matched.length,
    byPartNumber: result.matched.filter((row) => row.how === "part_number").length,
    bySku: result.matched.filter((row) => row.how === "sku").length,
    toUpdate: updates.length,
    catalogWithoutPrice: result.catalogWithoutPrice.length,
    excelNotInCatalog: result.excelUnmatched.length,
    toInsert: toInsert.length,
    sampleNew: toInsert.slice(0, 12).map((row) => ({
      partNumber: row.item,
      name: row.name,
      cost: row.price,
    })),
    sampleUpdates: updates.slice(0, 8),
  };

  const reportPath = join(ROOT, "scripts/data/drager-2025-match-report.json");
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        ...summary,
        matched: result.matched.map((row) => ({
          sku: row.item.sku,
          partNumber: row.item.part_number,
          name: row.item.name,
          how: row.how,
          cost: row.list.price,
          excelItem: row.list.item,
          excelName: row.list.name,
        })),
        newProducts: toInsert.map((row) => ({
          sku: row.item,
          partNumber: row.item,
          name: row.name,
          presentation: row.presentation,
          packPieces: row.packPieces,
          cost: row.price,
        })),
      },
      null,
      2
    )
  );

  if (dryRun) {
    console.log(JSON.stringify({ ...summary, report: reportPath }, null, 2));
    return;
  }

  let updated = 0;
  let viaNotes = 0;
  let errors = 0;
  let usedNotesFallback = false;

  for (const change of updates) {
    try {
      if (usedNotesFallback) {
        await rest(
          base,
          key,
          "PATCH",
          `/rest/v1/inventory_items?id=eq.${change.id}`,
          { notes: noteWithCost(change.notes, change.to) }
        );
        viaNotes += 1;
      } else {
        try {
          await rest(
            base,
            key,
            "PATCH",
            `/rest/v1/inventory_items?id=eq.${change.id}`,
            { cost_price: change.to }
          );
        } catch (error) {
          if (!isMissingCostColumn(error)) throw error;
          usedNotesFallback = true;
          await rest(
            base,
            key,
            "PATCH",
            `/rest/v1/inventory_items?id=eq.${change.id}`,
            { notes: noteWithCost(change.notes, change.to) }
          );
          viaNotes += 1;
        }
      }
      updated += 1;
    } catch (error) {
      errors += 1;
      console.warn(`${change.sku}: ${error.message}`);
    }
  }

  const inserted = await insertNewProducts(
    base,
    key,
    toInsert,
    createSkuAllocator(items)
  );

  console.log(
    JSON.stringify(
      {
        ...summary,
        updated,
        viaNotes,
        errors,
        notesFallback: usedNotesFallback,
        inserted: inserted.inserted,
        insertSkipped: inserted.skipped,
        insertErrors: inserted.errors,
        insertSample: inserted.sample,
        insertMissingColumns: inserted.missingColumns,
        report: reportPath,
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
