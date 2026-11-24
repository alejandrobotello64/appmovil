import { supabase } from "@/lib/supabase/client";
import { DEFAULT_LOCATION_CODES } from "@/lib/warehouse/stock";
import { parseGalleryImages } from "./unit-media";
import type { InventoryCategoryId, InventoryGalleryImage } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Row = Record<string, unknown>;

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));

export type InventoryBalance = {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  lotNumber: string;
  expiryDate: string;
  manufacturedAt: string;
  quantity: number;
  lot: LotDetails | null;
};

/** Datos propios del lote (no dependen del almacén). */
export type LotDetails = {
  id: string;
  notes: string;
  imagePath: string;
  imageUrl: string;
  galleryImages: InventoryGalleryImage[];
};

export type InventoryLotStock = {
  lotNumber: string;
  expiryDate: string;
  manufacturedAt: string;
  quantity: number;
  locations: string[];
  lot: LotDetails | null;
};

export type InventorySerial = {
  id: string;
  serialNumber: string;
  inventoryNumber: string;
  status: string;
  warehouseId: string;
  location: string;
  notes: string;
  manufacturedAt: string;
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;
  warrantyStart: string;
  warrantyEnd: string;
  imagePath: string;
  imageUrl: string;
  galleryImages: InventoryGalleryImage[];
};

/** Existencias y series crudas de un producto, en todos los almacenes. */
export type InventoryStock = {
  balances: InventoryBalance[];
  serials: InventorySerial[];
};

/** Vista ya filtrada (por almacén o global) que consumen tablas y fichas. */
export type InventoryTracking = {
  lots: InventoryLotStock[];
  serials: InventorySerial[];
};

export type StockPlacement = {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  locationName: string;
  /** Ubicación genérica por categoría: aún no se ha ubicado físicamente. */
  unplaced: boolean;
  quantity: number;
};

export const SERIAL_STATUS_LABELS: Record<string, string> = {
  disponible: "Disponible",
  reservado: "Reservado",
  en_transito: "En tránsito",
  instalado: "Instalado",
  en_servicio: "En servicio",
  en_reparacion: "En reparación",
  baja: "Baja",
};

function compareLots(a: InventoryLotStock, b: InventoryLotStock) {
  if (a.expiryDate && b.expiryDate) return a.expiryDate.localeCompare(b.expiryDate);
  if (a.expiryDate) return -1;
  if (b.expiryDate) return 1;
  return a.lotNumber.localeCompare(b.lotNumber);
}

function inWarehouse<T extends { warehouseId: string }>(rows: T[], warehouseId?: string) {
  return warehouseId ? rows.filter((row) => row.warehouseId === warehouseId) : rows;
}

export function placementLabel(balance: Pick<InventoryBalance, "warehouseCode" | "locationName">) {
  return [balance.warehouseCode, balance.locationName].filter(Boolean).join(" — ");
}

export function isUnplacedLocation(code: string) {
  return !code || DEFAULT_LOCATION_CODES.includes(code);
}

/** Lotes y series del producto, opcionalmente solo de un almacén. */
export function trackingFor(
  stock: InventoryStock | undefined,
  warehouseId?: string
): InventoryTracking | undefined {
  if (!stock) return undefined;
  const lots: InventoryLotStock[] = [];
  for (const balance of inWarehouse(stock.balances, warehouseId)) {
    if (!balance.lotNumber) continue;
    let lot = lots.find((item) => item.lotNumber === balance.lotNumber);
    if (!lot) {
      lot = {
        lotNumber: balance.lotNumber,
        expiryDate: balance.expiryDate,
        manufacturedAt: balance.manufacturedAt,
        quantity: 0,
        locations: [],
        lot: balance.lot,
      };
      lots.push(lot);
    }
    lot.quantity += balance.quantity;
    const label = placementLabel(balance);
    if (label && !lot.locations.includes(label)) lot.locations.push(label);
  }
  lots.sort(compareLots);
  return { lots, serials: inWarehouse(stock.serials, warehouseId) };
}

/** Existencia agrupada por almacén + ubicación (sumando lotes). */
export function placementsFor(
  stock: InventoryStock | undefined,
  warehouseId?: string
): StockPlacement[] {
  if (!stock) return [];
  const placements: StockPlacement[] = [];
  for (const balance of inWarehouse(stock.balances, warehouseId)) {
    let placement = placements.find(
      (item) =>
        item.warehouseId === balance.warehouseId && item.locationName === balance.locationName
    );
    if (!placement) {
      placement = {
        warehouseId: balance.warehouseId,
        warehouseCode: balance.warehouseCode,
        warehouseName: balance.warehouseName,
        locationName: balance.locationName,
        unplaced: isUnplacedLocation(balance.locationCode),
        quantity: 0,
      };
      placements.push(placement);
    }
    placement.quantity += balance.quantity;
  }
  return placements.sort(
    (a, b) =>
      a.warehouseCode.localeCompare(b.warehouseCode) || b.quantity - a.quantity
  );
}

