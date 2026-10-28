import { supabase } from "@/lib/supabase/client";

/** Texto del modelo de catálogo. Vacío se muestra como raya para que el dato siempre aparezca. */
export function catalogModelLabel(model: string | null | undefined) {
  const value = (model ?? "").trim();
  return value ? `Modelo ${value}` : "Modelo —";
}

export async function catalogModelsById(ids: Array<string | null | undefined>) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id?.trim())))];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, model")
    .in("id", unique);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) map.set(row.id, row.model ?? "");
  return map;
}
