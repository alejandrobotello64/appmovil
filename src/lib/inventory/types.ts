/** Insumos y consumibles (tabla propia, sin equipos) */
export const SUPPLY_CATEGORIES = [
  {
    id: "insumos",
    label: "Insumos",
    description: "Material de consumo médico. Caducidad y fecha de fabricación opcionales",
  },
  {
    id: "medicamentos",
    label: "Medicamentos",
    description: "Fármacos y soluciones. Caducidad y fecha de fabricación opcionales",
  },
  {
    id: "refacciones",
    label: "Refacciones",
    description: "Piezas y componentes de equipos",
  },
  {
    id: "accesorios",
    label: "Accesorios",
    description: "Complementos con fecha de fabricación, sin caducidad",
  },
  {
    id: "reactivos",
    label: "Reactivos",
    description: "Reactivos de laboratorio. Caducidad y fecha de fabricación opcionales",
  },
] as const;

/** Categorías que obligan control de caducidad y lote */
export const EXPIRY_SUPPLY_CATEGORY_IDS = [
  "insumos",
  "medicamentos",
  "reactivos",
] as const;

/** Refacciones y accesorios (sin caducidad obligatoria) */
export const PARTS_SUPPLY_CATEGORY_IDS = ["refacciones", "accesorios"] as const;

/** Accesorios y equipos llevan fecha de fabricación */
export const MANUFACTURE_DATE_CATEGORY_IDS = [
  "accesorios",
  "equipos",
] as const;

/** Categorías principales para identificar productos en el catálogo */
export const CATALOG_CATEGORIES = [
  ...SUPPLY_CATEGORIES,
  {
    id: "equipos",
    label: "Equipos",
    description:
      "Equipos y dispositivos médicos. El catálogo es por modelo; las series se registran al dar entrada",
  },
] as const;

export const PRODUCT_CATEGORIES = [
  ...CATALOG_CATEGORIES.filter((item) => item.id !== "equipos"),
  { id: "otros", label: "Otros", description: "Artículos diversos" },
] as const;

export const EQUIPMENT_CATEGORY = {
  id: "equipos",
  label: "Equipos médicos",
  description:
    "Equipos y dispositivos. Alta por modelo; las series se capturan en el registro de entradas",
} as const;

export const INVENTORY_CATEGORIES = [
  ...CATALOG_CATEGORIES.filter((item) => item.id !== "equipos"),
  EQUIPMENT_CATEGORY,
  { id: "otros", label: "Otros", description: "Artículos diversos" },
] as const;

export type InventoryCategoryId = (typeof INVENTORY_CATEGORIES)[number]["id"];
export type CatalogCategoryId = (typeof CATALOG_CATEGORIES)[number]["id"];

export function isCatalogCategoryId(
  value: string | null | undefined
): value is CatalogCategoryId {
  return CATALOG_CATEGORIES.some((item) => item.id === value);
}

export function normalizeCatalogCategory(
  value: string | null | undefined
): CatalogCategoryId | null {
  if (value === "equipo") return "equipos";
  return isCatalogCategoryId(value) ? value : null;
}
export type ProductCategoryId = (typeof PRODUCT_CATEGORIES)[number]["id"];
export type SupplyCategoryId = (typeof SUPPLY_CATEGORIES)[number]["id"];
export type ExpirySupplyCategoryId =
  (typeof EXPIRY_SUPPLY_CATEGORY_IDS)[number];
export type ItemKind = "producto" | "equipo";

export const SUPPLY_CATEGORY_IDS = SUPPLY_CATEGORIES.map(
  (item) => item.id
) as SupplyCategoryId[];

export function isSupplyCategory(
  category: InventoryCategoryId
): category is SupplyCategoryId {
  return SUPPLY_CATEGORY_IDS.includes(category as SupplyCategoryId);
}

export function categoryRequiresExpiry(
  category: InventoryCategoryId
): boolean {
  return (EXPIRY_SUPPLY_CATEGORY_IDS as readonly string[]).includes(category);
}

export function categoryRequiresManufactureDate(
  category: InventoryCategoryId
): boolean {
  return (MANUFACTURE_DATE_CATEGORY_IDS as readonly string[]).includes(
    category
  );
}

export function getSupplyCategoryMeta(category: SupplyCategoryId) {
  return (
    SUPPLY_CATEGORIES.find((item) => item.id === category) ??
    SUPPLY_CATEGORIES[0]
  );
}

export type AssetStatus =
  | "operativo"
  | "mantenimiento"
  | "fuera_servicio"
  | "baja";

export const ASSET_STATUS_OPTIONS: { id: AssetStatus; label: string }[] = [
  { id: "operativo", label: "Operativo" },
  { id: "mantenimiento", label: "En mantenimiento" },
  { id: "fuera_servicio", label: "Fuera de servicio" },
  { id: "baja", label: "Baja" },
];

export function categoryToItemKind(
  category: InventoryCategoryId
): ItemKind {
  return category === "equipos" ? "equipo" : "producto";
}

export const INVENTORY_UNITS = [
  "pieza",
  "caja",
  "paquete",
  "litro",
  "ml",
  "kg",
  "g",
  "par",
  "rollo",
  "frasco",
] as const;

