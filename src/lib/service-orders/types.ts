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
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "preventivo", label: "Servicio preventivo" },
  { id: "correctivo", label: "Servicio correctivo" },
  { id: "instalacion", label: "Instalación" },
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

export const LIST_KINDS = [
  { id: "verificacion", label: "Checklist de verificación" },
  { id: "funcionamiento", label: "Pruebas de funcionamiento" },
] as const;

export type ListKind = (typeof LIST_KINDS)[number]["id"];

export const CHECKLIST_RESULTS = [
  { id: "pendiente", label: "Pendiente" },
  { id: "bien", label: "Bien" },
  { id: "danado", label: "Dañado" },
  { id: "no_tiene", label: "No tiene" },
] as const;

export const FUNCTION_TEST_RESULTS = [
  { id: "pendiente", label: "Pendiente" },
  { id: "pasa", label: "Pasa" },
  { id: "no_pasa", label: "No pasa" },
  { id: "no_aplica", label: "No aplica" },
] as const;

export type ChecklistResult =
  | (typeof CHECKLIST_RESULTS)[number]["id"]
  | (typeof FUNCTION_TEST_RESULTS)[number]["id"];

export const IMAGE_STAGES = [
  { id: "recepcion", label: "Recepción" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "servicio", label: "Servicio" },
  { id: "entrega", label: "Entrega" },
  { id: "calidad", label: "Calidad" },
  { id: "otro", label: "Otro" },
] as const;

export type ImageStage = (typeof IMAGE_STAGES)[number]["id"];

export const SERVICE_DOCUMENT_TYPES = [
  { id: "seguridad_electrica", label: "Examen de seguridad eléctrica" },
  { id: "otro", label: "Otro documento" },
] as const;

export type ServiceDocumentType = (typeof SERVICE_DOCUMENT_TYPES)[number]["id"];

export type ServiceOrderDocument = {
  id: string;
  serviceOrderId: string;
  docType: ServiceDocumentType;
  title: string;
  filePath: string;
  fileUrl: string;
  fileName: string;
  uploadedBy: string;
  createdAt: string;
};

export const EQUIPMENT_KINDS = [
  { id: "general", label: "General" },
  { id: "monitor", label: "Monitor" },
  { id: "ventilador", label: "Ventilador" },
  { id: "desfibrilador", label: "Desfibrilador" },
  { id: "bomba_infusion", label: "Bomba de infusión" },
  { id: "autoclave", label: "Autoclave" },
  { id: "ecg", label: "Electrocardiógrafo" },
  { id: "imagen", label: "Imagenología" },
] as const;

export type EquipmentKind = (typeof EQUIPMENT_KINDS)[number]["id"];

export const CALIBRATION_RESULTS = [
  { id: "pendiente", label: "Pendiente" },
  { id: "dentro", label: "Dentro de rango" },
  { id: "fuera", label: "Fuera de rango" },
  { id: "no_aplica", label: "N/A" },
] as const;

export type CalibrationResult = (typeof CALIBRATION_RESULTS)[number]["id"];

export const CALIBRATION_OVERALL = [
  { id: "pendiente", label: "Pendiente" },
  { id: "aprobada", label: "Aprobada" },
  { id: "parcial", label: "Parcial" },
  { id: "rechazada", label: "Rechazada" },
] as const;

export type CalibrationOverall = (typeof CALIBRATION_OVERALL)[number]["id"];

export type CalibrationTemplateParam = {
  id: string;
  templateId: string;
  label: string;
  unit: string;
  nominalValue: string;
  minValue: number | null;
  maxValue: number | null;
  sortOrder: number;
};

export type CalibrationTemplate = {
  id: string;
  code: string;
  name: string;
  equipmentKind: string;
  description: string;
  isActive: boolean;
  params: CalibrationTemplateParam[];
};

export type ServiceOrderCalibrationItem = {
  id: string;
  serviceOrderId: string;
  templateParamId: string | null;
  label: string;
  unit: string;
  nominalValue: string;
  measuredValue: string;
  minValue: number | null;
  maxValue: number | null;
  result: CalibrationResult;
  notes: string;
  sortOrder: number;
};

