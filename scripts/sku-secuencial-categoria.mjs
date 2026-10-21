#!/usr/bin/env node
/**
 * Restaura el SKU interno por categoría en todo el catálogo:
 * EQUIPO-000001, INSUMOS-000001, ACCESORIOS-000001, REFACCIONES-000001…
 * El n.º de parte / referencia del fabricante no se toca.
 *
 *   node scripts/sku-secuencial-categoria.mjs [--dry-run] [--cloud]
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  catalogCategoryOf,
  formatSequentialSku,
} from "./lib/catalog-sku.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const cloud = args.includes("--cloud");
const PAGE = 1000;

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
    Prefer: "return=minimal",
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
    throw new Error(`${method} ${path}: ${msg}`);
  }
  return data;
}

async function fetchAll(base, key) {
  const rows = [];
  let from = 0;
  while (true) {
    const to = from + PAGE - 1;
    const page = await rest(
      base,
      key,
      "GET",
      `/rest/v1/inventory_items?select=id,sku,name,category,item_kind,part_number,created_at&order=created_at.asc&offset=${from}&limit=${PAGE}`,
      null,
      { Range: `${from}-${to}`, Prefer: "count=exact" }
    );
    if (!Array.isArray(page) || !page.length) break;
    rows.push(...page);
    if (page.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

function plannedSku(items) {
  const groups = new Map();
  for (const item of items) {
    const category = catalogCategoryOf(item);
    const list = groups.get(category) ?? [];
    list.push(item);
    groups.set(category, list);
  }
  const changes = [];
  const counts = {};
  for (const [category, list] of groups) {
    list.sort((a, b) => {
      const created = String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
      if (created) return created;
      return String(a.id).localeCompare(String(b.id));
    });
    counts[category] = list.length;
    list.forEach((item, index) => {
      const next = formatSequentialSku(category, index + 1);
      if (item.sku !== next) changes.push({ ...item, category, next });
    });
  }
  return { changes, counts };
}

async function patchSku(base, key, id, sku) {
  await rest(base, key, "PATCH", `/rest/v1/inventory_items?id=eq.${id}`, { sku });
}

async function main() {
  const env = loadEnv();
  const { url, key } = envForTarget(env);
  if (!url || !key) {
    console.error("Falta URL o anon key de Supabase.");
    process.exit(1);
  }
  console.log(`${dryRun ? "Simulación" : "Aplicando"} en ${url}`);
  const items = await fetchAll(url, key);
  const { changes, counts } = plannedSku(items);
  console.log(`Productos: ${items.length}. SKU a cambiar: ${changes.length}.`);
  console.log("Por categoría:", counts);
  if (!changes.length) {
    console.log("Nada que actualizar.");
    return;
  }
  for (const row of changes.slice(0, 10)) {
    console.log(`  ${row.sku}  →  ${row.next}  ·  ${row.name}`);
  }
  if (changes.length > 10) console.log(`  … ${changes.length - 10} más`);
  if (dryRun) return;

  let done = 0;
  for (const row of changes) {
    await patchSku(url, key, row.id, `__mas_sku__${row.id}`);
    done += 1;
    if (done % 50 === 0) console.log(`  temporal ${done}/${changes.length}`);
  }
  done = 0;
  for (const row of changes) {
    await patchSku(url, key, row.id, row.next);
    done += 1;
    if (done % 50 === 0) console.log(`  final ${done}/${changes.length}`);
  }
  console.log(`Listo. ${changes.length} SKU restaurados al código interno.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
