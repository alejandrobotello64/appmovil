/** SKU interno del catálogo, igual que src/lib/inventory/types.ts */

export const SKU_PREFIX_BY_CATEGORY = {
  insumos: "INSUMOS",
  medicamentos: "MEDICAMENTOS",
  refacciones: "REFACCIONES",
  accesorios: "ACCESORIOS",
  reactivos: "REACTIVOS",
  equipos: "EQUIPO",
  otros: "OTROS",
};

export function catalogCategoryOf(item) {
  if (item?.item_kind === "equipo" || item?.category === "equipos") return "equipos";
  const category = String(item?.category ?? "").trim();
  if (category in SKU_PREFIX_BY_CATEGORY) return category;
  return "otros";
}

export function skuPrefixForCategory(category) {
  return SKU_PREFIX_BY_CATEGORY[category] ?? "ITEM";
}

export function formatSequentialSku(category, seq) {
  return `${skuPrefixForCategory(category)}-${String(seq).padStart(6, "0")}`;
}

export function maxSkuSeq(items, category) {
  const prefix = `${skuPrefixForCategory(category)}-`;
  let max = 0;
  for (const item of items ?? []) {
    const sku = String(item?.sku ?? "");
    if (!sku.startsWith(prefix)) continue;
    const seq = Number(sku.slice(prefix.length));
    if (Number.isFinite(seq) && seq > max) max = seq;
  }
  return max;
}

/** Asigna EQUIPO-000001, INSUMOS-000001, ACCESORIOS-000001… sin repetir. */
export function createSkuAllocator(existingItems = []) {
  const maxByCategory = {};
  return function nextSku(category) {
    const key = category in SKU_PREFIX_BY_CATEGORY ? category : catalogCategoryOf({ category });
    if (maxByCategory[key] == null) maxByCategory[key] = maxSkuSeq(existingItems, key);
    maxByCategory[key] += 1;
    return formatSequentialSku(key, maxByCategory[key]);
  };
}
