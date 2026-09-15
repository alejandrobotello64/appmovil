import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!configuredUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local"
  );
}

const supabaseUrl = configuredUrl;
const supabaseKey = supabaseAnonKey;

function resolveSupabaseUrl() {
  try {
    const parsed = new URL(supabaseUrl);
    const isLoopback =
      parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    if (isLoopback && typeof window !== "undefined") {
      return window.location.origin;
    }
  } catch {
    // keep configured URL
  }
  return supabaseUrl;
}

export const supabase = createClient<Database>(
  resolveSupabaseUrl(),
  supabaseKey
);
