export const TENDER_PROCEDURES = [
  { id: "LP", label: "Licitación pública" },
  { id: "ITP", label: "Invitación a cuando menos tres" },
  { id: "AD", label: "Adjudicación directa" },
  { id: "otro", label: "Otro" },
] as const;

export const TENDER_CHARACTERS = [
  { id: "federal", label: "Federal" },
  { id: "estatal", label: "Estatal" },
  { id: "municipal", label: "Municipal" },
  { id: "otro", label: "Otro" },
] as const;

export const TENDER_STATUSES = [
  { id: "prospecto", label: "Prospecto" },
  { id: "analisis", label: "Análisis" },
  { id: "en_preparacion", label: "En preparación" },
  { id: "presentada", label: "Presentada" },
  { id: "en_evaluacion", label: "En evaluación" },
  { id: "ganada", label: "Ganada" },
  { id: "perdida", label: "Perdida" },
  { id: "desierta", label: "Desierta" },
  { id: "cancelada", label: "Cancelada" },
] as const;

export const TENDER_PIPELINE_STATUSES = [
  "prospecto",
  "analisis",
  "en_preparacion",
  "presentada",
  "en_evaluacion",
  "ganada",
] as const;

export const TENDER_DOC_TYPES = [
  { id: "bases", label: "Bases" },
  { id: "anexos", label: "Anexos" },
  { id: "propuesta_tecnica", label: "Propuesta técnica" },
  { id: "propuesta_economica", label: "Propuesta económica" },
  { id: "fianzas", label: "Fianzas" },
  { id: "fallo", label: "Fallo" },
  { id: "otro", label: "Otro" },
] as const;

export const TENDER_COMPLIANCE = [
  { id: "si", label: "Cumple" },
  { id: "parcial", label: "Parcial" },
  { id: "no", label: "No cumple" },
] as const;

export type TenderProcedure = (typeof TENDER_PROCEDURES)[number]["id"];
export type TenderCharacter = (typeof TENDER_CHARACTERS)[number]["id"];
export type TenderStatus = (typeof TENDER_STATUSES)[number]["id"];
export type TenderDocType = (typeof TENDER_DOC_TYPES)[number]["id"];
export type TenderCompliance = (typeof TENDER_COMPLIANCE)[number]["id"];

export type TenderLine = {
  id: string;
  tenderId: string;
  clavePartida: string;
  descripcion: string;
  productId: string | null;
  productSku: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  cumpleEspec: TenderCompliance;
  notaTecnica: string;
  sortOrder: number;
};

export type TenderEvent = {
  id: string;
  tenderId: string;
  eventType: string;
  message: string;
  createdBy: string;
  createdAt: string;
};

export type TenderDocument = {
  id: string;
  tenderId: string;
  docType: TenderDocType;
  name: string;
  filePath: string;
  fileUrl: string;
  notes: string;
  uploadedBy: string;
  createdAt: string;
};

export type Tender = {
  id: string;
  folioInterno: string;
  folioComprasmx: string;
  urlComprasmx: string;
  title: string;
  description: string;
  convocante: string;
  clientId: string | null;
  state: string;
  city: string;
  procedimiento: TenderProcedure;
  caracter: TenderCharacter;
  status: TenderStatus;
  publishedAt: string;
  juntaAclaraciones: string;
  limitePreguntas: string;
  limitePropuestas: string;
  falloAt: string;
  firmaAt: string;
  montoEstimado: number;
  montoOfertado: number;
  moneda: string;
  responsableNombre: string;
  probabilidad: number;
  notes: string;
  holdId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lines: TenderLine[];
  events: TenderEvent[];
  documents: TenderDocument[];
};

export type TenderLineInput = {
  clavePartida?: string;
  descripcion: string;
  productId?: string | null;
  quantity: number;
  unit?: string;
  unitPrice: number;
  cumpleEspec?: TenderCompliance;
  notaTecnica?: string;
};

export type TenderInput = {
  folioComprasmx: string;
  urlComprasmx?: string;
  title: string;
  description?: string;
  convocante?: string;
  clientId?: string | null;
  state?: string;
  city?: string;
  procedimiento?: TenderProcedure;
  caracter?: TenderCharacter;
  status?: TenderStatus;
  publishedAt?: string;
  juntaAclaraciones?: string;
  limitePreguntas?: string;
  limitePropuestas?: string;
  falloAt?: string;
  firmaAt?: string;
  montoEstimado?: number;
  montoOfertado?: number;
  responsableNombre?: string;
  probabilidad?: number;
  notes?: string;
  createdBy?: string;
  lines?: TenderLineInput[];
};

export function tenderStatusLabel(status: string) {
  return TENDER_STATUSES.find((item) => item.id === status)?.label ?? status;
}

export function tenderProcedureLabel(value: string) {
  return TENDER_PROCEDURES.find((item) => item.id === value)?.label ?? value;
}

export function tenderDocTypeLabel(value: string) {
  return TENDER_DOC_TYPES.find((item) => item.id === value)?.label ?? value;
}

export function lineImporte(line: Pick<TenderLine, "quantity" | "unitPrice">) {
  return Number(line.quantity) * Number(line.unitPrice);
}

export function tenderLinesTotal(lines: TenderLine[]) {
  return lines.reduce((sum, line) => sum + lineImporte(line), 0);
}
