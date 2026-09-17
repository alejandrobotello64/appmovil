/** Insumos y consumibles (tabla propia, sin equipos) */
export const SUPPLY_CATEGORIES = [
  {
    id: "insumos",
    label: "Insumos",
    description: "Material de consumo médico con caducidad",
  },
  {
    id: "medicamentos",
    label: "Medicamentos",
    description: "Fármacos y soluciones con caducidad",
  },
  {
    id: "refacciones",
    label: "Refacciones",
    description: "Piezas y componentes de equipos",
  },
  {
    id: "accesorios",
    label: "Accesorios",
    description: "Complementos y accesorios",
  },
  {
    id: "reactivos",
    label: "Reactivos",
    description: "Reactivos de laboratorio con caducidad",
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

/** Categorías principales para identificar productos en el catálogo */
export const CATALOG_CATEGORIES = [
  ...SUPPLY_CATEGORIES,
  {
    id: "equipos",
    label: "Equipos",
    description: "Equipos y dispositivos médicos",
  },
] as const;

export const PRODUCT_CATEGORIES = [
  ...CATALOG_CATEGORIES.filter((item) => item.id !== "equipos"),
  { id: "otros", label: "Otros", description: "Artículos diversos" },
] as const;

export const EQUIPMENT_CATEGORY = {
  id: "equipos",
  label: "Equipos médicos",
  description: "Equipos y dispositivos activos del almacén",
} as const;

export const INVENTORY_CATEGORIES = [
  ...CATALOG_CATEGORIES.filter((item) => item.id !== "equipos"),
  EQUIPMENT_CATEGORY,
  { id: "otros", label: "Otros", description: "Artículos diversos" },
] as const;

export type InventoryCategoryId = (typeof INVENTORY_CATEGORIES)[number]["id"];
export type CatalogCategoryId = (typeof CATALOG_CATEGORIES)[number]["id"];
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
  model: string;
  serialNumber: string;
  unitPrice: number;
  supplier: string;
  expiryDate: string;
  notes: string;
  assetStatus: AssetStatus;
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;
  isActive: boolean;
  tracksLot: boolean;
  tracksSerial: boolean;
  tracksExpiry: boolean;
  maxStock: number;
  reorderPoint: number;
  partNumber: string;
  manufacturer: string;
  subcategory: string;
  createdAt: string;
  updatedAt: string;
};

export type InventoryItemInput = Omit<
  InventoryItem,
  "id" | "createdAt" | "updatedAt"
>;

export type InventoryFilters = {
  search: string;
  category: InventoryCategoryId | "all";
  status: StockStatus | "all";
};

export function isProductCategory(
  category: InventoryCategoryId
): category is ProductCategoryId {
  return category !== "equipos";
}
