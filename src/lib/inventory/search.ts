import { supabase } from "@/lib/supabase/client";
import { isSupplyCategory } from "@/lib/inventory/types";

export type GlobalSearchHit = {
  id: string;
  kind: "producto" | "equipo" | "serie";
  title: string;
  subtitle: string;
  href: string;
};

export async function searchCatalog(query: string): Promise<GlobalSearchHit[]> {
  const term = query
    .trim()
    .replace(/[%_,()\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (term.length < 2) return [];

  const like = `%${term}%`;
  const { data, error } = await supabase
    .from("inventory_items")
    .select(
      "id, sku, name, brand, model, serial_number, part_number, item_kind, category, location, is_active"
    )
    .eq("is_active", true)
    .or(
      `sku.ilike.${like},name.ilike.${like},brand.ilike.${like},model.ilike.${like},serial_number.ilike.${like},part_number.ilike.${like}`
    )
    .limit(12);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const tab =
      row.item_kind === "equipo"
        ? "equipo"
        : isSupplyCategory(row.category as never)
          ? row.category
          : "insumos";
    return {
      id: row.id,
      kind: row.item_kind === "equipo" ? "equipo" : "producto",
      title: `${row.sku} · ${row.name}`,
      subtitle: [row.brand, row.model, row.serial_number, row.location]
        .filter(Boolean)
        .join(" · "),
      href: `/dashboard/almacen?tab=${tab}`,
    };
  });
}
