#!/usr/bin/env node
/**
 * Quita fichas generadas y restaura PDFs originales de fabricante (cache local).
 *   node scripts/restore-original-draeger-brochures.mjs --cloud
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CACHE = join(ROOT, "tmp-sales-brochures");
const BUCKET = "sales-catalog";
const cloud = process.argv.includes("--cloud");

const ORIGINALS = [
  {
    brand: "Dräger",
    productLine: "Anestesia",
    model: "Atlan A350 XL",
    title: "Brochure Atlan A350 / A350 XL",
    tags: ["quirófano", "anestesia"],
    localFile: "draeger-atlan-a350-a350xl-pi.pdf",
    description: "Ficha comercial original de fabricante (espejo AEL Health / PI Atlan A350).",
  },
  {
    brand: "Dräger",
    productLine: "Anestesia",
    model: "Atlan A300",
    title: "Brochure Atlan A300 / A300 XL",
    tags: ["quirófano", "anestesia"],
    localFile: "draeger-atlan-a300-a300xl-pi.pdf",
    description: "Ficha comercial original de fabricante (PI Atlan A300).",
  },
  {
    brand: "Dräger",
    productLine: "Anestesia",
    model: "Fabius Plus XL",
    title: "Brochure Fabius Plus",
    tags: ["quirófano", "anestesia"],
    localFile: "draeger-fabius-plus-brochure.pdf",
    description: "Ficha comercial original Fabius Plus.",
  },
  {
    brand: "Dräger",
    productLine: "Monitoreo",
    model: "Vista 120 C",
    title: "Brochure Vista 120",
    tags: ["UCI", "monitoreo"],
    localFile: "draeger-vista-120-pi.pdf",
    description: "Ficha comercial original Vista 120 (PI).",
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

async function listDocs(base, key, brand, model) {
  const params = new URLSearchParams({
    select: "id,title,file_path",
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
  if (!res.ok) throw new Error(`delete ${res.status}: ${await res.text()}`);
}

async function uploadOne(base, key, item, buffer) {
  const storagePath = `ventas/brochure/${Date.now()}-${item.localFile}`;
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
  if (!uploadRes.ok) throw new Error(`storage ${uploadRes.status}: ${await uploadRes.text()}`);
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
      description: item.description,
      tags: item.tags,
      version: "",
      file_path: storagePath,
      file_url: publicUrl,
      file_name: item.localFile,
      file_size: buffer.length,
      mime_type: "application/pdf",
      uploaded_by: "catalog-restore-original",
    }),
  });
  const insertText = await insertRes.text();
  if (!insertRes.ok) throw new Error(`insert ${insertRes.status}: ${insertText}`);
  return JSON.parse(insertText)[0];
}

async function main() {
  const env = loadEnv();
  const { url, key } = envForTarget(env);
  if (!url || !key) {
    console.error("Faltan credenciales Supabase en .env.local");
    process.exit(1);
  }
  for (const item of ORIGINALS) {
    const path = join(CACHE, item.localFile);
    if (!existsSync(path)) throw new Error(`Falta original: ${path}`);
    const buffer = readFileSync(path);
    if (!isPdf(buffer) || buffer.length < 50_000) {
      throw new Error(`No parece PDF original válido: ${item.localFile} (${buffer.length} B)`);
    }
    const existing = await listDocs(url, key, item.brand, item.model);
    for (const row of existing) {
      console.log(`− ${item.model}: ${row.title}`);
      await deleteDoc(url, key, row);
    }
    const row = await uploadOne(url, key, item, buffer);
    console.log(`✓ original ${(buffer.length / 1024).toFixed(0)} KB → ${row.id}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
