export const PURCHASE_REQUEST_STATUSES = [
  { id: "pendiente", label: "Pendiente" },
  { id: "en_proceso", label: "En proceso" },
  { id: "ordenada", label: "Ordenada" },
  { id: "recibida", label: "Recibida" },
  { id: "rechazada", label: "Rechazada" },
  { id: "cancelada", label: "Cancelada" },
] as const;

export type PurchaseRequestStatus = (typeof PURCHASE_REQUEST_STATUSES)[number]["id"];

/** Estatus en los que la compra sigue viva y cuenta como material "en camino". */
export const OPEN_PURCHASE_STATUSES: PurchaseRequestStatus[] = ["pendiente", "en_proceso", "ordenada"];

export const PURCHASE_PRIORITIES = [
  { id: "normal", label: "Normal" },
  { id: "urgente", label: "Urgente" },
] as const;

export type PurchasePriority = (typeof PURCHASE_PRIORITIES)[number]["id"];

export type PurchaseRequestSource = "surtimiento" | "manual";

export type PurchaseRequestLine = {
  id: string;
  requestId: string;
  requisitionLineId: string | null;
  productId: string | null;
  productSku: string;
  productName: string;
  description: string;
  unit: string;
  quantity: number;
  stockAtRequest: number;
  notes: string;
  /** Orden de compra (de un solo proveedor) a la que quedó asignado este material. */
  purchaseOrderId: string | null;
};

export type PurchaseRequestEvent = {
  id: string;
  eventType: string;
  message: string;
  actor: string;
  createdAt: string;
};

export type PurchaseRequester = {
  username: string;
  name: string;
  jobTitle: string;
  department: string;
};

export type PurchaseRequest = {
  id: string;
  folio: string;
  status: PurchaseRequestStatus;
  priority: PurchasePriority;
  source: PurchaseRequestSource;
  requisitionId: string | null;
  requisitionFolio: string;
  serviceOrderId: string | null;
  serviceOrderFolio: string;
  clientName: string;
  equipmentName: string;
  justification: string;
  neededBy: string;
  notes: string;
  requester: PurchaseRequester;
  requestedAt: string;
  assignedTo: string;
  purchasingNotes: string;
  purchaseOrderId: string | null;
  purchaseOrderNumber: string;
  supplierName: string;
  orderedAt: string;
  receivedAt: string;
  closedBy: string;
  closedReason: string;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseRequestLine[];
  events: PurchaseRequestEvent[];
};

export type PurchaseRequestLineInput = {
  requisitionLineId?: string | null;
  productId?: string | null;
  productSku?: string;
  productName?: string;
  description: string;
  unit?: string;
  quantity: number;
  stockAtRequest?: number;
  notes?: string;
};

export type CreatePurchaseRequestInput = {
  requisitionId?: string | null;
  serviceOrderId?: string | null;
  priority: PurchasePriority;
  neededBy: string;
  justification: string;
  notes: string;
  requester: { username: string; fullName: string | null };
  lines: PurchaseRequestLineInput[];
};

/** Una OC por proveedor; los materiales que no se incluyan quedan pendientes de asignar. */
export type PurchaseOrdersFromRequestInput = {
  orders: Array<{
    supplierId: string | null;
    supplierName: string;
    lineIds: string[];
  }>;
  expectedDate: string;
  notes: string;
  unitPrices: Record<string, number>;
  actor: string;
};

/** Faltante de una línea de surtimiento frente al stock y a las compras ya abiertas. */
export type RequisitionShortage = {
  lineId: string;
  productId: string | null;
  productSku: string;
  description: string;
  unit: string;
  pending: number;
  available: number;
  inPurchase: number;
  shortage: number;
};

function labelOf<T extends readonly { id: string; label: string }[]>(list: T, id: string) {
  return list.find((item) => item.id === id)?.label ?? id;
}

export const purchaseStatusLabel = (id: string) => labelOf(PURCHASE_REQUEST_STATUSES, id);
export const purchasePriorityLabel = (id: string) => labelOf(PURCHASE_PRIORITIES, id);

export function isPurchaseOpen(status: PurchaseRequestStatus) {
  return OPEN_PURCHASE_STATUSES.includes(status);
}

export function purchaseRequestUnits(request: Pick<PurchaseRequest, "lines">) {
  return request.lines.reduce((acc, line) => acc + line.quantity, 0);
}

export function purchaseRequestOrderIds(request: Pick<PurchaseRequest, "lines" | "purchaseOrderId">) {
  const ids = new Set(request.lines.map((line) => line.purchaseOrderId).filter((id): id is string => Boolean(id)));
  if (request.purchaseOrderId) ids.add(request.purchaseOrderId);
  return [...ids];
}
