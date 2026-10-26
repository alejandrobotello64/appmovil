export const REQUISITION_STATUSES = [
  { id: "solicitada", label: "Solicitada" },
  { id: "parcial", label: "Parcial" },
  { id: "surtida", label: "Surtida" },
  { id: "cancelada", label: "Cancelada" },
] as const;

export type RequisitionStatus = (typeof REQUISITION_STATUSES)[number]["id"];

export const REQUISITION_LINE_STATUSES = [
  { id: "pendiente", label: "Pendiente" },
  { id: "parcial", label: "Parcial" },
  { id: "surtido", label: "Surtido" },
  { id: "cancelado", label: "Cancelado" },
] as const;

export type RequisitionLineStatus =
  (typeof REQUISITION_LINE_STATUSES)[number]["id"];

export const REQUISITION_SOURCES = [
  { id: "orden_servicio", label: "Servicio técnico" },
  { id: "cotizacion", label: "Ventas" },
] as const;

export type RequisitionSource = (typeof REQUISITION_SOURCES)[number]["id"];

export type RequisitionPriority = "normal" | "urgente";

export type ServiceOrderRequisitionLine = {
  id: string;
  requisitionId: string;
  serviceOrderLineId: string | null;
  quoteLineId: string | null;
  /** Null en partidas fuera de catálogo: se compran y se entregan sin movimiento de inventario. */
  productId: string | null;
  productSku: string;
  productName: string;
  /** Número de parte del catálogo, o el capturado en la cotización si no hay producto. */
  partNumber: string;
  description: string;
  quantityRequested: number;
  quantityFulfilled: number;
  unit: string;
  lineStatus: RequisitionLineStatus;
  notes: string;
};

export type ServiceOrderRequisition = {
  id: string;
  folio: string;
  sourceType: RequisitionSource;
  serviceOrderId: string | null;
  serviceOrderFolio: string;
  quoteId: string | null;
  quoteFolio: string;
  clientName: string;
  equipmentName: string;
  priority: RequisitionPriority;
  neededBy: string;
  deliveryAddress: string;
  status: RequisitionStatus;
  requestedBy: string;
  requestedAt: string;
  fulfilledBy: string;
  fulfilledAt: string;
  notes: string;
  warehouseNotes: string;
  createdAt: string;
  updatedAt: string;
  lines: ServiceOrderRequisitionLine[];
};

export type RequisitionLineInput = {
  serviceOrderLineId?: string | null;
  quoteLineId?: string | null;
  productId: string | null;
  description: string;
  quantity: number;
  unit?: string;
  notes?: string;
};

export type CreateRequisitionInput = {
  serviceOrderId: string;
  requestedBy: string;
  notes?: string;
  lines: RequisitionLineInput[];
};

export type CreateQuoteRequisitionInput = {
  quoteId: string;
  requestedBy: string;
  priority?: RequisitionPriority;
  neededBy?: string;
  deliveryAddress?: string;
  notes?: string;
  lines: RequisitionLineInput[];
};

export type FulfillLineInput = {
  lineId: string;
  quantity: number;
};

export type RequisitionFulfillment = {
  id: string;
  requisitionId: string;
  lineId: string | null;
  quantity: number;
  fulfilledBy: string;
  notes: string;
  createdAt: string;
};

export function requisitionLinePending(
  line: Pick<ServiceOrderRequisitionLine, "quantityRequested" | "quantityFulfilled" | "lineStatus">
) {
  if (line.lineStatus === "cancelado") return 0;
  return Math.max(0, line.quantityRequested - line.quantityFulfilled);
}

export function isOffCatalogLine(line: Pick<ServiceOrderRequisitionLine, "productId">) {
  return !line.productId;
}

export function isRequisitionOpen(status: RequisitionStatus) {
  return status === "solicitada" || status === "parcial";
}

export function requisitionStatusLabel(status: string) {
  return REQUISITION_STATUSES.find((s) => s.id === status)?.label ?? status;
}

export function requisitionSourceLabel(source: string) {
  return REQUISITION_SOURCES.find((s) => s.id === source)?.label ?? source;
}

/** Folio del documento que originó la solicitud (OS o cotización). */
export function requisitionOriginFolio(
  requisition: Pick<ServiceOrderRequisition, "sourceType" | "serviceOrderFolio" | "quoteFolio">
) {
  return requisition.sourceType === "cotizacion"
    ? requisition.quoteFolio
    : requisition.serviceOrderFolio;
}

export function requisitionProgress(requisition: Pick<ServiceOrderRequisition, "lines">) {
  const active = requisition.lines.filter((line) => line.lineStatus !== "cancelado");
  const requested = active.reduce((sum, line) => sum + line.quantityRequested, 0);
  const fulfilled = active.reduce((sum, line) => sum + Math.min(line.quantityFulfilled, line.quantityRequested), 0);
  return { requested, fulfilled, percent: requested > 0 ? Math.round((fulfilled / requested) * 100) : 0 };
}

export function requisitionLineStatusLabel(status: string) {
  return (
    REQUISITION_LINE_STATUSES.find((s) => s.id === status)?.label ?? status
  );
}

