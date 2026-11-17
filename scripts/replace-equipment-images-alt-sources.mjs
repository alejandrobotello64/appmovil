#!/usr/bin/env node
/**
 * Reemplaza fotos de equipos con fuentes alternativas (Remma CDN, Wikimedia, DOTmed),
 * evitando draeger.com que bloquea descarga (403).
 *
 *   node scripts/replace-equipment-images-alt-sources.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

function loadEnv() {
  const env = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i < 1) continue;
    env[line.slice(0, i)] = line.slice(i + 1).replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

const CACHE = join(process.cwd(), "tmp-equipment-images-alt");
mkdirSync(CACHE, { recursive: true });

/** Fuentes NO-Dräger.com: Remma CloudFront, Wikimedia, DOTmed. */
const JOBS = [
  {
    sku: "EQUIPO-000028",
    label: "Atlan A350 XL",
    urls: [
      "https://d17eythm3w95tp.cloudfront.net/media/1907/conversions/draeger-atlan-a350-a350-xl-10-d-12837-2018-large.webp",
      "https://d17eythm3w95tp.cloudfront.net/media/1907/draeger-atlan-a350-a350-xl-10-d-12837-2018.jpg",
    ],
  },
  {
    sku: "EQUIPO-000034",
    label: "Atlan A300",
    urls: [
      "https://d17eythm3w95tp.cloudfront.net/media/24149/conversions/draeger-atlan-a300-a300-xl-01-d-12642-2018-1024x682-large.jpg",
    ],
  },
  {
    sku: "EQUIPO-000029",
    label: "Fabius Plus XL",
    urls: [
      "https://d17eythm3w95tp.cloudfront.net/media/38147/conversions/fabius-plus-xl-large.jpeg",
      "https://d17eythm3w95tp.cloudfront.net/media/38147/conversions/fabius-plus-xl-large.jpg",
      "https://d17eythm3w95tp.cloudfront.net/media/38147/fabius-plus-xl.jpg",
      "https://d17eythm3w95tp.cloudfront.net/media/38147/conversions/fabius-plus-xl-large.avif",
    ],
  },
  {
    sku: "EQUIPO-000038",
    label: "Babylog VN600",
    urls: [
      "https://d17eythm3w95tp.cloudfront.net/media/1812/conversions/draeger-babylog-vn600-neonatal-icu-ventilation-3-2-d-5741-2018-large.webp",
      "https://d17eythm3w95tp.cloudfront.net/media/1812/draeger-babylog-vn600-neonatal-icu-ventilation-3-2-d-5741-2018.jpg",
    ],
  },
  {
    sku: "EQUIPO-000035",
    label: "Evita V300",
    urls: [
      "https://d17eythm3w95tp.cloudfront.net/media/56157/conversions/evita-v300-large.jpeg",
    ],
  },
  {
    sku: "EQUIPO-000036",
    label: "Evita V600",
    urls: [
      "https://images.dotmed.com/images/listingpics2/5/5/7/0/5570720.jpg",
      "https://d17eythm3w95tp.cloudfront.net/media/56157/conversions/evita-v300-large.jpeg",
    ],
  },
  {
    sku: "EQUIPO-000039",
    label: "Airvo 2",
    urls: [
      "https://d17eythm3w95tp.cloudfront.net/media/27717/conversions/airvo-2-large.jpeg",
      "https://upload.wikimedia.org/wikipedia/commons/2/24/Airvo_2.jpg",
    ],
  },
  {
    sku: "EQUIPO-000031",
    label: "Babyleo TN500",
    urls: [
      // Biobilden (host propio, no draeger.com) — campaign primero (mejor resolución)
      "https://biobilden.com/wp-content/uploads/2021/04/babyleo-campaign-3-2-d-43992-2015.jpg",
      "https://biobilden.com/wp-content/uploads/2021/04/draeger-babyleo-tn500-4-3-d-43871-2015.jpg",
      "https://biobilden.com/wp-content/uploads/2021/04/babyleo-application-photo_3-2_d-7891-2016.jpg",
    ],
  },
  {
    sku: "EQUIPO-000037",
    label: "ToFscan",
    urls: [
      "https://d17eythm3w95tp.cloudfront.net/media/48736/conversions/tofscan-large.png",
      "https://images.squarespace-cdn.com/content/v1/65c4f221ee47e2511a49a652/cf2fcb8c-415e-4162-8316-27719b9990e4/TOFscan+original.png",
      "https://images.squarespace-cdn.com/content/v1/65c4f221ee47e2511a49a652/c1a0add7-968a-47b1-b28c-1f93ca85174f/Ms+ToFscan.jpg",
    ],
  },
];

