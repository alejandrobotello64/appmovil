#!/usr/bin/env node
/** Re-sube imágenes generadas/locales de assets → inventory-media. */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

const assets =
  "C:/Users/aleja/.cursor/projects/c-Users-aleja-Desktop-appempresacelular/assets";

const map = [
  ["EQUIPO-000028", "equipo-atlan-a350.jpg"],
  ["EQUIPO-000034", "equipo-atlan-a300.jpg"],
  ["EQUIPO-000029", "equipo-fabius.jpg"],
  ["EQUIPO-000031", "equipo-babyleo.jpg"],
  ["EQUIPO-000036", "equipo-evita-v600.jpg"],
  ["EQUIPO-000035", "equipo-evita-v300.jpg"],
  ["EQUIPO-000038", "equipo-babylog.jpg"],
  ["EQUIPO-000037", "equipo-tofscan.jpg"],
  ["EQUIPO-000039", "equipo-airvo2.jpg"],
  ["EQUIPO-000020", "equipo-welch-connex.jpg"],
  ["EQUIPO-000017", "equipo-welch-connex.jpg"],
  ["EQUIPO-000005", "equipo-mounting-arm.jpg"],
  ["EQUIPO-000019", "equipo-etco2-cable.jpg"],
];

const only = process.argv.slice(2).filter((a) => a.startsWith("EQUIPO-"));
const jobs = only.length ? map.filter(([sku]) => only.includes(sku)) : map;

for (const [sku, file] of jobs) {
  const { data: item, error } = await supabase
    .from("inventory_items")
    .select("id, sku, name, image_url")
    .eq("sku", sku)
    .maybeSingle();
  if (error || !item) {
    console.log("MISS", sku, error?.message);
    continue;
  }
  const fp = join(assets, file);
  if (!existsSync(fp)) {
    console.log("NOFILE", fp);
    continue;
  }
  const bytes = readFileSync(fp);
  const path = `${item.id}/${Date.now()}-equipo.jpg`;
  const { error: upErr } = await supabase.storage
    .from("inventory-media")
    .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (upErr) {
    console.log("UP", sku, upErr.message);
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
    console.log("DB", sku, dbErr.message);
    continue;
  }
  console.log("OK", sku, item.name);
}
