import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const internalUrl = process.env.SUPABASE_INTERNAL_URL;

if (!configuredUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local"
  );
}

const publicUrl: string = configuredUrl;
const anonKey: string = supabaseAnonKey;

function resolveSupabaseUrl() {
  // El preview de Cursor no reenvía :54321. El navegador siempre habla con
  // el mismo origen (Next.js /rest/v1 → PostgREST).
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return internalUrl || publicUrl;
}

let cachedUrl = "";
let cachedClient: SupabaseClient<Database> | null = null;

function getSupabase(): SupabaseClient<Database> {
  const url = resolveSupabaseUrl();
  if (!cachedClient || cachedUrl !== url) {
    cachedUrl = url;
    cachedClient = createClient<Database>(url, anonKey);
  }
  return cachedClient;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, property) {
    const client = getSupabase();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
