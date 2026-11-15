#!/usr/bin/env node
/**
 * Sube brochures en español (cache local o URLs) y reemplaza los EN del mismo brand+model.
 *
 *   node scripts/upload-sales-brochures-es.mjs [--dry-run] [--cloud]
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CACHE = join(ROOT, "tmp-sales-brochures-es");
const BUCKET = "sales-catalog";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const cloud = args.includes("--cloud");
const force = args.includes("--force");

/** Brochures ES: prefer localFile if present, else try urls. */
const BROCHURES = [
  {
    brand: "Fisher & Paykel",
    productLine: "Alto flujo",
    model: "Airvo 2",
    title: "Folleto Airvo 2 Optiflow (ES)",
    tags: ["respiratorio", "alto flujo", "español"],
    localFile: "airvo2-es.pdf",
    urls: ["https://resources.fphcare.com/content/airvo2-features-brochure-pm-185048296-es.pdf"],
  },
  {
    brand: "Philips",
    productLine: "Desfibrilación",
    model: "Efficia DFM100",
    title: "Folleto Efficia DFM100 (ES)",
    tags: ["urgencias", "desfibrilador", "español"],
    localFile: "dfm100-es.pdf",
    urls: ["https://agimed.com.ar/wp-content/uploads/2021/12/DFM100.pdf"],
  },
  {
    brand: "Philips",
    productLine: "Monitoreo fetal",
    model: "Avalon FM20/FM30",
    title: "Folleto Avalon FM20 y FM30 (ES)",
    tags: ["obstetricia", "fetal", "español"],
    localFile: "avalon-es.pdf",
    urls: ["https://www.philips.com.pe/c-dam/b2bhc/mx/marketing/monitoring/avalon-fm20-fm30-es.pdf"],
  },
  {
    brand: "Hill-Rom / Baxter",
    productLine: "Camas hospitalarias",
    model: "Progressa",
    title: "Folleto sistema de cama Progressa (ES)",
    tags: ["UCI", "cama", "español"],
    localFile: "progressa-es.pdf",
    urls: [
      "https://www.normedan.com/wp-content/uploads/2019/09/Hillrom-Progressa.pdf",
      "https://www.ce2spart.com/wp-content/uploads/2022/09/progressa-sistema-cama.pdf",
    ],
  },
  {
    brand: "Hill-Rom / Baxter",
    productLine: "Camas hospitalarias",
    model: "Centuris Pro",
    title: "Ficha técnica Centuris Pro (ES)",
    tags: ["cama", "piso", "español"],
    localFile: "centuris-es.pdf",
    urls: ["https://emlux.com.mx/cms/_lib/file/docfichasproductos/Cama%20Centuris%20pro.pdf"],
  },
  {
    brand: "Masimo",
    productLine: "Monitoreo",
    model: "Radical-7",
    title: "Folleto Radical-7 (ES)",
    tags: ["UCI", "SpO2", "español"],
    localFile: "radical7-es.pdf",
    urls: ["https://www.timedmasimo.com/_files/ugd/d6af25_437cb00814e74970bebea6d469248a4b.pdf"],
  },
  {
    brand: "3M",
    productLine: "Manejo térmico",
    model: "Bair Hugger",
    title: "Folleto Bair Hugger normotermia (ES)",
    tags: ["quirófano", "térmico", "español"],
    localFile: "bair-hugger-es.pdf",
    urls: [
      "https://www.solventum.com/content/dam/public/language-masters/es/msb/document/2025/designed-to-be-different-bair-hugger-brochure-ms-ipss-es.pdf",
    ],
  },
  {
    brand: "Welch Allyn",
    productLine: "Monitoreo",
    model: "Connex Spot Monitor",
    title: "Folleto Connex Spot Monitor (ES)",
    tags: ["piso", "monitoreo", "español"],
    localFile: "connex-es.pdf",
    urls: ["https://equimed.es/wp-content/uploads/2021/12/connex_spot_monitor_monitorizacion_equimed.pdf"],
  },
  {
    brand: "Dräger",
    productLine: "Anestesia",
    model: "Atlan A350 XL",
    title: "Información de producto Atlan A350 / A350 XL (ES)",
    tags: ["quirófano", "anestesia", "español"],
    localFile: "atlan-a350-es.pdf",
    urls: [
      "https://www.draeger.com/Content/Documents/Products/Atlan-A350-A350-XL-pi-100164-es-ES.pdf",
    ],
  },
  {
    brand: "Dräger",
    productLine: "Anestesia",
    model: "Atlan A300",
    title: "Información de producto Atlan A300 / A300 XL (ES)",
    tags: ["quirófano", "anestesia", "español"],
    localFile: "atlan-a300-es.pdf",
    urls: [
      "https://www.draeger.com/Content/Documents/Products/Atlan-A300-A300-XL-pi-100176-es-ES.pdf",
    ],
  },
  {
    brand: "Dräger",
    productLine: "Monitoreo",
    model: "Vista 120 C",
    title: "Folleto familia Vista 120 (ES)",
    tags: ["UCI", "monitoreo", "español"],
    localFile: "vista-family-es.pdf",
    urls: [
      "https://www.draeger.com/Content/Documents/Products/vista-family-br-dmc-102644-es-es-2204-1.pdf",
      "https://www.draeger.com/Content/Documents/Products/vista-120-v3-pi-9106628-es-es.pdf",
    ],
  },
  {
    brand: "Dräger",
    productLine: "Anestesia",
    model: "Fabius Plus XL",
    title: "Catálogo Fabius y más (ES)",
    tags: ["quirófano", "anestesia", "español"],
    localFile: "fabius-more-es.pdf",
    urls: ["https://www.draeger.com/Content/Documents/Products/fabius-more-ca-9103629-es.pdf"],
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
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).replace(/^["']|["']$/g, "");
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
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    key: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

function isPdf(buffer) {
  return buffer.length > 4 && buffer.subarray(0, 4).toString("utf8") === "%PDF";
}

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/pdf,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9",
};

async function loadPdf(item) {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, item.localFile);
  if (existsSync(path)) {
    const cached = readFileSync(path);
    if (isPdf(cached)) return { buffer: cached, bytes: cached.length, source: "cache" };
  }
  const errors = [];
  for (const url of item.urls || []) {
    try {
      const res = await fetch(url, {
        headers: { ...FETCH_HEADERS, Referer: new URL(url).origin + "/" },
        redirect: "follow",
      });
      if (!res.ok) {
        errors.push(`${url} → ${res.status}`);
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!isPdf(buffer)) {
        errors.push(`${url} → no PDF`);
        continue;
      }
      writeFileSync(path, buffer);
      return { buffer, bytes: buffer.length, source: url };
    } catch (error) {
      errors.push(`${url} → ${error instanceof Error ? error.message : error}`);
    }
  }
  throw new Error(errors.join(" | ") || `sin archivo local: ${item.localFile}`);
}

async function listDocsForModel(base, key, brand, model) {
  const params = new URLSearchParams({
    select: "id,title,brand,model,file_path,file_url",
    area: "eq.ventas",
    brand: `eq.${brand}`,
    model: `eq.${model}`,
  });
  const res = await fetch(`${base.replace(/\/$/, "")}/rest/v1/sales_catalog_documents?${params}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`lookup ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function deleteDoc(base, key, row) {
  if (row.file_path) {
    await fetch(`${base.replace(/\/$/, "")}/storage/v1/object/${BUCKET}/${row.file_path}`, {
      method: "DELETE",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }).catch(() => undefined);
  }
  const params = new URLSearchParams({ id: `eq.${row.id}` });
  const res = await fetch(`${base.replace(/\/$/, "")}/rest/v1/sales_catalog_documents?${params}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`delete ${res.status}: ${text}`);
  }
}

async function uploadOne(base, key, item, buffer) {
  const safe = item.localFile.replace(/[^\w.\-]+/g, "_");
  const storagePath = `ventas/brochure/${Date.now()}-${safe}`;
  const uploadRes = await fetch(
    `${base.replace(/\/$/, "")}/storage/v1/object/${BUCKET}/${storagePath}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/pdf",
        "x-upsert": "false",
      },
      body: buffer,
    }
  );
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`storage ${uploadRes.status}: ${text}`);
  }
  const publicUrl = `${base.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${storagePath}`;
  const insertRes = await fetch(`${base.replace(/\/$/, "")}/rest/v1/sales_catalog_documents`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      area: "ventas",
      title: item.title,
      doc_type: "brochure",
      brand: item.brand,
      product_line: item.productLine,
      model: item.model,
      description: `Ficha comercial en español · fuente: ${(item.urls?.[0] || "local").split("?")[0]}`,
      tags: item.tags,
      version: "ES",
      file_path: storagePath,
      file_url: publicUrl,
      file_name: item.localFile,
      file_size: buffer.length,
      mime_type: "application/pdf",
      uploaded_by: "catalog-sync-es",
    }),
  });
  const insertText = await insertRes.text();
  if (!insertRes.ok) {
    await fetch(`${base.replace(/\/$/, "")}/storage/v1/object/${BUCKET}/${storagePath}`, {
      method: "DELETE",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }).catch(() => undefined);
    throw new Error(`insert ${insertRes.status}: ${insertText}`);
  }
  return JSON.parse(insertText)[0];
}

