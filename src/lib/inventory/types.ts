export const INVENTORY_CATEGORIES = [
  { id: "insumos", label: "Insumos", description: "Material de consumo médico" },
  { id: "refacciones", label: "Refacciones", description: "Piezas y componentes de equipos" },
  { id: "medicamentos", label: "Medicamentos", description: "Fármacos y soluciones" },
  { id: "accesorios", label: "Accesorios", description: "Complementos y accesorios" },
  { id: "equipos", label: "Equipos médicos", description: "Equipos y dispositivos" },
  { id: "reactivos", label: "Reactivos", description: "Reactivos de laboratorio" },
  { id: "otros", label: "Otros", description: "Artículos diversos" },
] as const;

export type InventoryCategoryId = (typeof INVENTORY_CATEGORIES)[number]["id"];

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
