export const SERVICE_ORDER_STATUSES = [
  { id: "borrador", label: "Borrador" },
  { id: "cotizacion", label: "Cotización" },
  { id: "recibido", label: "Recibido" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "en_proceso", label: "En proceso" },
  { id: "espera_refacciones", label: "Espera refacciones" },
  { id: "terminado", label: "Terminado" },
  { id: "entregado", label: "Entregado" },
  { id: "cancelado", label: "Cancelado" },
] as const;

export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number]["id"];

export const SERVICE_ORDER_KINDS = [
  { id: "cotizacion", label: "Cotización" },
  { id: "servicio", label: "Orden de servicio" },
] as const;

export type ServiceOrderKind = (typeof SERVICE_ORDER_KINDS)[number]["id"];

export const SERVICE_TYPES = [
  { id: "levantamiento", label: "Levantamiento" },
  { id: "instalacion", label: "Instalación" },
  { id: "mantenimiento", label: "Mantenimiento" },
  { id: "reparacion", label: "Reparación" },
  { id: "capacitacion", label: "Capacitación" },
  { id: "calibracion", label: "Calibración" },
  { id: "otro", label: "Otro" },
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number]["id"];

export const SERVICE_LINE_KINDS = [
  { id: "insumos", label: "Insumos" },
  { id: "refacciones", label: "Refacciones" },
  { id: "medicamentos", label: "Medicamentos" },
  { id: "accesorios", label: "Accesorios" },
  { id: "mano_obra", label: "Mano de obra" },
  { id: "otro", label: "Otro" },
] as const;

export type ServiceLineKind = (typeof SERVICE_LINE_KINDS)[number]["id"];

export const SERVICE_LINE_STATUSES = [
  { id: "pendiente", label: "Pendiente" },
  { id: "solicitado", label: "Solicitado" },
  { id: "disponible", label: "Disponible" },
  { id: "instalado", label: "Instalado" },
  { id: "no_aplica", label: "N/A" },
] as const;

export type ServiceLineStatus = (typeof SERVICE_LINE_STATUSES)[number]["id"];

export const CHECKLIST_RESULTS = [
  { id: "pendiente", label: "Pendiente" },
  { id: "bien", label: "Bien" },
  { id: "danado", label: "Dañado" },
  { id: "no_tiene", label: "No tiene" },
] as const;

export type ChecklistResult = (typeof CHECKLIST_RESULTS)[number]["id"];

export const IMAGE_STAGES = [
  { id: "recepcion", label: "Recepción" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "servicio", label: "Servicio" },
  { id: "entrega", label: "Entrega" },
  { id: "calidad", label: "Calidad" },
  { id: "otro", label: "Otro" },
] as const;

export type ImageStage = (typeof IMAGE_STAGES)[number]["id"];

export type ChecklistTemplate = {
  id: string;
  code: string;
  name: string;
  equipmentKind: string;
  description: string;
  isActive: boolean;
  points: ChecklistTemplatePoint[];
};

export type ChecklistTemplatePoint = {
  id: string;
  templateId: string;
  label: string;
  sortOrder: number;
};

export type ServiceOrderLine = {
  id: string;
  serviceOrderId: string;
  lineKind: ServiceLineKind;
  productId: string | null;
  productSku: string;
  productName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineStatus: ServiceLineStatus;
  sortOrder: number;
  notes: string;
};

export type ServiceOrderChecklistItem = {
  id: string;
  serviceOrderId: string;
  templatePointId: string | null;
  label: string;
  result: ChecklistResult;
  notes: string;
  sortOrder: number;
};

export type ServiceOrderImage = {
  id: string;
  serviceOrderId: string;
  stage: ImageStage;
  caption: string;
  filePath: string;
  fileUrl: string;
  uploadedBy: string;
  createdAt: string;
};

export type ServiceOrderEvent = {
  id: string;
  serviceOrderId: string;
  eventType: string;
  message: string;
  isInternal: boolean;
  createdBy: string;
  createdAt: string;
};

export type ServiceOrder = {
  id: string;
  folio: string;
  orderKind: ServiceOrderKind;
  status: ServiceOrderStatus;
  priority: "normal" | "urgente";
  serviceType: ServiceType;
  clientId: string | null;
  clientName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  equipmentId: string | null;
  equipmentName: string;
  equipmentBrand: string;
  equipmentModel: string;
  equipmentSerial: string;
  equipmentLocation: string;
  deliveredBy: string;
  technician: string;
  advisor: string;
  checklistTemplateId: string | null;
  receptionAt: string;
  promisedAt: string;
  deliveredAt: string;
  faultReported: string;
  generalObservations: string;
  diagnosisNotes: string;
  serviceNotes: string;
  authorized: boolean;
  closed: boolean;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lines: ServiceOrderLine[];
  checklist: ServiceOrderChecklistItem[];
  images: ServiceOrderImage[];
  events: ServiceOrderEvent[];
};

export type ServiceOrderLineInput = {
  lineKind: ServiceLineKind;
  productId?: string | null;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  lineStatus?: ServiceLineStatus;
  notes?: string;
};

export type ServiceOrderInput = {
  orderKind?: ServiceOrderKind;
  status?: ServiceOrderStatus;
  priority?: "normal" | "urgente";
  serviceType?: ServiceType;
  clientId?: string | null;
  clientName?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  equipmentId?: string | null;
  equipmentName?: string;
  equipmentBrand?: string;
  equipmentModel?: string;
  equipmentSerial?: string;
  equipmentLocation?: string;
  deliveredBy?: string;
  technician?: string;
  advisor?: string;
  checklistTemplateId?: string | null;
  receptionAt?: string;
  promisedAt?: string;
  deliveredAt?: string;
  faultReported?: string;
  generalObservations?: string;
  diagnosisNotes?: string;
  serviceNotes?: string;
  authorized?: boolean;
  closed?: boolean;
  taxRate?: number;
  discount?: number;
  createdBy?: string;
  lines?: ServiceOrderLineInput[];
};

export function serviceOrderStatusLabel(status: string) {
  return SERVICE_ORDER_STATUSES.find((s) => s.id === status)?.label ?? status;
}

export function serviceTypeLabel(type: string) {
  return SERVICE_TYPES.find((s) => s.id === type)?.label ?? type;
}

export function serviceLineKindLabel(kind: string) {
  return SERVICE_LINE_KINDS.find((s) => s.id === kind)?.label ?? kind;
}

export function checklistResultLabel(result: string) {
  return CHECKLIST_RESULTS.find((s) => s.id === result)?.label ?? result;
}

export function lineAmount(line: Pick<ServiceOrderLine, "quantity" | "unitPrice">) {
  return Number(line.quantity) * Number(line.unitPrice);
}

export function computeServiceTotals(
  lines: ServiceOrderLineInput[],
  discount = 0,
  taxRate = 16
) {
  const subtotal = Math.max(
    0,
    lines.reduce(
      (sum, line) => sum + Number(line.quantity) * Number(line.unitPrice),
      0
    ) - Number(discount || 0)
  );
  const taxAmount = subtotal * (Number(taxRate) / 100);
  return {
    subtotal: Number(subtotal.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    total: Number((subtotal + taxAmount).toFixed(2)),
  };
}

export function timeInStatus(updatedAt: string) {
  const start = new Date(updatedAt).getTime();
  if (!Number.isFinite(start)) return "—";
  const ms = Date.now() - start;
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${days}d ${hours}h ${mins}m`;
}