export type ChecklistTemplate = {
  id: string;
  code: string;
  name: string;
  equipmentKind: string;
  listKind: ListKind;
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
  listKind: ListKind;
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

export type ServiceOrderLinkedEquipment = {
  id: string;
  serviceOrderId: string;
  equipmentId: string | null;
  equipmentName: string;
  equipmentBrand: string;
  equipmentModel: string;
  equipmentSerial: string;
  equipmentLocation: string;
  relationLabel: string;
  notes: string;
  sortOrder: number;
};

export type ServiceOrderInstrument = {
  id: string;
  serviceOrderId: string;
  instrumentId: string | null;
  instrumentType: string;
  instrumentName: string;
  instrumentBrand: string;
  instrumentModel: string;
  instrumentSerial: string;
  usageNotes: string;
  sortOrder: number;
};

export const LINKED_EQUIPMENT_RELATIONS = [
  { id: "Equipo ligado", label: "Equipo ligado" },
  { id: "Monitor asociado", label: "Monitor asociado" },
  { id: "Máquina de anestesia", label: "Máquina de anestesia" },
  { id: "Ventilador asociado", label: "Ventilador asociado" },
  { id: "Bomba asociada", label: "Bomba asociada" },
  { id: "Accesorio / periférico", label: "Accesorio / periférico" },
  { id: "Otro", label: "Otro" },
] as const;

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
  functionTestTemplateId: string | null;
  receptionAt: string;
  promisedAt: string;
  deliveredAt: string;
  faultReported: string;
  generalObservations: string;
  diagnosisNotes: string;
  serviceNotes: string;
  underWarranty: boolean;
  authorized: boolean;
  closed: boolean;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  calibrationTemplateId: string | null;
  calibrationPerformedAt: string;
  calibrationInstrument: string;
  calibrationCertificate: string;
  calibrationOverall: CalibrationOverall;
  calibrationNotes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lines: ServiceOrderLine[];
  checklist: ServiceOrderChecklistItem[];
  calibration: ServiceOrderCalibrationItem[];
  linkedEquipment: ServiceOrderLinkedEquipment[];
  instruments: ServiceOrderInstrument[];
  documents: ServiceOrderDocument[];
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
  functionTestTemplateId?: string | null;
  receptionAt?: string;
  promisedAt?: string;
  deliveredAt?: string;
  faultReported?: string;
  generalObservations?: string;
  diagnosisNotes?: string;
  serviceNotes?: string;
  underWarranty?: boolean;
  authorized?: boolean;
  closed?: boolean;
  taxRate?: number;
  discount?: number;
  calibrationTemplateId?: string | null;
  calibrationPerformedAt?: string;
  calibrationInstrument?: string;
  calibrationCertificate?: string;
  calibrationOverall?: CalibrationOverall;
  calibrationNotes?: string;
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

export function listKindLabel(kind: string) {
  return LIST_KINDS.find((s) => s.id === kind)?.label ?? kind;
}

export function checklistResultLabel(result: string) {
  return (
    CHECKLIST_RESULTS.find((s) => s.id === result)?.label ??
    FUNCTION_TEST_RESULTS.find((s) => s.id === result)?.label ??
    result
  );
}

export function checklistItemsByKind(
  items: ServiceOrderChecklistItem[],
  kind: ListKind
) {
  return items.filter((item) => (item.listKind ?? "verificacion") === kind);
}

export function calibrationResultLabel(result: string) {
  return CALIBRATION_RESULTS.find((s) => s.id === result)?.label ?? result;
}

export function calibrationOverallLabel(result: string) {
  return CALIBRATION_OVERALL.find((s) => s.id === result)?.label ?? result;
}

export function equipmentKindLabel(kind: string) {
  return EQUIPMENT_KINDS.find((s) => s.id === kind)?.label ?? kind;
}

export function inferEquipmentKind(
  name: string,
  brand = "",
  model = ""
): EquipmentKind {
  const t = `${name} ${brand} ${model}`.toLowerCase();
  if (/ventil|respir/.test(t)) return "ventilador";
  if (/desfibr|dea/.test(t)) return "desfibrilador";
  if (/bomba|infus/.test(t)) return "bomba_infusion";
  if (/monitor|multipar|spo2/.test(t)) return "monitor";
  if (/autocl|esteril/.test(t)) return "autoclave";
  if (/ecg|electrocard/.test(t)) return "ecg";
  if (/rayos|ultrason|imagen|rx\b/.test(t)) return "imagen";
  return "general";
}

export function evaluateCalibrationResult(
  measuredValue: string,
  minValue: number | null,
  maxValue: number | null
): CalibrationResult {
  const raw = measuredValue.trim().replace(",", ".");
  if (!raw) return "pendiente";
  if (minValue == null && maxValue == null) return "pendiente";
  const num = Number(raw.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(num)) return "pendiente";
  if (minValue != null && num < minValue) return "fuera";
  if (maxValue != null && num > maxValue) return "fuera";
  return "dentro";
}

export function computeCalibrationOverall(
  items: Pick<ServiceOrderCalibrationItem, "result">[]
): CalibrationOverall {
  if (!items.length) return "pendiente";
  const relevant = items.filter((i) => i.result !== "no_aplica");
  if (!relevant.length) return "pendiente";
  if (relevant.every((i) => i.result === "pendiente")) return "pendiente";
  if (relevant.some((i) => i.result === "pendiente")) return "parcial";
  if (relevant.some((i) => i.result === "fuera")) return "rechazada";
  if (relevant.every((i) => i.result === "dentro")) return "aprobada";
  return "parcial";
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
