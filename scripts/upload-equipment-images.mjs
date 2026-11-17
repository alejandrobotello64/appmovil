#!/usr/bin/env node
/**
 * Descarga / migra fotos de equipos sin imagen (o con /catalog/photos relativo)
 * y las sube a inventory-media + actualiza inventory_items.
 *
 *   node scripts/upload-equipment-images.mjs [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CACHE = join(ROOT, "tmp-equipment-images");
const BUCKET = "inventory-media";
const dryRun = process.argv.includes("--dry-run");

function loadEnv() {
  const envPath = join(ROOT, ".env.local");
  const env = {};
  if (!existsSync(envPath)) return env;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / ANON_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Fuentes: locales, URLs de fabricante, o copia desde otro SKU ya en cloud. */
const JOBS = [
  // Migrar fotos locales relativas → cloud
  {
    sku: "EQUIPO-000022",
    local: "public/catalog/photos/9d961816-cf4e-4f46-9144-9492369df5f5.jpg",
  },
  {
    sku: "EQUIPO-000015",
    local: "public/catalog/photos/2e469119-7a64-4dfd-864c-9b15d38c74dc.jpg",
  },
  {
    sku: "EQUIPO-000018",
    local: "public/catalog/photos/65c24024-f7e7-43a1-9197-b73f60fb926a.jpg",
  },
  {
    sku: "EQUIPO-000016",
    local: "public/catalog/photos/3091c33d-6959-478b-85aa-85b2e23542f7.jpg",
  },
  {
    sku: "EQUIPO-000024",
    local: "public/catalog/photos/c9e562c6-5ac4-41cf-af41-177544ea241c.jpg",
  },

  // Fabricante / media pública
  {
    sku: "EQUIPO-000031",
    urls: [
      "https://www.draeger.com/Media/Content/Products/Default/Draeger-Babyleo-TN500-1-D-43871-2015.jpg",
    ],
    fileName: "babyleo-tn500.jpg",
  },
  {
    sku: "EQUIPO-000028",
    urls: [
      "https://www.draeger.com/Media/Content/Products/Default/atlan-350-xl-D-2232-2019-vizient-4-3.png",
    ],
    fileName: "atlan-a350-xl.png",
  },
  {
    sku: "EQUIPO-000034",
    urls: [
      "https://www.draeger.com/Media/Content/Products/Default/Draeger-Atlan-A300-A300-XL-1-D-12642-2018.jpg",
    ],
    fileName: "atlan-a300.jpg",
  },
  {
    sku: "EQUIPO-000029",
    urls: [
      "https://www.draeger.com/Media/Content/Products/Default/fabius-plus-xl-D-12233-2016.jpg",
      "https://www.draeger.com/Media/Content/Products/Default/Draeger-Fabius-Plus-1-D-92882-2013.jpg",
      "https://www.draeger.com/Media/Content/Products/Default/fabius-plus-4-3.jpg",
    ],
    fileName: "fabius-plus-xl.jpg",
    copyFromSku: "EQUIPO-000028",
  },
  {
    sku: "EQUIPO-000030",
    urls: [
      "https://www.draeger.com/Media/Content/Products/Default/draeger-vista-120-patient-monitors-4-3-D-1592-2018.jpg",
    ],
    fileName: "vista-120s.jpg",
    copyFromSku: "EQUIPO-000004",
  },
  {
    sku: "EQUIPO-000037",
    urls: [
      "https://www.draeger.com/Media/Content/Products/Default/draeger-tofscan-monitoring-4-3-D-41719-2021.jpg",
    ],
    fileName: "tofscan.jpg",
  },
  {
    sku: "EQUIPO-000036",
    urls: [
      "https://www.draeger.com/Media/Content/Products/Default/de-de-evita-v600-4-3-1.jpg",
    ],
    fileName: "evita-v600.jpg",
  },
  {
    sku: "EQUIPO-000035",
    urls: [
      "https://www.draeger.com/Media/Content/Products/Default/de-de-evita-v600-4-3-1.jpg",
      "https://www.draeger.com/Media/Content/Products/Default/evita-v300-4-3.jpg",
    ],
    fileName: "evita-v300.jpg",
    copyFromSku: "EQUIPO-000036",
  },
  {
    sku: "EQUIPO-000038",
    urls: [
      "https://www.draeger.com/Media/Content/Products/Default/babylog-vn600-d-5755-2018.jpg",
    ],
    fileName: "babylog-vn600.jpg",
  },
  {
    sku: "EQUIPO-000039",
    urls: [
      "https://resources.fphcare.com/content/airvo-2-product-image.png",
      "https://resources.fphcare.com/content/airvo2-product.png",
      "https://www.fphcare.com/-/media/images/hospital/airvo-2.png",
    ],
    fileName: "airvo-2.png",
  },
  {
    sku: "EQUIPO-000040",
    urls: [
      "https://resources.fphcare.com/content/mr850-product.png",
      "https://resources.fphcare.com/content/mr850.png",
      "https://www.fphcare.com/-/media/images/hospital/mr850.png",
    ],
    fileName: "mr850.png",
    copyFromSku: "EQUIPO-000039",
  },
  {
    sku: "EQUIPO-000009",
    copyFromSku: "EQUIPO-000008",
    fileName: "rad-handheld.webp",
  },
  {
    sku: "EQUIPO-000033",
    urls: [
      "https://www.hillrom.com/-/media/project/hillrom/global/medical-products/stretchers/p8000/p8040-stretcher.jpg",
      "https://www.baxter.com/-/media/project/baxter/shared/medical-products/stretchers/p8040.jpg",
    ],
    fileName: "p8040.jpg",
    copyFromSku: "EQUIPO-000025",
  },
  {
    sku: "EQUIPO-000032",
    urls: [
      "https://www.hillrom.com/-/media/project/hillrom/global/medical-products/stretchers/p8000/p8000-stretcher.jpg",
    ],
    fileName: "p8000.jpg",
    copyFromSku: "EQUIPO-000033",
  },
  {
    sku: "EQUIPO-000027",
    urls: [
      "https://www.hillrom.com/-/media/project/hillrom/global/medical-products/beds/centuris/centuris-pro.jpg",
      "https://www.baxter.com/-/media/project/baxter/shared/medical-products/beds/centuris-pro.jpg",
    ],
    fileName: "centuris-pro.jpg",
    copyFromSku: "EQUIPO-000025",
  },
  {
    sku: "EQUIPO-000020",
    copyFromSku: "EQUIPO-000017",
    urls: [
      "https://www.hillrom.com/-/media/project/hillrom/global/medical-products/patient-monitoring/connex/connex-spot-monitor.jpg",
    ],
    fileName: "welch-monitor.jpg",
  },
];

