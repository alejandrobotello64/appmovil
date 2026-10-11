import { normalizeBrand } from "@/lib/inventory/brands";

export const PRODUCT_COLORS = [
  {
    id: "rojo",
    label: "Rojo",
    swatch: "bg-rose-500",
    chip: "bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100",
    bar: "border-l-rose-500",
  },
  {
    id: "naranja",
    label: "Naranja",
    swatch: "bg-orange-500",
    chip: "bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-100",
    bar: "border-l-orange-500",
  },
  {
    id: "amarillo",
    label: "Amarillo",
    swatch: "bg-amber-400",
    chip: "bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100",
    bar: "border-l-amber-400",
  },
  {
    id: "verde",
    label: "Verde",
    swatch: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100",
    bar: "border-l-emerald-500",
  },
  {
    id: "azul",
    label: "Azul",
    swatch: "bg-sky-500",
    chip: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100",
    bar: "border-l-sky-500",
  },
  {
    id: "morado",
    label: "Morado",
    swatch: "bg-violet-500",
    chip: "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100",
    bar: "border-l-violet-500",
  },
  {
    id: "turquesa",
    label: "Turquesa",
    swatch: "bg-teal-500",
    chip: "bg-teal-100 text-teal-900 dark:bg-teal-950/50 dark:text-teal-100",
    bar: "border-l-teal-500",
  },
  {
    id: "rosa",
    label: "Rosa",
    swatch: "bg-pink-500",
    chip: "bg-pink-100 text-pink-900 dark:bg-pink-950/50 dark:text-pink-100",
    bar: "border-l-pink-500",
  },
  {
    id: "gris",
    label: "Gris",
    swatch: "bg-slate-400",
    chip: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
    bar: "border-l-slate-400",
  },
] as const;

export type ProductColorId = (typeof PRODUCT_COLORS)[number]["id"];

const COLOR_BY_ID = new Map(PRODUCT_COLORS.map((item) => [item.id, item]));

const BRAND_COLOR: Record<string, ProductColorId> = {
  Dräger: "turquesa",
  Philips: "azul",
  Masimo: "morado",
  "3M": "amarillo",
  ASP: "verde",
  "Welch Allyn": "naranja",
  Halyard: "rosa",
  "Edwards Lifesciences": "gris",
  "Hill-Rom": "rojo",
};

export function isProductColorId(value: string | null | undefined): value is ProductColorId {
  return Boolean(value && COLOR_BY_ID.has(value as ProductColorId));
}

export function normalizeProductColor(value: string | null | undefined): ProductColorId | "" {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!raw) return "";
  if (isProductColorId(raw)) return raw;
  if (raw === "cyan" || raw === "teal") return "turquesa";
  if (raw === "purple" || raw === "violeta") return "morado";
  if (raw === "yellow" || raw === "gold") return "amarillo";
  if (raw === "blue") return "azul";
  if (raw === "green") return "verde";
  if (raw === "red") return "rojo";
  if (raw === "orange") return "naranja";
  if (raw === "pink") return "rosa";
  if (raw === "gray" || raw === "grey" || raw === "slate") return "gris";
  return "";
}

export function colorForBrand(brand: string | null | undefined): ProductColorId | "" {
  const normalized = normalizeBrand(brand);
  return BRAND_COLOR[normalized] ?? "";
}

export function resolveProductColor(
  colorTag: string | null | undefined,
  brand?: string | null
) {
  const stored = normalizeProductColor(colorTag);
  if (stored) return stored;
  return colorForBrand(brand);
}

export function productColorMeta(id: string | null | undefined) {
  if (!id) return null;
  return COLOR_BY_ID.get(id as ProductColorId) ?? null;
}

export function productColorLabel(id: string | null | undefined) {
  return productColorMeta(id)?.label ?? "Sin color";
}
