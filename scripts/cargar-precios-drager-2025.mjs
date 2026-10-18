#!/usr/bin/env node
/**
 * Cruza LISTA DE PRECIOS CONSUMIBLE DRÄGER 2025 con el catálogo registrado.
 * Escribe cost_price (precio de lista). No inventa ni cambia unit_price (venta).
 *
 *   node scripts/cargar-precios-drager-2025.mjs [--dry-run] [--cloud]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

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
    const item = String(row[itemCol] ?? "").trim();
    const pn = normalizePn(item);
    const price = parsePrice(row[priceCol]);
    if (!pn || price == null || price < 0) continue;
    byPn.set(pn, {
      item,
      name: String(row[nameCol] ?? "").trim(),
      presentation: String(row[packCol] ?? "").trim(),
      price,
      excelRow: i + 1,
    });
  }
  return { sheetName, headerRow: headerRow + 1, byPn };
}

function matchCatalog(items, priceByPn) {
  const matched = [];
  const usedExcel = new Set();

  for (const item of items) {
    const pn = normalizePn(item.part_number);
    const exact = pn ? priceByPn.get(pn) : null;
    if (exact) {
      usedExcel.add(pn);
      matched.push({ item, list: exact, how: "part_number" });
    }
  }

  return {
    matched,
    catalogWithoutPrice: items.filter(
      (item) => !matched.some((row) => row.item.id === item.id)
    ),
    excelUnmatched: [...priceByPn.entries()]
      .filter(([pn]) => !usedExcel.has(pn))
      .map(([, row]) => row),
  };
}

function noteWithCost(notes, cost) {
  const cleaned = String(notes ?? "")
    .replace(/\n?<!--mas-cost:[0-9.]+-->\s*/g, "")
    .trimEnd();
  return `${cleaned}\n<!--mas-cost:${cost}-->`.trim();
}

function isMissingCostColumn(error) {
  const text = String(error?.message ?? error ?? "").toLowerCase();
  return (
    text.includes("cost_price") &&
    (text.includes("does not exist") ||
      text.includes("could not find") ||
      text.includes("schema cache") ||
      text.includes("pgrst204") ||
      text.includes("42703"))
  );
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

  const summary = {
    target: cloud ? "cloud" : "local",
    sheet: list.sheetName,
    excelItems: list.byPn.size,
    catalog: items.length,
    matched: result.matched.length,
    byPartNumber: result.matched.filter((row) => row.how === "part_number").length,
    byName: result.matched.filter((row) => row.how === "nombre").length,
    toUpdate: updates.length,
    catalogWithoutPrice: result.catalogWithoutPrice.length,
    excelNotInCatalog: result.excelUnmatched.length,
    sample: updates.slice(0, 12),
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

  console.log(
    JSON.stringify(
      {
        ...summary,
        updated,
        viaNotes,
        errors,
        notesFallback: usedNotesFallback,
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