mkdirSync(CACHE, { recursive: true });

async function downloadFirst(urls, destBase) {
  for (const raw of urls) {
    try {
      const res = await fetch(raw, {
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; MAS-catalog/1.0; +https://medicaladvanced.local)",
          Accept: "image/*,*/*",
        },
      });
      if (!res.ok) {
        console.log(`  skip ${res.status} ${raw}`);
        continue;
      }
      const ctype = res.headers.get("content-type") || "";
      if (!ctype.startsWith("image/") && !ctype.includes("octet-stream")) {
        console.log(`  skip ctype ${ctype} ${raw}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 2000) {
        console.log(`  skip tiny ${buf.length} ${raw}`);
        continue;
      }
      let ext = extname(new URL(raw).pathname) || ".jpg";
      if (ctype.includes("png")) ext = ".png";
      if (ctype.includes("webp")) ext = ".webp";
      if (ctype.includes("jpeg") || ctype.includes("jpg")) ext = ".jpg";
      const dest = join(CACHE, destBase.replace(/\.[^.]+$/, "") + ext);
      writeFileSync(dest, buf);
      console.log(`  ok ${buf.length}B ← ${raw}`);
      return dest;
    } catch (err) {
      console.log(`  err ${err.message} ${raw}`);
    }
  }
  return null;
}

function contentTypeFor(path) {
  const e = extname(path).toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  if (e === ".gif") return "image/gif";
  return "image/jpeg";
}

async function getItemBySku(sku) {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, sku, name, image_path, image_url")
    .eq("sku", sku)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function uploadAndLink(item, filePath) {
  const bytes = readFileSync(filePath);
  const ext = extname(filePath) || ".jpg";
  const path = `${item.id}/${Date.now()}-equipo${ext}`;
  if (dryRun) {
    console.log(`  dry-run upload ${path} (${bytes.length}B)`);
    return;
  }
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: contentTypeFor(filePath),
      upsert: false,
    });
  if (upErr) throw new Error(upErr.message);

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { error: dbErr } = await supabase
    .from("inventory_items")
    .update({
      image_path: path,
      image_url: pub.publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);
  if (dbErr) throw new Error(dbErr.message);
  console.log(`  linked ${pub.publicUrl}`);
}

async function copyFrom(item, sourceSku) {
  const src = await getItemBySku(sourceSku);
  if (!src?.image_url?.startsWith("http")) return false;
  console.log(`  copy from ${sourceSku}`);
  if (dryRun) return true;
  // Re-download public URL and re-upload under this item id (independent path).
  const res = await fetch(src.image_url);
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  let ext = ".jpg";
  const ctype = res.headers.get("content-type") || "";
  if (ctype.includes("png")) ext = ".png";
  if (ctype.includes("webp")) ext = ".webp";
  const tmp = join(CACHE, `${item.sku}-copy${ext}`);
  writeFileSync(tmp, buf);
  await uploadAndLink(item, tmp);
  return true;
}

async function main() {
  let ok = 0;
  let fail = 0;
  for (const job of JOBS) {
    const item = await getItemBySku(job.sku);
    if (!item) {
      console.log(`MISS ${job.sku}`);
      fail++;
      continue;
    }
    const hasCloud =
      typeof item.image_url === "string" &&
      item.image_url.startsWith("http") &&
      item.image_url.includes("inventory-media");
    if (hasCloud) {
      console.log(`SKIP ${job.sku} ya tiene imagen cloud`);
      continue;
    }
    console.log(`JOB ${job.sku} ${item.name}`);

    let file = null;
    if (job.local) {
      const abs = join(ROOT, job.local);
      if (existsSync(abs)) file = abs;
      else console.log(`  local missing ${job.local}`);
    }
    if (!file && job.urls?.length) {
      file = await downloadFirst(job.urls, job.fileName || job.sku);
    }
    try {
      if (file) {
        await uploadAndLink(item, file);
        ok++;
      } else if (job.copyFromSku) {
        const copied = await copyFrom(item, job.copyFromSku);
        if (copied) ok++;
        else {
          console.log(`  FAIL sin fuente`);
          fail++;
        }
      } else {
        console.log(`  FAIL sin archivo`);
        fail++;
      }
    } catch (err) {
      console.log(`  FAIL ${err.message}`);
      fail++;
    }
  }
  console.log(`\nListo: ok=${ok} fail=${fail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
