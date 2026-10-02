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