export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

export type StockStatus = "disponible" | "bajo_stock" | "agotado";

export type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  category: InventoryCategoryId;
  itemKind: ItemKind;
  description: string;
  quantity: number;
  minStock: number;
  unit: InventoryUnit;
  location: string;
  brand: string;
  /** Color de etiqueta para separar el producto en listas. */
  colorTag: string;
  model: string;
  serialNumber: string;
  unitPrice: number;
  /** Costo de lista / compra. El precio de venta es unitPrice. */
  costPrice: number;
  supplier: string;
  expiryDate: string;
  manufacturedAt: string;
  notes: string;
  assetStatus: AssetStatus;
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;
  isActive: boolean;
  /** Si es false, el SKU sigue consultable pero no genera alerta de agotado. */
  stockAlertsEnabled: boolean;
  tracksLot: boolean;
  tracksSerial: boolean;
  tracksExpiry: boolean;
  maxStock: number;
  reorderPoint: number;
  partNumber: string;
  /** Códigos de barras / QR que identifican el producto al escanear. */
  barcodes?: string[];
  manufacturer: string;
  subcategory: string;
  imagePath: string;
  imageUrl: string;
  /** Imágenes adicionales; la principal sigue en imagePath/imageUrl. */
  galleryImages: InventoryGalleryImage[];
  /** Piezas que salen al abrir una caja. Cero si aún no se ha capturado. */
  piecesPerUnit?: number;
  /** Artículo en piezas que recibe la existencia al abrir la caja. */
  pieceProductId?: string;
  createdAt: string;
  updatedAt: string;
};

export type InventoryGalleryImage = {
  path: string;
  url: string;
  uploadedAt: string;
};

export type InventoryItemInput = Omit<
  InventoryItem,
  "id" | "createdAt" | "updatedAt" | "imagePath" | "imageUrl" | "galleryImages"
> & {
  imagePath?: string;
  imageUrl?: string;
};

export type InventoryFilters = {
  search: string;
  category: InventoryCategoryId | "all";
  status: StockStatus | "all";
};

/** Prefijos cortos del catálogo (ACC-12, INS-3, EQ-26…). */
export const SKU_PREFIX_BY_CATEGORY: Record<InventoryCategoryId, string> = {
  insumos: "INS",
  medicamentos: "MED",
  refacciones: "REF",
  accesorios: "ACC",
  reactivos: "REA",
  equipos: "EQ",
  otros: "OTR",
};

/** Prefijos largos históricos (ACCESORIOS-000001…); se siguen reconociendo. */
export const LEGACY_SKU_PREFIX_BY_CATEGORY: Record<InventoryCategoryId, string> =
  {
    insumos: "INSUMOS",
    medicamentos: "MEDICAMENTOS",
    refacciones: "REFACCIONES",
    accesorios: "ACCESORIOS",
    reactivos: "REACTIVOS",
    equipos: "EQUIPO",
    otros: "OTROS",
  };

export function skuPrefixForCategory(category: InventoryCategoryId) {
  return SKU_PREFIX_BY_CATEGORY[category] ?? "ITEM";
}

export function legacySkuPrefixForCategory(category: InventoryCategoryId) {
  return LEGACY_SKU_PREFIX_BY_CATEGORY[category] ?? "ITEM";
}

const ALL_SKU_PREFIXES = Array.from(
  new Set([
    ...Object.values(SKU_PREFIX_BY_CATEGORY),
    ...Object.values(LEGACY_SKU_PREFIX_BY_CATEGORY),
  ])
);

const SEQUENTIAL_SKU_RE = new RegExp(
  `^(${ALL_SKU_PREFIXES.join("|")})-\\d+$`,
  "i"
);

/** SKU interno del catálogo: EQ-26, INS-12, ACC-2464 (también formatos largos legacy). */
export function isSequentialCatalogSku(sku: string | null | undefined) {
  return SEQUENTIAL_SKU_RE.test(String(sku ?? "").trim());
}

/** Arma el SKU corto sin ceros a la izquierda: ACC-12. */
export function formatCatalogSku(category: InventoryCategoryId, sequence: number) {
  const seq = Math.max(1, Math.floor(sequence));
  return `${skuPrefixForCategory(category)}-${seq}`;
}

/** Extrae el número secuencial de un SKU corto o legacy; null si no aplica. */
export function catalogSkuSequence(
  sku: string | null | undefined,
  category?: InventoryCategoryId
): number | null {
  const value = String(sku ?? "").trim();
  if (!value) return null;
  const prefixes = category
    ? [skuPrefixForCategory(category), legacySkuPrefixForCategory(category)]
    : ALL_SKU_PREFIXES;
  for (const prefix of prefixes) {
    const head = `${prefix}-`;
    if (!value.toUpperCase().startsWith(head.toUpperCase())) continue;
    const seq = Number(value.slice(head.length));
    if (Number.isFinite(seq) && seq > 0) return seq;
  }
  return null;
}

export function isProductCategory(
  category: InventoryCategoryId
): category is ProductCategoryId {
  return category !== "equipos";
}