async function main() {
  const env = loadEnv();
  const { url, key } = envForTarget(env);
  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / ANON_KEY en .env.local");
    process.exit(1);
  }
  console.log(`Destino: ${cloud ? "cloud" : "local"} · ${BROCHURES.length} brochures ES`);
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const item of BROCHURES) {
    const label = `${item.brand} · ${item.model}`;
    try {
      const existing = await listDocsForModel(url, key, item.brand, item.model);
      const alreadyEs = existing.find(
        (row) =>
          String(row.title || "").includes("(ES)") ||
          String(row.title || "").toLowerCase().includes("español")
      );
      if (alreadyEs && !force) {
        console.log(`= ya ES: ${label}`);
        skipped += 1;
        continue;
      }
      const { buffer, bytes } = await loadPdf(item);
      const hash = createHash("sha1").update(buffer).digest("hex").slice(0, 8);
      console.log(`↓ ${label} (${(bytes / 1024).toFixed(0)} KB · ${hash})`);
      if (dryRun) {
        console.log(`  (dry-run) reemplazaría ${existing.length} doc(s)`);
        ok += 1;
        continue;
      }
      for (const row of existing) {
        console.log(`  − quitar previo: ${row.title}`);
        await deleteDoc(url, key, row);
      }
      const row = await uploadOne(url, key, item, buffer);
      console.log(`✓ subido ES ${row.id}`);
      ok += 1;
    } catch (error) {
      failed += 1;
      console.error(`✗ ${label}: ${error instanceof Error ? error.message : error}`);
    }
  }
  console.log(`Listo: ${ok} ok · ${skipped} omitidos · ${failed} fallidos`);
  if (failed) process.exit(1);
}

main();
