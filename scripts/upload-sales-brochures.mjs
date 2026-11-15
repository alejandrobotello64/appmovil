#!/usr/bin/env node
/**
 * Descarga fichas/brochures públicos de fabricante y los sube al catálogo de ventas.
 *
 *   node scripts/upload-sales-brochures.mjs [--dry-run] [--cloud]
 *
 * No imprime claves. Usa .env.local (NEXT_PUBLIC_SUPABASE_* o CLOUD_* con --cloud).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CACHE = join(ROOT, "tmp-sales-brochures");
const BUCKET = "sales-catalog";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const cloud = args.includes("--cloud");

/** Brochures / product info públicos (fabricante o espejo comercial autorizado). */
const BROCHURES = [
  {
    brand: "Dräger",
    productLine: "Anestesia",
    model: "Atlan A350 XL",
    title: "Brochure Atlan A350 / A350 XL",
    tags: ["quirófano", "anestesia"],
    urls: [
      "https://www.aelhealth.com/assets/img/product/drager_anesthesia_workstation.pdf",
      "https://medfau.com/wp-content/uploads/2021/05/atlan-a350-a350xl-pi-9107088-en-master.pdf",
      "https://www.draeger.com/Content/Documents/Products/Atlan-A350-A350-XL-pi-100164-en-MASTER.pdf",
    ],
    fileName: "draeger-atlan-a350-a350xl-pi.pdf",
  },
  {
    brand: "Dräger",
    productLine: "Anestesia",
    model: "Atlan A300",
    title: "Brochure Atlan A300 / A300 XL",
    tags: ["quirófano", "anestesia"],
    urls: [
      "https://d17eythm3w95tp.cloudfront.net/media/24148/01jhn033zxsgaz1ev7430kpv4z.pdf",
      "https://www.draeger.com/Content/Documents/Products/Atlan-A300-A300-XL-pi-100176-en-MASTER.pdf",
    ],
    fileName: "draeger-atlan-a300-a300xl-pi.pdf",
  },
  {
    brand: "Dräger",
    productLine: "Anestesia",
    model: "Fabius Plus XL",
    title: "Brochure Fabius Plus",
    tags: ["quirófano", "anestesia"],
    urls: [
      "https://rescaremed.com/wp-content/uploads/2016/05/Fabius-Plus-BR-1.pdf",
      "https://www.draeger.com/Content/Documents/Products/fabius-and-more-ca-9066305-en-master.pdf",
    ],
    fileName: "draeger-fabius-plus-brochure.pdf",
  },
  {
    brand: "Philips",
    productLine: "Monitoreo",
    model: "IntelliVue MX550",
    title: "Brochure IntelliVue MX550",
    tags: ["UCI", "monitoreo"],
    urls: ["https://philipsproductcontent.blob.core.windows.net/assets/20170523/27d8f20bc5114ece8961a77c016a1c14.pdf"],
    fileName: "philips-intellivue-mx550-brochure.pdf",
  },
  {
    brand: "Philips",
    productLine: "Desfibrilación",
    model: "Efficia DFM100",
    title: "Brochure Efficia DFM100",
    tags: ["urgencias", "desfibrilador"],
    urls: ["https://www.documents.philips.com/assets/20210219/229061f3ce84476096bcacd4011264f6.pdf"],
    fileName: "philips-efficia-dfm100-brochure.pdf",
  },
  {
    brand: "Masimo",
    productLine: "Monitoreo",
    model: "Radical-7",
    title: "Brochure Radical-7 Pulse CO-Oximeter",
    tags: ["UCI", "SpO2"],
    urls: [
      "https://img1.wsimg.com/blobby/go/7c58a4da-2d35-4b6e-8d1c-275d596bc9e0/downloads/ProductBrochure_Masimo-Radical-7.pdf?ver=1700936360843",
    ],
    fileName: "masimo-radical-7-brochure.pdf",
  },
  {
    brand: "Fisher & Paykel",
    productLine: "Alto flujo",
    model: "Airvo 2",
    title: "Brochure Airvo 2 Optiflow",
    tags: ["respiratorio", "alto flujo"],
    urls: ["https://resources.fphcare.com/content/airvo2-features-brochure-pm-185048296.pdf"],
    fileName: "fp-airvo2-features-brochure.pdf",
  },
  {
    brand: "Hill-Rom / Baxter",
    productLine: "Camas hospitalarias",
    model: "Centuris Pro",
    title: "Ficha técnica Centuris Pro",
    tags: ["cama", "piso"],
    urls: ["https://assets.hillrom.com/is/content/hillrom/5EN133303-04_Centuris-Pro_Tech-Specpdf"],
    fileName: "hillrom-centuris-pro-tech-spec.pdf",
  },
  {
    brand: "Dräger",
    productLine: "Monitoreo",
    model: "Vista 120 C",
    title: "Brochure Vista 120",
    tags: ["UCI", "monitoreo"],
    urls: [
      "https://medfau.com/wp-content/uploads/2023/05/vista-120-pi-9105981-en-master.pdf",
      "https://www.draeger.com/Content/Documents/Products/Vista-120-pi-102507-en-MASTER.pdf",
      "https://www.draeger.com/Content/Documents/Products/vista-family-br-dmc-101209-en-gb.pdf",
    ],
    fileName: "draeger-vista-120-pi.pdf",
  },
  {
    brand: "Philips",
    productLine: "Monitoreo fetal",
    model: "Avalon FM20/FM30",
    title: "Brochure Avalon FM20 y FM30",
    tags: ["obstetricia", "fetal"],
    urls: ["https://www.documents.philips.com/assets/20241214/e6ad837ef1704dca85d5b246002d8c74.pdf"],
    fileName: "philips-avalon-fm20-fm30-brochure.pdf",
  },
  {
    brand: "3M",
    productLine: "Manejo térmico",
    model: "Bair Hugger",
    title: "Brochure Bair Hugger Temperature Management",
    tags: ["quirófano", "térmico"],
    urls: [
      "https://www.solventum.com/content/dam/public/language-masters/en/msb/document/2023/msd-ppm-bairhugger-temp-management-solutions-brochure-en-gbl.pdf",
    ],
    fileName: "3m-bair-hugger-brochure.pdf",
  },
  {
    brand: "Masimo",
    productLine: "Monitoreo",
    model: "Root",
    title: "Brochure Root con NIBP y temperatura",
    tags: ["UCI", "monitoreo"],
    urls: ["https://www.masimo.com/siteassets/us/documents/pdf/plm-11447a_brochure_root_nibpt_us.pdf"],
    fileName: "masimo-root-nibpt-brochure.pdf",
  },
  {
    brand: "Masimo",
    productLine: "Monitoreo",
    model: "O3",
    title: "Brochure O3 Regional Oximetry",
    tags: ["UCI", "rSO2"],
    urls: ["https://www.masimo.com/siteassets/us/documents/pdf/plm_11661c_brochure_o3_series_us.pdf"],
    fileName: "masimo-o3-regional-oximetry-brochure.pdf",
  },
  {
    brand: "Hill-Rom / Baxter",
    productLine: "Camas hospitalarias",
    model: "Progressa",
    title: "Brochure Progressa ICU bed",
    tags: ["UCI", "cama"],
    urls: [
      "https://www.hillrom.com.sg/content/dam/hillrom-aem/emea/en/marketing/products/progressa-bed-system/5EN126301-05_Progressa_16p_Brochure_HR.pdf",
      "https://www.hillrom.com/content/dam/hillrom-aem/us/en/marketing/services/construction/3.%20ProgressaICUBed.pdf",
    ],
    fileName: "hillrom-progressa-brochure.pdf",
  },
  {
    brand: "Welch Allyn",
    productLine: "Monitoreo",
    model: "Connex Spot Monitor",
    title: "Brochure Connex Spot Monitor",
    tags: ["piso", "monitoreo"],
    urls: [
      "https://boothmed.com/cdn/shop/files/Welch_Allyn_Connex_Spot_Monitor_Brochure.pdf?v=1785348344595394631",
      "https://www.hillrom.com/content/dam/hillrom-aem/us/en/marketing/products/connex-spot-monitor/documents/APR69101-EN-R2_Connex-Spot-Monitor-Primary-Care_Brochure-LR.pdf",
    ],
    fileName: "welch-allyn-connex-spot-brochure.pdf",
  },
  {
    brand: "ASP",
    productLine: "Esterilización",
    model: "STERRAD 100NX",
    title: "Datasheet STERRAD 100NX ALLClear",
    tags: ["esterilización", "quirófano"],
    urls: [
      "https://www.asp.com/sites/default/files/2022-01/AD-160028-01-CT_D-MDR%20STERRAD_100NX_ALLCLear_DataSheet_MDR_digital_TM.pdf",
    ],
    fileName: "asp-sterrad-100nx-datasheet.pdf",
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
};

async function downloadFromUrls(urls, fileName) {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, fileName);
  if (existsSync(path)) {
    const cached = readFileSync(path);
    if (isPdf(cached)) return { path, buffer: cached, bytes: cached.length, source: "cache" };
  }
  const errors = [];
  for (const url of urls) {
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
        errors.push(`${url} → no PDF (${buffer.length} B)`);
        continue;
      }
      writeFileSync(path, buffer);
      return { path, buffer, bytes: buffer.length, source: url };
    } catch (error) {
      errors.push(`${url} → ${error instanceof Error ? error.message : error}`);
    }
  }
  throw new Error(errors.join(" | ") || "sin URLs");
}

