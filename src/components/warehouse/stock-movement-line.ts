import type { InventoryItem } from "@/lib/inventory/types";

export type StockMovementLine = {
  key: string;
  productId: string;
  sku: string;
  name: string;
  partNumber: string;
  model: string;
  unit: string;
  quantity: number;
  lotNumber: string;
  expiryDate: string;
  manufacturedAt: string;
  serialNumber: string;
  /** Ubicación destino/origen de esta línea (puede diferir del default del formulario). */
  locationId: string;
  isEquipment: boolean;
  tracksLot: boolean;
  tracksSerial: boolean;
};

export function isEquipmentItem(item: InventoryItem) {
  return item.itemKind === "equipo" || item.category === "equipos";
}

export function lineFromProduct(
  item: InventoryItem,
  extras: Partial<
    Pick<
      StockMovementLine,
      | "quantity"
      | "lotNumber"
      | "expiryDate"
      | "manufacturedAt"
      | "serialNumber"
      | "locationId"
    >
  > = {}
): StockMovementLine {
  const isEquipment = isEquipmentItem(item);
  return {
    key: crypto.randomUUID(),
    productId: item.id,
    sku: item.sku,
    name: item.name,
    partNumber: item.partNumber ?? "",
    model: item.model ?? "",
    unit: item.unit || "pza",
    quantity: extras.quantity && extras.quantity > 0 ? extras.quantity : 1,
    lotNumber: extras.lotNumber ?? "",
    expiryDate: extras.expiryDate ?? "",
    manufacturedAt: extras.manufacturedAt ?? "",
    serialNumber: extras.serialNumber ?? "",
    locationId: extras.locationId ?? "",
    isEquipment,
    tracksLot: Boolean(item.tracksLot) && !isEquipment,
    tracksSerial: Boolean(item.tracksSerial) || isEquipment,
  };
}

/** Misma identidad de línea: producto + lote + serie + ubicación (para sumar cantidades). */
export function sameLineIdentity(a: StockMovementLine, b: StockMovementLine) {
  return (
    a.productId === b.productId &&
    a.lotNumber.trim() === b.lotNumber.trim() &&
    a.serialNumber.trim() === b.serialNumber.trim() &&
    a.locationId === b.locationId
  );
}

/**
 * Agrega una línea al carrito. Si ya existe la misma identidad y no es equipo
 * con serie distinta, suma la cantidad.
 */
export function mergeMovementLine(
  lines: StockMovementLine[],
  next: StockMovementLine
): StockMovementLine[] {
  if (next.isEquipment && next.serialNumber.trim()) {
    const exists = lines.some(
      (line) =>
        line.productId === next.productId &&
        line.serialNumber.trim() === next.serialNumber.trim()
    );
    if (exists) return lines;
    return [...lines, next];
  }
  const index = lines.findIndex((line) => sameLineIdentity(line, next));
  if (index < 0) return [...lines, next];
  return lines.map((line, i) =>
    i === index
      ? {
          ...line,
          quantity: line.quantity + next.quantity,
          expiryDate: next.expiryDate || line.expiryDate,
          manufacturedAt: next.manufacturedAt || line.manufacturedAt,
        }
      : line
  );
}
