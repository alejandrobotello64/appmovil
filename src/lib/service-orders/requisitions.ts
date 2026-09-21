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

export type ServiceOrderRequisitionLine = {
  id: string;
  requisitionId: string;
  serviceOrderLineId: string | null;
  productId: string;
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
  serviceOrderId: string;
  serviceOrderFolio: string;
  clientName: string;
  equipmentName: string;
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
  productId: string;
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

export type FulfillLineInput = {
  lineId: string;
  quantity: number;
};

export function requisitionStatusLabel(status: string) {
  return REQUISITION_STATUSES.find((s) => s.id === status)?.label ?? status;
}

export function requisitionLineStatusLabel(status: string) {
  return (
    REQUISITION_LINE_STATUSES.find((s) => s.id === status)?.label ?? status
  );
}
