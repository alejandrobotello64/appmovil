import { supabase } from "@/lib/supabase/client";
import { isSupplyCategory } from "@/lib/inventory/types";

export type GlobalSearchHit = {
  id: string;
  kind: "producto" | "equipo" | "serie";
  title: string;
  subtitle: string;
  partNumber: string;
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
    const href =
      row.item_kind === "equipo"
        ? "/dashboard/almacen?tab=equipo"
        : `/dashboard/almacen?tab=inventario${
            isSupplyCategory(row.category as never)
              ? `&categoria=${row.category}`
              : ""
          }`;
    const sku = String(row.sku ?? "").trim();
    const part = String(row.part_number ?? "").trim();
    return {
      id: row.id,
      kind: row.item_kind === "equipo" ? "equipo" : "producto",
      title: `${sku} · ${row.name}`,
      partNumber: part,
      subtitle: [row.brand, row.model, row.serial_number, row.location]
        .filter(Boolean)
        .join(" · "),
      href,
    };
  });
}
