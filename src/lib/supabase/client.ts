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

function isLoopbackUrl(url: string) {
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "0.0.0.0";
  } catch {
    return true;
  }
}

function resolveSupabaseUrl() {
  // Local/preview: el navegador habla con el mismo origen y Next.js
  // reenvía /rest/v1 a PostgREST. Nube: usa el proyecto de Supabase
  // (si siempre vamos a origin, el JWT de la nube choca con localhost).
  if (typeof window !== "undefined") {
    if (isLoopbackUrl(publicUrl)) {
      return window.location.origin;
    }
    return publicUrl;
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