async function alreadyUploaded(base, key, brand, model, title) {
  const params = new URLSearchParams({
    select: "id,title,brand,model",
    area: "eq.ventas",
    brand: `eq.${brand}`,
    model: `eq.${model}`,
    title: `eq.${title}`,
    limit: "1",
  });
  const res = await fetch(`${base.replace(/\/$/, "")}/rest/v1/sales_catalog_documents?${params}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`lookup ${res.status}: ${text}`);
  const rows = JSON.parse(text);
  return rows[0] ?? null;
}

async function uploadOne(base, key, item, buffer) {
  const safe = item.fileName.replace(/[^\w.\-]+/g, "_");
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
      description: `Ficha comercial pública · fuente: ${(item.urls?.[0] || item.url || "").split("?")[0]}`,
      tags: item.tags,
      version: "",
      file_path: storagePath,
      file_url: publicUrl,
      file_name: item.fileName,
      file_size: buffer.length,
      mime_type: "application/pdf",
      uploaded_by: "catalog-sync",
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
  console.log(`Destino: ${cloud ? "cloud" : "local"} · ${BROCHURES.length} brochures`);
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const item of BROCHURES) {
    const label = `${item.brand} · ${item.model}`;
    try {
      const existing = await alreadyUploaded(url, key, item.brand, item.model, item.title);
      if (existing) {
        console.log(`= ya existe: ${label}`);
        skipped += 1;
        continue;
      }
      const urls = item.urls || (item.url ? [item.url] : []);
      const { buffer, bytes } = await downloadFromUrls(urls, item.fileName);
      const hash = createHash("sha1").update(buffer).digest("hex").slice(0, 8);
      console.log(`↓ ${label} (${(bytes / 1024).toFixed(0)} KB · ${hash})`);
      if (dryRun) {
        console.log(`  (dry-run) no se subió`);
        ok += 1;
        continue;
      }
      const row = await uploadOne(url, key, item, buffer);
      console.log(`✓ subido ${row.id}`);
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
