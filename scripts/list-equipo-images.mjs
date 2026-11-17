import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

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
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await sb
  .from("inventory_items")
  .select("sku,name,image_url")
  .ilike("sku", "EQUIPO-%")
  .order("sku");

if (error) {
  console.error(error);
  process.exit(1);
}
for (const row of data || []) {
  console.log(`${row.sku}\t${row.name}\t${(row.image_url || "").slice(0, 110)}`);
}
console.log(`total equipos=${(data || []).length}`);
