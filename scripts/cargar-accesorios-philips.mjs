#!/usr/bin/env node
/**
 * Catálogo de accesorios Philips para equipos ya registrados:
 * IntelliVue MX550 (866066) y Efficia DFM100 (866199).
 *
 * Cruza códigos oficiales (12NC / M-code) con el catálogo. No toca existencias
 * ni precios de lo que ya está. Da de alta los faltantes con existencia 0 y
 * alerta de agotado apagada. Etiqueta la línea (intellivue / dfm100) y arma
 * kits de instalación.
 *
 *   node scripts/cargar-accesorios-philips.mjs [--dry-run] [--cloud]
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_JSON = join(
  ROOT,
  "scripts/data/accesorios-philips-intellivue-dfm100.json"
);
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const cloud = args.includes("--cloud");
const jsonPath = resolve(
  args.find((value) => !value.startsWith("--")) || DEFAULT_JSON
);
const INSERT_BATCH = 40;
const BRAND = "Philips";
const COLOR = "azul";

const EQUIPMENT_LABEL = {
  intellivue: "IntelliVue MX400/450/500/550",
  dfm100: "Efficia DFM100",
};

const EXISTING_LINE_BY_PN = {
  "4083": ["intellivue"],
  "2281": ["intellivue"],
  "21076A": ["intellivue"],
  "453564255161": ["intellivue"],
  "867039": ["intellivue"],
  "989803174581": ["intellivue"],
  "989803104151": ["intellivue", "dfm100"],
  "989803143201": ["intellivue", "dfm100"],
  "989803182621": ["intellivue", "dfm100"],
  "989803182641": ["intellivue", "dfm100"],
  "989803182661": ["intellivue", "dfm100"],
  "989803183231": ["intellivue", "dfm100"],
  "989803209751": ["intellivue", "dfm100"],
  "989803209771": ["intellivue", "dfm100"],
  M1191BL: ["intellivue", "dfm100"],
  M1192A: ["intellivue", "dfm100"],
  M1193A: ["intellivue", "dfm100"],
  M1194A: ["intellivue", "dfm100"],
  M1196A: ["intellivue", "dfm100"],
  M1572A: ["intellivue"],
  M1576A: ["intellivue"],
  M1597B: ["intellivue", "dfm100"],
  M1597C: ["intellivue", "dfm100"],
  M1598B: ["intellivue", "dfm100"],
  M1644A: ["intellivue", "dfm100"],
  M2501A: ["intellivue", "dfm100"],
  "40457C": ["intellivue"],
  M1669A: ["intellivue", "dfm100"],
  M1673A: ["intellivue", "dfm100"],
  M2481A: ["intellivue"],
  M3708A: ["intellivue"],
  M3543A: ["dfm100"],
  "866066": ["intellivue"],
  "866199": ["dfm100"],
};

const KITS = [
  {
    code: "KIT-000004",
    name: "Instalación · IntelliVue MX550",
    description:
      "Accesorios típicos para poner en marcha o reponer un monitor Philips IntelliVue MX550.",
    serviceType: "instalacion",
    equipmentKind: "monitor",
    lines: [
      { sku: "M1668A", quantity: 1, notes: "Tronco ECG 5 derivaciones" },
      { sku: "M1644A", quantity: 1, notes: "Leadset 5 snap AAMI" },
      { sku: "M1191BL", quantity: 1, notes: "SpO2 adulto 3 m" },
      { sku: "M1574A", quantity: 1, notes: "Manguito adulto" },
      { sku: "M1572A", quantity: 1, notes: "Manguito pediátrico" },
      { sku: "M1598B", quantity: 1, notes: "Manguera NBP 1.5 m" },
      { sku: "21078A", quantity: 1, notes: "Sonda cutánea" },
      { sku: "21076A", quantity: 1, notes: "Sonda rectal" },
      { sku: "M4605A", quantity: 1, notes: "Batería MX550" },
      { sku: "40457C", quantity: 1, notes: "Papel de registro" },
    ],
  },
  {
    code: "KIT-000005",
    name: "Instalación · Efficia DFM100",
    description:
      "Accesorios típicos para poner en marcha o reponer un desfibrilador Philips Efficia DFM100.",
    serviceType: "instalacion",
    equipmentKind: "desfibrilador",
    lines: [
      { sku: "989803160641", quantity: 1, notes: "Tronco ECG Efficia 3/5" },
      { sku: "989803160651", quantity: 1, notes: "Leadset 3 grabber AAMI" },
      { sku: "989803197111", quantity: 1, notes: "Cable de parches" },
      { sku: "M3713A", quantity: 1, notes: "Parches adulto/niño" },
      { sku: "989803190371", quantity: 1, notes: "Batería DFM100" },
      { sku: "M1191B", quantity: 1, notes: "SpO2 adulto 2 m" },
      { sku: "989803177521", quantity: 1, notes: "Manguito adulto" },
      { sku: "989803209761", quantity: 1, notes: "Manguera NBP 1.5 m" },
      { sku: "989803196431", quantity: 1, notes: "Paletas externas Efficia" },
      { sku: "989803190381", quantity: 1, notes: "Papel 50 mm" },
    ],
  },
];

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
  if (pres.includes("paquete") || pres.includes("pack")) return "paquete";
  if (pres.includes("par")) return "par";
  return "pieza";
}

function lineKey(equipment) {
  const set = new Set((equipment || []).map((value) => fold(value)));
  const parts = [];
  if (set.has("intellivue")) parts.push("intellivue");
  if (set.has("dfm100")) parts.push("dfm100");
  return parts.join("-") || "philips";
}

function compatibleLabel(equipment) {
  return (equipment || [])
    .map((id) => EQUIPMENT_LABEL[id] || id)
    .filter(Boolean)
    .join(" y ");
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
    const equipment = Array.isArray(row.equipment) ? row.equipment : ["intellivue"];
    byPn.set(pn, {
      item,
      name: String(row.name ?? item).trim() || item,
      presentation: String(row.presentation ?? "PIEZA").trim(),
      category: String(row.category ?? "accesorios").trim() || "accesorios",
      group: String(row.group ?? "").trim(),
      equipment,
    });
  }
  return byPn;
}

function catalogCodeKeys(items) {
  const keys = new Map();
  for (const item of items) {
    for (const value of [item.sku, item.part_number]) {
      const pn = normalizePn(value);
      if (pn && !keys.has(pn)) keys.set(pn, item);
    }
  }
  return keys;
}

function noteWithoutStockAlert(notes) {
  const cleaned = String(notes ?? "").replace(/\n?<!--mas-no-stock-alert-->\s*/g, "");
  return `${cleaned}\n<!--mas-no-stock-alert-->`.trim();
}