/** Misma clave de producto aunque el código venga con guiones o espacios. */
export function requisitionLineProductKey(
  line: Pick<ServiceOrderRequisitionLine, "productId" | "productSku" | "description" | "unit">
) {
  if (line.productId) return `id:${line.productId}|${requesterKey(line.unit)}`;
  const sku = String(line.productSku ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\-_/]/g, "")
    .toUpperCase();
  if (sku) return `sku:${sku}|${requesterKey(line.unit)}`;
  return `off:${requesterKey(line.description)}|${requesterKey(line.unit)}`;
}

export type GroupedRequisitionSource = {
  requisition: ServiceOrderRequisition;
  line: ServiceOrderRequisitionLine;
};

export type GroupedRequisitionLine = {
  key: string;
  productId: string | null;
  productSku: string;
  productName: string;
  partNumber: string;
  description: string;
  unit: string;
  quantityRequested: number;
  quantityFulfilled: number;
  pending: number;
  lineStatus: RequisitionLineStatus;
  offCatalog: boolean;
  sources: GroupedRequisitionSource[];
};

function groupedLineStatus(lines: ServiceOrderRequisitionLine[]): RequisitionLineStatus {
  const active = lines.filter((line) => line.lineStatus !== "cancelado");
  if (!active.length) return "cancelado";
  if (active.every((line) => line.lineStatus === "surtido")) return "surtido";
  if (active.every((line) => line.lineStatus === "pendiente")) return "pendiente";
  return "parcial";
}

/** Junta el mismo código (SKU / producto) para que almacén recoja una sola cantidad. */
export function groupRequisitionLines(
  requisitions: ServiceOrderRequisition[]
): GroupedRequisitionLine[] {
  const order: string[] = [];
  const map = new Map<string, GroupedRequisitionLine>();
  for (const requisition of requisitions) {
    for (const line of requisition.lines) {
      const key = requisitionLineProductKey(line);
      const existing = map.get(key);
      if (existing) {
        existing.quantityRequested += line.quantityRequested;
        existing.quantityFulfilled += line.quantityFulfilled;
        existing.pending += requisitionLinePending(line);
        existing.sources.push({ requisition, line });
        existing.lineStatus = groupedLineStatus(existing.sources.map((source) => source.line));
        if (!existing.productSku && line.productSku) existing.productSku = line.productSku;
        if (!existing.partNumber && line.partNumber) existing.partNumber = line.partNumber;
        if (!existing.description && line.description) existing.description = line.description;
        continue;
      }
      order.push(key);
      map.set(key, {
        key,
        productId: line.productId,
        productSku: line.productSku,
        productName: line.productName,
        partNumber: line.partNumber,
        description: line.description,
        unit: line.unit,
        quantityRequested: line.quantityRequested,
        quantityFulfilled: line.quantityFulfilled,
        pending: requisitionLinePending(line),
        lineStatus: line.lineStatus,
        offCatalog: isOffCatalogLine(line),
        sources: [{ requisition, line }],
      });
    }
  }
  return order.map((key) => map.get(key)!);
}

/** Reparte una cantidad total entre las partidas del mismo código, en el orden de las solicitudes. */
export function allocateFulfillmentQty(
  lines: Pick<
    ServiceOrderRequisitionLine,
    "id" | "quantityRequested" | "quantityFulfilled" | "lineStatus"
  >[],
  quantity: number
) {
  let remaining = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
  const allocated: Record<string, number> = {};
  for (const line of lines) {
    const take = Math.min(requisitionLinePending(line), remaining);
    allocated[line.id] = take;
    remaining -= take;
  }
  return allocated;
}

/** Agrupa solicitudes de surtimiento de la misma persona (técnico / vendedor). */
export function requesterKey(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Usuario, correo o parte local del correo; sirve para reconocer a la misma persona. */
export function requesterTokens(value: string | null | undefined) {
  const raw = requesterKey(value);
  if (!raw) return [];
  const tokens = new Set<string>([raw]);
  if (raw.includes("@")) {
    const local = raw.slice(0, raw.indexOf("@"));
    if (local.length >= 4) tokens.add(local);
  }
  return [...tokens];
}

export type RequesterDirectoryEntry = {
  username: string;
  fullName: string;
};

export function canonicalRequester(
  value: string | null | undefined,
  directory: RequesterDirectoryEntry[] = []
) {
  const tokens = new Set(requesterTokens(value));
  if (!tokens.size) return "";
  const member = directory.find(
    (entry) =>
      requesterTokens(entry.username).some((token) => tokens.has(token)) ||
      requesterTokens(entry.fullName).some((token) => tokens.has(token))
  );
  return member ? requesterKey(member.username) : requesterKey(value);
}

export function sameRequester(
  left: string | null | undefined,
  right: string | null | undefined,
  directory: RequesterDirectoryEntry[] = []
) {
  if (directory.length) {
    const a = canonicalRequester(left, directory);
    const b = canonicalRequester(right, directory);
    return Boolean(a) && a === b;
  }
  const other = new Set(requesterTokens(right));
  return requesterTokens(left).some((token) => other.has(token));
}
