export const TOOL_CATEGORIES = [
  { id: "desarmador", label: "Desarmadores" },
  { id: "llave", label: "Llaves" },
  { id: "pinzas", label: "Pinzas" },
  { id: "medicion", label: "Medición" },
  { id: "electrica", label: "Eléctricas" },
  { id: "corte", label: "Corte" },
  { id: "soldadura", label: "Soldadura" },
  { id: "kit", label: "Kits y estuches" },
  { id: "otro", label: "Otras" },
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number]["id"];

export const TOOL_CONDITIONS = [
  { id: "nuevo", label: "Nuevo" },
  { id: "bueno", label: "Bueno" },
  { id: "regular", label: "Regular" },
  { id: "danado", label: "Dañado" },
  { id: "baja", label: "De baja" },
] as const;

export type ToolCondition = (typeof TOOL_CONDITIONS)[number]["id"];

/** Estado con el que se recibe una herramienta de regreso. */
export const RETURN_CONDITIONS = [
  { id: "bueno", label: "Buen estado" },
  { id: "regular", label: "Con desgaste" },
  { id: "danado", label: "Dañada" },
  { id: "extraviada", label: "Extraviada" },
] as const;

export type ReturnCondition = (typeof RETURN_CONDITIONS)[number]["id"];

export const TOOL_REQUEST_STATUSES = [
  { id: "solicitada", label: "Solicitada" },
  { id: "entregada", label: "Entregada" },
  { id: "devolucion_parcial", label: "Devolución parcial" },
  { id: "devuelta", label: "Devuelta" },
  { id: "rechazada", label: "Rechazada" },
  { id: "cancelada", label: "Cancelada" },
] as const;

export type ToolRequestStatus = (typeof TOOL_REQUEST_STATUSES)[number]["id"];

/** Estatus en los que la herramienta está fuera del almacén. */
export const TOOL_OUT_STATUSES: ToolRequestStatus[] = ["entregada", "devolucion_parcial"];

export type Tool = {
  id: string;
  code: string;
  name: string;
  category: ToolCategory;
  brand: string;
  model: string;
  serialNumber: string;
  description: string;
  location: string;
  quantityTotal: number;
  condition: ToolCondition;
  isActive: boolean;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ToolWithAvailability = Tool & {
  quantityOut: number;
  quantityAvailable: number;
};

export type ToolInput = {
  code: string;
  name: string;
  category: ToolCategory;
  brand: string;
  model: string;
  serialNumber: string;
  description: string;
  location: string;
  quantityTotal: number;
  condition: ToolCondition;
  isActive: boolean;
  notes: string;
};

export type ToolRequestLine = {
  id: string;
  requestId: string;
  toolId: string | null;
  toolCode: string;
  toolName: string;
  toolBrand: string;
  toolModel: string;
  toolSerial: string;
  quantityRequested: number;
  quantityDelivered: number;
  quantityReturned: number;
  quantityLost: number;
  conditionOut: string;
  conditionIn: string;
  notes: string;
  sortOrder: number;
};

export type ToolRequestEvent = {
  id: string;
  requestId: string;
  eventType: string;
  message: string;
  details: ToolReturnDetails | Record<string, unknown>;
  actor: string;
  createdAt: string;
};

export type ToolReturnDetails = {
  receivedBy: string;
  returnedBy: string;
  notes: string;
  lines: {
    lineId: string;
    toolCode: string;
    toolName: string;
    quantity: number;
    condition: ReturnCondition;
  }[];
};

export type PersonSnapshot = {
  username: string;
  name: string;
  jobTitle: string;
  department: string;
  employeeNumber: string;
  phone: string;
};

export type ToolRequest = {
  id: string;
  folio: string;
  status: ToolRequestStatus;
  purpose: string;
  serviceOrderId: string | null;
  serviceOrderFolio: string;
  clientName: string;
  expectedReturnAt: string;
  notes: string;
  requester: PersonSnapshot;
  requestedAt: string;
  deliverer: PersonSnapshot;
  deliveredAt: string;
  deliveryNotes: string;
  returnedAt: string;
  closedBy: string;
  closedReason: string;
  createdAt: string;
  updatedAt: string;
  lines: ToolRequestLine[];
  events: ToolRequestEvent[];
};

export type CreateToolRequestInput = {
  purpose: string;
  serviceOrderId: string | null;
  expectedReturnAt: string;
  notes: string;
  requester: PersonSnapshot;
  lines: { toolId: string; quantity: number; notes?: string }[];
};

export type DeliverToolRequestInput = {
  deliverer: PersonSnapshot;
  notes: string;
  lines: { lineId: string; quantity: number; conditionOut: string }[];
};

export type ReturnToolRequestInput = {
  receivedBy: string;
  returnedBy: string;
  notes: string;
  lines: { lineId: string; quantity: number; condition: ReturnCondition }[];
};

function labelOf<T extends readonly { id: string; label: string }[]>(list: T, id: string) {
  return list.find((item) => item.id === id)?.label ?? id;
}

export const toolCategoryLabel = (id: string) => labelOf(TOOL_CATEGORIES, id);
export const toolConditionLabel = (id: string) => labelOf(TOOL_CONDITIONS, id);
export const returnConditionLabel = (id: string) => labelOf(RETURN_CONDITIONS, id);
export const toolRequestStatusLabel = (id: string) => labelOf(TOOL_REQUEST_STATUSES, id);

export function lineOutstanding(line: Pick<ToolRequestLine, "quantityDelivered" | "quantityReturned" | "quantityLost">) {
  return Math.max(0, line.quantityDelivered - line.quantityReturned - line.quantityLost);
}

export function requestOutstanding(request: Pick<ToolRequest, "lines">) {
  return request.lines.reduce((acc, line) => acc + lineOutstanding(line), 0);
}

export function todayKey(now: Date) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** La herramienta sigue fuera y ya pasó la fecha comprometida de devolución. */
export function isRequestOverdue(request: ToolRequest, now: Date) {
  if (!TOOL_OUT_STATUSES.includes(request.status)) return false;
  if (!request.expectedReturnAt) return false;
  return request.expectedReturnAt < todayKey(now) && requestOutstanding(request) > 0;
}

export function emptyPerson(): PersonSnapshot {
  return { username: "", name: "", jobTitle: "", department: "", employeeNumber: "", phone: "" };
}