function buildNewRow(list, options = {}) {
  const sku = String(list.item).trim();
  const compatible = compatibleLabel(list.equipment);
  const details = [];
  if (list.presentation) details.push(`Presentación: ${list.presentation}`);
  if (list.group) details.push(`Grupo: ${list.group}`);
  details.push(`Compatible con ${compatible}.`);
  details.push(
    "Alta de catálogo Philips. Existencia 0, alerta de agotado apagada, venta pendiente."
  );
  let notes = `Catálogo Philips · ${compatible}.`;
  if (options.useAlertMarker) notes = noteWithoutStockAlert(notes);
  const disposable = list.category === "insumos";
  const row = {
    sku,
    name: list.name.slice(0, 500),
    category: list.category,
    item_kind: "producto",
    description: details.join(" "),
    quantity: 0,
    min_stock: 0,
    unit: unitFromPresentation(list.presentation),
    location: "",
    brand: BRAND,
    color_tag: COLOR,
    model: list.equipment.includes("dfm100") && !list.equipment.includes("intellivue")
      ? "Efficia DFM100"
      : "IntelliVue MX550",
    serial_number: "",
    unit_price: 0,
    cost_price: 0,
    stock_alerts_enabled: false,
    supplier: BRAND,
    notes,
    asset_status: "operativo",
    is_active: true,
    tracks_lot: disposable,
    tracks_serial: false,
    tracks_expiry: disposable,
    max_stock: 0,
    reorder_point: 0,
    part_number: sku,
    manufacturer: BRAND,
    subcategory: lineKey(list.equipment),
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
          result.sample.push({ sku: row.sku, name: row.name });
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

async function tagExisting(base, key, items) {
  const tagged = [];
  for (const item of items) {
    const skuKey = normalizePn(item.sku);
    const pnKey = normalizePn(item.part_number);
    const equipment = EXISTING_LINE_BY_PN[item.sku] || EXISTING_LINE_BY_PN[item.part_number];
    if (!equipment) continue;
    const next = lineKey(equipment);
    const current = String(item.subcategory ?? "").trim();
    if (current === next || current === "listado") continue;
    if (current && current !== "philips") continue;
    tagged.push({ id: item.id, sku: item.sku, subcategory: next });
  }
  if (dryRun) return { tagged: tagged.length, sample: tagged.slice(0, 8) };
  let updated = 0;
  for (const row of tagged) {
    try {
      await rest(
        base,
        key,
        "PATCH",
        `/rest/v1/inventory_items?id=eq.${row.id}`,
        { subcategory: row.subcategory }
      );
      updated += 1;
    } catch (error) {
      if (isMissingColumn(error, "subcategory")) break;
      console.warn(`tag ${row.sku}: ${error.message}`);
    }
  }
  return { tagged: updated, sample: tagged.slice(0, 8) };
}

async function upsertKits(base, key, items) {
  const bySku = new Map();
  for (const item of items) {
    bySku.set(normalizePn(item.sku), item);
    if (item.part_number) bySku.set(normalizePn(item.part_number), item);
  }
  const result = { created: 0, updated: 0, skipped: 0, missing: [] };
  let kits;
  try {
    kits = await restAll(base, key, "/rest/v1/supply_kits?select=id,code,name");
  } catch (error) {
    result.error = String(error.message);
    return result;
  }
  const kitByCode = new Map(kits.map((row) => [String(row.code), row]));

  for (const kit of KITS) {
    const lines = [];
    for (const line of kit.lines) {
      const product = bySku.get(normalizePn(line.sku));
      if (!product) {
        result.missing.push({ kit: kit.code, sku: line.sku });
        continue;
      }
      lines.push({
        product_id: product.id,
        quantity: line.quantity,
        notes: line.notes,
      });
    }
    if (!lines.length) {
      result.skipped += 1;
      continue;
    }
    if (dryRun) {
      if (kitByCode.has(kit.code)) result.updated += 1;
      else result.created += 1;
      continue;
    }
    const payload = {
      code: kit.code,
      name: kit.name,
      description: kit.description,
      service_type: kit.serviceType,
      equipment_kind: kit.equipmentKind,
      is_active: true,
      created_by: "catalogo-philips",
    };
    let kitRow = kitByCode.get(kit.code);
    if (kitRow) {
      await rest(
        base,
        key,
        "PATCH",
        `/rest/v1/supply_kits?id=eq.${kitRow.id}`,
        payload
      );
      result.updated += 1;
    } else {
      const created = await rest(base, key, "POST", "/rest/v1/supply_kits", payload);
      kitRow = Array.isArray(created) ? created[0] : created;
      result.created += 1;
    }
    await rest(
      base,
      key,
      "DELETE",
      `/rest/v1/supply_kit_lines?kit_id=eq.${kitRow.id}`
    );
    await rest(
      base,
      key,
      "POST",
      "/rest/v1/supply_kit_lines",
      lines.map((line, index) => ({
        kit_id: kitRow.id,
        product_id: line.product_id,
        quantity: line.quantity,
        sort_order: index,
        notes: line.notes,
      }))
    );
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
    "/rest/v1/inventory_items?select=id,sku,name,brand,part_number,quantity,subcategory,category&order=sku"
  );
  const catalogKeys = catalogCodeKeys(items);
  const matched = [];
  const unmatched = [];
  for (const row of list.values()) {
    const pn = normalizePn(row.item);
    if (catalogKeys.has(pn)) matched.push({ ...row, existing: catalogKeys.get(pn) });
    else unmatched.push(row);
  }

  const byLine = { intellivue: 0, dfm100: 0, both: 0 };
  for (const row of unmatched) {
    const hasI = row.equipment.includes("intellivue");
    const hasD = row.equipment.includes("dfm100");
    if (hasI && hasD) byLine.both += 1;
    else if (hasD) byLine.dfm100 += 1;
    else byLine.intellivue += 1;
  }

  const summary = {
    target: cloud ? "cloud" : "local",
    source: jsonPath,
    listItems: list.size,
    catalog: items.length,
    matched: matched.length,
    toInsert: unmatched.length,
    newByLine: byLine,
    sampleMatched: matched.slice(0, 6).map((row) => ({
      item: row.item,
      sku: row.existing?.sku,
      name: row.existing?.name,
    })),
    sampleNew: unmatched.slice(0, 10).map((row) => ({
      sku: row.item,
      name: row.name,
      line: lineKey(row.equipment),
    })),
  };

  if (dryRun) {
    const tags = await tagExisting(base, key, items);
    const kits = await upsertKits(base, key, items);
    console.log(JSON.stringify({ ...summary, tags, kits }, null, 2));
    return;
  }

  const inserted = await insertNewProducts(base, key, unmatched);
  const refreshed = await restAll(
    base,
    key,
    "/rest/v1/inventory_items?select=id,sku,name,brand,part_number,quantity,subcategory,category&order=sku"
  );
  const tags = await tagExisting(base, key, refreshed);
  const kits = await upsertKits(base, key, refreshed);
  console.log(
    JSON.stringify(
      {
        ...summary,
        inserted: inserted.inserted,
        insertSkipped: inserted.skipped,
        insertErrors: inserted.errors,
        insertSample: inserted.sample,
        insertMissingColumns: inserted.missingColumns,
        tags,
        kits,
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