export function quantityIn(stock: InventoryStock | undefined, warehouseId: string) {
  return inWarehouse(stock?.balances ?? [], warehouseId).reduce(
    (sum, balance) => sum + balance.quantity,
    0
  );
}

export function hasStockIn(stock: InventoryStock | undefined, warehouseId: string) {
  return (
    quantityIn(stock, warehouseId) > 0 ||
    inWarehouse(stock?.serials ?? [], warehouseId).length > 0
  );
}

function asRow(value: unknown): Row {
  if (Array.isArray(value)) return (value[0] as Row) || {};
  return (value as Row) || {};
}

/** Supabase corta en 1000 filas; paginamos para no perder lotes/series. */
async function fetchAllRows(buildQuery: () => any): Promise<Row[]> {
  const pageSize = 1000;
  const rows: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as Row[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
}

/**
 * Existencias (con almacén, ubicación y lote) y números de serie vigentes de todos los
 * artículos (de una categoría, o de todo el catálogo), agrupados por producto.
 */
export async function getInventoryStock(
  category?: InventoryCategoryId,
  productId?: string
): Promise<Map<string, InventoryStock>> {
  const balanceSelect =
    "product_id, qty_on_hand, lot:lots(id, lot_number, expiry_date, manufactured_at, notes, image_path, image_url, gallery_images), warehouse:warehouses(id, code, name), location:locations(id, code, name), item:inventory_items!inner(category)";
  const serialSelect =
    "id, product_id, serial_number, inventory_number, status, warehouse_id, notes, manufactured_at, last_maintenance_date, next_maintenance_date, warranty_start, warranty_end, image_path, image_url, gallery_images, warehouse:warehouses(code), location:locations(name), item:inventory_items!inner(category)";

  const [balanceRows, serialRows] = await Promise.all([
    fetchAllRows(() => {
      let query = db
        .from("inventory_balances")
        .select(balanceSelect)
        .gt("qty_on_hand", 0)
        .order("product_id", { ascending: true });
      if (category) query = query.eq("item.category", category);
      if (productId) query = query.eq("product_id", productId);
      return query;
    }),
    fetchAllRows(() => {
      let query = db
        .from("serial_numbers")
        .select(serialSelect)
        .neq("status", "baja")
        .order("serial_number", { ascending: true });
      if (category) query = query.eq("item.category", category);
      if (productId) query = query.eq("product_id", productId);
      return query;
    }),
  ]);

  const stock = new Map<string, InventoryStock>();
  const entry = (id: string) => {
    let current = stock.get(id);
    if (!current) {
      current = { balances: [], serials: [] };
      stock.set(id, current);
    }
    return current;
  };

  for (const row of balanceRows) {
    const lot = asRow(row.lot);
    const warehouse = asRow(row.warehouse);
    const location = asRow(row.location);
    entry(str(row.product_id)).balances.push({
      warehouseId: str(warehouse.id),
      warehouseCode: str(warehouse.code),
      warehouseName: str(warehouse.name),
      locationId: str(location.id),
      locationCode: str(location.code),
      locationName: str(location.name),
      lotNumber: str(lot.lot_number),
      expiryDate: str(lot.expiry_date),
      manufacturedAt: str(lot.manufactured_at),
      quantity: Number(row.qty_on_hand ?? 0) || 0,
      lot: lot.id
        ? {
            id: str(lot.id),
            notes: str(lot.notes),
            imagePath: str(lot.image_path),
            imageUrl: str(lot.image_url),
            galleryImages: parseGalleryImages(lot.gallery_images),
          }
        : null,
    });
  }

  for (const row of serialRows) {
    const warehouse = asRow(row.warehouse);
    const location = asRow(row.location);
    entry(str(row.product_id)).serials.push({
      id: str(row.id),
      serialNumber: str(row.serial_number),
      inventoryNumber: str(row.inventory_number),
      status: str(row.status),
      warehouseId: str(row.warehouse_id),
      location: [str(warehouse.code), str(location.name)].filter(Boolean).join(" — "),
      notes: str(row.notes),
      manufacturedAt: str(row.manufactured_at),
      lastMaintenanceDate: str(row.last_maintenance_date),
      nextMaintenanceDate: str(row.next_maintenance_date),
      warrantyStart: str(row.warranty_start),
      warrantyEnd: str(row.warranty_end),
      imagePath: str(row.image_path),
      imageUrl: str(row.image_url),
      galleryImages: parseGalleryImages(row.gallery_images),
    });
  }

  return stock;
}