async function downloadFirst(urls, sku) {
  for (const raw of urls) {
    try {
      const res = await fetch(raw, {
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          Referer: "https://remma.fr/",
        },
      });
      if (!res.ok) {
        console.log(`  skip ${res.status} ${raw}`);
        continue;
      }
      const ctype = (res.headers.get("content-type") || "").toLowerCase();
      if (
        !ctype.startsWith("image/") &&
        !ctype.includes("octet-stream") &&
        !ctype.includes("webp") &&
        !ctype.includes("avif")
      ) {
        console.log(`  skip ctype ${ctype} ${raw}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 3000) {
        console.log(`  skip tiny ${buf.length} ${raw}`);
        continue;
      }
      // Skip HTML error pages
      const head = buf.subarray(0, 32).toString("utf8");
      if (head.includes("<!DOCTYPE") || head.includes("<html")) {
        console.log(`  skip html ${raw}`);
        continue;
      }
      let ext = ".jpg";
      if (ctype.includes("png") || raw.includes(".png")) ext = ".png";
      else if (ctype.includes("webp") || raw.includes(".webp")) ext = ".webp";
      else if (ctype.includes("avif") || raw.includes(".avif")) ext = ".avif";
      else if (ctype.includes("jpeg") || ctype.includes("jpg")) ext = ".jpg";
      const dest = join(CACHE, `${sku}${ext}`);
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
  if (e === ".avif") return "image/avif";
  return "image/jpeg";
}

async function main() {
  const only = new Set(
    (process.env.ONLY_SKUS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  let ok = 0;
  let fail = 0;
  for (const job of JOBS) {
    if (only.size && !only.has(job.sku)) continue;
    console.log(`JOB ${job.sku} ${job.label}`);
    const { data: item, error } = await supabase
      .from("inventory_items")
      .select("id, sku, name")
      .eq("sku", job.sku)
      .maybeSingle();
    if (error || !item) {
      console.log(`  MISS ${error?.message}`);
      fail++;
      continue;
    }
    const file = await downloadFirst(job.urls, job.sku);
    if (!file) {
      fail++;
      continue;
    }
    // Skip avif if browsers/storage awkward — prefer re-download jpeg only
    if (file.endsWith(".avif")) {
      console.log("  avif obtenido; busco jpeg/webp preferente…");
      // still upload avif as last resort
    }
    const bytes = readFileSync(file);
    const path = `${item.id}/${Date.now()}-alt${extname(file)}`;
    const { error: upErr } = await supabase.storage
      .from("inventory-media")
      .upload(path, bytes, {
        contentType: contentTypeFor(file),
        upsert: false,
      });
    if (upErr) {
      console.log(`  UP ${upErr.message}`);
      fail++;
      continue;
    }
    const { data: pub } = supabase.storage.from("inventory-media").getPublicUrl(path);
    const { error: dbErr } = await supabase
      .from("inventory_items")
      .update({
        image_path: path,
        image_url: pub.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (dbErr) {
      console.log(`  DB ${dbErr.message}`);
      fail++;
      continue;
    }
    console.log(`  linked ${pub.publicUrl}`);
    ok++;
  }
  console.log(`\nListo: ok=${ok} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
