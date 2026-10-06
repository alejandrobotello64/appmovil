export const PURCHASE_REQUEST_STATUSES = [
  { id: "solicitada", label: "Solicitada" },
  { id: "en_compra", label: "En compra" },
  { id: "pedida", label: "Pedida" },
  { id: "parcial", label: "Recepción parcial" },
  { id: "recibida", label: "Recibida" },
  { id: "cancelada", label: "Cancelada" },
] as const;

export type PurchaseRequestStatus =
  (typeof PURCHASE_REQUEST_STATUSES)[number]["id"];

export const PURCHASE_REQUEST_SOURCES = [
  { id: "manual", label: "Almacén" },
  { id: "requisicion_os", label: "Solicitud de OS" },
  { id: "salida", label: "Salida" },
  { id: "apartado", label: "Apartado" },
] as const;

export type PurchaseRequestSource =
  (typeof PURCHASE_REQUEST_SOURCES)[number]["id"];

export const PURCHASE_REQUEST_REASONS = [
  { id: "sin_existencia", label: "Sin existencia" },
  { id: "stock_insuficiente", label: "Stock insuficiente" },
  { id: "no_surtible", label: "No se puede surtir" },
  { id: "reabasto", label: "Reabasto" },
] as const;

export type PurchaseRequestReason =
  (typeof PURCHASE_REQUEST_REASONS)[number]["id"];

export type PurchaseRequestLine = {
  id: string;
  requestId: string;
  sourceLineId: string | null;
  productId: string | null;
  productSku: string;
  productName: string;
  quantityRequested: number;
  quantityOrdered: number;
  quantityReceived: number;
  unit: string;
  notes: string;
};

export type PurchaseRequest = {
  id: string;
  folio: string;
  status: PurchaseRequestStatus;
  sourceType: PurchaseRequestSource;
  sourceId: string | null;
  sourceFolio: string;
  reason: PurchaseRequestReason;
  requestedBy: string;
  requestedAt: string;
  takenBy: string;
  takenAt: string;
  warehouseNotes: string;
  comprasNotes: string;
  purchaseOrderId: string | null;
  purchaseOrderNumber: string;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseRequestLine[];
};

export type PurchaseRequestLineInput = {
  sourceLineId?: string | null;
  productId: string | null;
  productSku: string;
  productName: string;
  quantity: number;
  unit?: string;
  notes?: string;
};

export type CreatePurchaseRequestInput = {
  sourceType?: PurchaseRequestSource;
  sourceId?: string | null;
  sourceFolio?: string;
  reason?: PurchaseRequestReason;
  requestedBy: string;
  warehouseNotes?: string;
  lines: PurchaseRequestLineInput[];
};

export function purchaseRequestStatusLabel(status: string) {
  return (
    PURCHASE_REQUEST_STATUSES.find((item) => item.id === status)?.label ??
    status
  );
}

export function purchaseRequestSourceLabel(source: string) {
  return (
    PURCHASE_REQUEST_SOURCES.find((item) => item.id === source)?.label ?? source
  );
}

export function purchaseRequestReasonLabel(reason: string) {
  return (
    PURCHASE_REQUEST_REASONS.find((item) => item.id === reason)?.label ?? reason
  );
}

export function isOpenPurchaseRequest(status: PurchaseRequestStatus) {
  return (
    status === "solicitada" ||
    status === "en_compra" ||
    status === "pedida" ||
    status === "parcial"
  );
}
