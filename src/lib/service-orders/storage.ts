import { supabase } from "@/lib/supabase/client";
import { normalizeRole } from "@/lib/auth/permissions";
import { listStaffMembers } from "@/lib/users/staff";
import {
  createClientService,
  setClientEquipmentStatus,
} from "@/lib/clients/storage";
import type { ClientServiceType } from "@/lib/clients/types";
import {
  computeServiceTotals,
  serviceOrderStatusLabel,
  type ChecklistResult,
  type ChecklistTemplate,
  type ChecklistTemplatePoint,
  type ImageStage,
  type ServiceOrder,
  type ServiceOrderChecklistItem,
  type ServiceOrderSummary,
  type ServiceOrderDocument,
  type ServiceOrderEvent,
  type ServiceOrderImage,
  type ServiceOrderInput,
  type ServiceOrderKind,
  type ServiceOrderLine,
  type ServiceOrderLineInput,
  type ServiceOrderLinkedEquipment,
  type ServiceOrderInstrument,
  type ServiceOrderStatus,
  type ServiceDocumentType,
  type ServiceLineKind,
  type ServiceLineStatus,
  type ServiceType,
  type CalibrationOverall,
  type ListKind,
  evaluateFunctionTestResult,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const MEDIA_BUCKET = "service-order-media";

const ORDER_LOCKED_MESSAGE =
  "Esta orden está cerrado y ya no se puede modificar.";
const TEMPLATE_LOCKED_MESSAGE =
  "Esta plantilla está cerrado y ya no se puede modificar.";

function isMissingColumnError(error: {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
} | null) {
  if (!error) return false;
  const code = String(error.code ?? "");
  const text = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    text.includes("does not exist") ||
    text.includes("schema cache") ||
    text.includes("could not find the")
  );
}

async function requireServiceAdvisor(actor: string, message?: string) {
  const staff = await listStaffMembers();
  const me = staff.find(
    (member) => member.username === actor || member.fullName === actor
  );
  const catalogHasAdvisor = staff.some((member) => member.isServiceAdvisor);
  const allowed =
    Boolean(me?.isServiceAdvisor) ||
    (!catalogHasAdvisor && normalizeRole(me?.role) === "administrador");
  if (!me || !allowed) {
    throw new Error(
      message ??
        "Solo el asesor de servicios puede candar o quitar el candado."
    );
  }
  return me;
}

async function ensureTemplateUnlocked(templateId: string) {
  const { data, error } = await db
    .from("service_checklist_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Plantilla no encontrada.");
  if (data.locked) throw new Error(TEMPLATE_LOCKED_MESSAGE);
}

async function ensureOrderUnlocked(orderId: string) {
  const { data, error } = await db
    .from("service_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Orden no encontrada.");
  if (data.locked) throw new Error(ORDER_LOCKED_MESSAGE);
}

const ACTIVE_REPAIR_STATUSES: ServiceOrderStatus[] = [
  "recibido",
  "diagnostico",
  "en_proceso",
  "espera_refacciones",
];

function toClientServiceType(serviceType: ServiceType): ClientServiceType {
  switch (serviceType) {
    case "instalacion":
      return "instalacion";
    case "preventivo":
      return "mantenimiento";
    case "correctivo":
      return "reparacion";
    case "diagnostico":
    default:
      return "otro";
  }
}

async function resolveRelatedFields(input: ServiceOrderInput) {
  const next = { ...input };

  if (input.clientId) {
    const { data: client, error } = await db
      .from("clients")
      .select("id, name, contact_name, phone, email")
      .eq("id", input.clientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (client) {
      next.clientName = String(client.name ?? next.clientName ?? "");
      if (!next.contactName?.trim()) {
        next.contactName = String(client.contact_name ?? "");
      }
      if (!next.contactPhone?.trim()) {
        next.contactPhone = String(client.phone ?? "");
      }
      if (!next.contactEmail?.trim()) {
        next.contactEmail = String(client.email ?? "");
      }
    }
  }

  if (input.equipmentId) {
    const { data: equipment, error } = await db
      .from("client_equipment")
      .select("id, client_id, name, brand, model, serial_number, location")
      .eq("id", input.equipmentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (equipment) {
      if (input.clientId && String(equipment.client_id) !== input.clientId) {
        throw new Error("El equipo no pertenece al cliente seleccionado.");
      }
      next.clientId = input.clientId || String(equipment.client_id);
      next.equipmentName = String(equipment.name ?? "");
      next.equipmentBrand = String(equipment.brand ?? "");
      next.equipmentModel = String(equipment.model ?? "");
      next.equipmentSerial = String(equipment.serial_number ?? "");
      next.equipmentLocation = String(equipment.location ?? "");
    }
  }

  return next;
}

async function syncLinkedEquipmentStatus(
  equipmentId: string | null | undefined,
  status: ServiceOrderStatus
) {
  if (!equipmentId) return;

  if (ACTIVE_REPAIR_STATUSES.includes(status)) {
    await setClientEquipmentStatus(equipmentId, "en_reparacion");
    return;
  }

  if (status === "terminado" || status === "entregado" || status === "cancelado") {
    const { data, error } = await db
      .from("service_orders")
      .select("id")
      .eq("equipment_id", equipmentId)
      .in("status", ACTIVE_REPAIR_STATUSES)
      .limit(1);
    if (error) throw new Error(error.message);
    if (!(data ?? []).length) {
      await setClientEquipmentStatus(equipmentId, "operativo");
    }
  }
}

async function mirrorToClientHistory(
  order: ServiceOrder,
  createdBy: string
) {
  if (!order.clientId) return;
  const { data: existing, error } = await db
    .from("client_services")
    .select("id")
    .eq("folio", order.folio)
    .limit(1);
  if (error) throw new Error(error.message);
  if ((existing ?? []).length) return;

  await createClientService({
    clientId: order.clientId,
    equipmentId: order.equipmentId,
    serviceType: toClientServiceType(order.serviceType),
    title: `${serviceOrderStatusLabel(order.status)} · ${order.equipmentName || order.serviceType}`,
    description: order.faultReported || order.diagnosisNotes || order.serviceNotes,
    performedAt: (order.deliveredAt || order.updatedAt || order.createdAt).slice(
      0,
      10
    ),
    technician: order.technician,
    folio: order.folio,
    notes: order.underWarranty ? "Cubierto por garantía" : "",
    createdBy,
  });
}

function dateOrEmpty(value: unknown) {
  if (!value) return "";
  return String(value).slice(0, 16).replace("T", " ").trim();
}

function isoOrNull(value?: string) {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T12:00:00.000Z`;
  return new Date(v).toISOString();
}

function optionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function mapTemplatePoint(row: Record<string, unknown>): ChecklistTemplatePoint {
  return {
    id: String(row.id),
    templateId: String(row.template_id),
    label: String(row.label ?? ""),
    unit: String(row.unit ?? ""),
    minValue: optionalNumber(row.min_value),
    maxValue: optionalNumber(row.max_value),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapLine(
  row: Record<string, unknown>,
  product?: { sku?: string; name?: string }
): ServiceOrderLine {
  return {
    id: String(row.id),
    serviceOrderId: String(row.service_order_id),
    lineKind: String(row.line_kind ?? "insumos") as ServiceLineKind,
    productId: row.product_id ? String(row.product_id) : null,
    productSku: String(product?.sku ?? ""),
    productName: String(product?.name ?? ""),
    description: String(row.description ?? ""),
    quantity: Number(row.quantity ?? 0),
    unit: String(row.unit ?? "pza"),
    unitPrice: Number(row.unit_price ?? 0),
    lineStatus: String(row.line_status ?? "pendiente") as ServiceLineStatus,
    sortOrder: Number(row.sort_order ?? 0),
    notes: String(row.notes ?? ""),
  };
}

function parseListKind(value: unknown): ListKind {
  return value === "funcionamiento" ? "funcionamiento" : "verificacion";
}

function mapChecklist(row: Record<string, unknown>): ServiceOrderChecklistItem {
  return {
    id: String(row.id),
    serviceOrderId: String(row.service_order_id),
    templatePointId: row.template_point_id ? String(row.template_point_id) : null,
    label: String(row.label ?? ""),
    listKind: parseListKind(row.list_kind),
    unit: String(row.unit ?? ""),
    minValue: optionalNumber(row.min_value),
    maxValue: optionalNumber(row.max_value),
    measuredValue: String(row.measured_value ?? ""),
    result: String(row.result ?? "pendiente") as ChecklistResult,
    notes: String(row.notes ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapImage(row: Record<string, unknown>): ServiceOrderImage {
  return {
    id: String(row.id),
    serviceOrderId: String(row.service_order_id),
    stage: String(row.stage ?? "recepcion") as ImageStage,
    caption: String(row.caption ?? ""),
    filePath: String(row.file_path ?? ""),
    fileUrl: String(row.file_url ?? ""),
    uploadedBy: String(row.uploaded_by ?? ""),
    createdAt: String(row.created_at),
  };
}

function mapDocument(row: Record<string, unknown>): ServiceOrderDocument {
  return {
    id: String(row.id),
    serviceOrderId: String(row.service_order_id),
    docType: String(row.doc_type ?? "seguridad_electrica") as ServiceDocumentType,
    title: String(row.title ?? ""),
    filePath: String(row.file_path ?? ""),
    fileUrl: String(row.file_url ?? ""),
    fileName: String(row.file_name ?? ""),
    uploadedBy: String(row.uploaded_by ?? ""),
    createdAt: String(row.created_at),
  };
}

function mapLinkedEquipment(
  row: Record<string, unknown>
): ServiceOrderLinkedEquipment {
  return {
    id: String(row.id),
    serviceOrderId: String(row.service_order_id),
    equipmentId: row.equipment_id ? String(row.equipment_id) : null,
    equipmentName: String(row.equipment_name ?? ""),
    equipmentBrand: String(row.equipment_brand ?? ""),
    equipmentModel: String(row.equipment_model ?? ""),
    equipmentSerial: String(row.equipment_serial ?? ""),
    equipmentLocation: String(row.equipment_location ?? ""),
    relationLabel: String(row.relation_label ?? "Equipo ligado"),
    notes: String(row.notes ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapOrderInstrument(
  row: Record<string, unknown>
): ServiceOrderInstrument {
  return {
    id: String(row.id),
    serviceOrderId: String(row.service_order_id),
    instrumentId: row.instrument_id ? String(row.instrument_id) : null,
    instrumentType: String(row.instrument_type ?? "simulador"),
    instrumentName: String(row.instrument_name ?? ""),
    instrumentBrand: String(row.instrument_brand ?? ""),
    instrumentModel: String(row.instrument_model ?? ""),
    instrumentSerial: String(row.instrument_serial ?? ""),
    usageNotes: String(row.usage_notes ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapEvent(row: Record<string, unknown>): ServiceOrderEvent {
  return {
    id: String(row.id),
    serviceOrderId: String(row.service_order_id),
    eventType: String(row.event_type ?? "nota"),
    message: String(row.message ?? ""),
    isInternal: Boolean(row.is_internal ?? true),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at),
  };
}

function mapOrder(
  row: Record<string, unknown>,
  lines: ServiceOrderLine[],
  checklist: ServiceOrderChecklistItem[],
  images: ServiceOrderImage[],
  events: ServiceOrderEvent[],
  documents: ServiceOrderDocument[] = [],
  linkedEquipment: ServiceOrderLinkedEquipment[] = [],
  instruments: ServiceOrderInstrument[] = []
): ServiceOrder {
  return {
    id: String(row.id),
    folio: String(row.folio),
    orderKind: String(row.order_kind ?? "servicio") as ServiceOrderKind,
    status: String(row.status ?? "borrador") as ServiceOrderStatus,
    priority: (String(row.priority ?? "normal") === "urgente"
      ? "urgente"
      : "normal") as "normal" | "urgente",
    serviceType: String(row.service_type ?? "diagnostico") as ServiceType,
    clientId: row.client_id ? String(row.client_id) : null,
    clientName: String(row.client_name ?? ""),
    contactName: String(row.contact_name ?? ""),
    contactPhone: String(row.contact_phone ?? ""),
    contactEmail: String(row.contact_email ?? ""),
    equipmentId: row.equipment_id ? String(row.equipment_id) : null,
    equipmentName: String(row.equipment_name ?? ""),
    equipmentBrand: String(row.equipment_brand ?? ""),
    equipmentModel: String(row.equipment_model ?? ""),
    equipmentSerial: String(row.equipment_serial ?? ""),
    equipmentLocation: String(row.equipment_location ?? ""),
    deliveredBy: String(row.delivered_by ?? ""),
    technician: String(row.technician ?? ""),
    advisor: String(row.advisor ?? ""),
    checklistTemplateId: row.checklist_template_id
      ? String(row.checklist_template_id)
      : null,
    functionTestTemplateId: row.function_test_template_id
      ? String(row.function_test_template_id)
      : null,
    receptionAt: dateOrEmpty(row.reception_at),
    promisedAt: dateOrEmpty(row.promised_at),
    nextServiceAt: dateOrEmpty(row.next_service_at).slice(0, 10),
    deliveredAt: dateOrEmpty(row.delivered_at),
    faultReported: String(row.fault_reported ?? ""),
    generalObservations: String(row.general_observations ?? ""),
    diagnosisNotes: String(row.diagnosis_notes ?? ""),
    serviceNotes: String(row.service_notes ?? ""),
    underWarranty: Boolean(row.under_warranty),
    authorized: Boolean(row.authorized),
    closed: Boolean(row.closed),
    locked: Boolean(row.locked),
    lockedAt: dateOrEmpty(row.locked_at),
    lockedBy: String(row.locked_by ?? ""),
    currency: String(row.currency ?? "MXN"),
    subtotal: Number(row.subtotal ?? 0),
    taxRate: Number(row.tax_rate ?? 16),
    taxAmount: Number(row.tax_amount ?? 0),
    discount: Number(row.discount ?? 0),
    total: Number(row.total ?? 0),
    calibrationTemplateId: row.calibration_template_id
      ? String(row.calibration_template_id)
      : null,
    calibrationPerformedAt: dateOrEmpty(row.calibration_performed_at),
    calibrationInstrument: String(row.calibration_instrument ?? ""),
    calibrationCertificate: String(row.calibration_certificate ?? ""),
    calibrationOverall: String(
      row.calibration_overall ?? "pendiente"
    ) as CalibrationOverall,
    calibrationNotes: String(row.calibration_notes ?? ""),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lines,
    checklist,
    calibration: [],
    linkedEquipment,
    instruments,
    documents,
    images,
    events,
  };
}

async function nextFolio(kind: ServiceOrderKind) {
  const year = new Date().getFullYear();
  const prefix = kind === "cotizacion" ? `COT-OS-${year}-` : `OS-${year}-`;
  const { data, error } = await db
    .from("service_orders")
    .select("folio")
    .like("folio", `${prefix}%`)
    .order("folio", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = data?.[0]?.folio as string | undefined;
  const seq = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(4, "0")}`;
}

async function addEvent(
  orderId: string,
  message: string,
  createdBy: string,
  eventType = "nota",
  isInternal = true
) {
  const { error } = await db.from("service_order_events").insert({
    service_order_id: orderId,
    event_type: eventType,
    message,
    is_internal: isInternal,
    created_by: createdBy,
  });
  if (error) throw new Error(error.message);
}

function linePayload(
  orderId: string,
  line: ServiceOrderLineInput,
  index: number
) {
  return {
    service_order_id: orderId,
    line_kind: line.lineKind,
    product_id: line.productId || null,
    description: line.description.trim(),
    quantity: Number(line.quantity),
    unit: (line.unit ?? "pza").trim() || "pza",
    unit_price: Number(line.unitPrice),
    line_status: line.lineStatus ?? "pendiente",
    sort_order: index,
    notes: (line.notes ?? "").trim(),
  };
}

function payloadFromInput(input: ServiceOrderInput, lines: ServiceOrderLineInput[]) {
  const totals = computeServiceTotals(
    lines,
    input.discount ?? 0,
    input.taxRate ?? 16
  );
  return {
    order_kind: input.orderKind ?? "servicio",
    status: input.status ?? "borrador",
    priority: input.priority ?? "normal",
    service_type: input.serviceType ?? "diagnostico",
    client_id: input.clientId || null,
    client_name: (input.clientName ?? "").trim(),
    contact_name: (input.contactName ?? "").trim(),
    contact_phone: (input.contactPhone ?? "").trim(),
    contact_email: (input.contactEmail ?? "").trim(),
    equipment_id: input.equipmentId || null,
    equipment_name: (input.equipmentName ?? "").trim(),
    equipment_brand: (input.equipmentBrand ?? "").trim(),
    equipment_model: (input.equipmentModel ?? "").trim(),
    equipment_serial: (input.equipmentSerial ?? "").trim(),
    equipment_location: (input.equipmentLocation ?? "").trim(),
    delivered_by: (input.deliveredBy ?? "").trim(),
    technician: (input.technician ?? "").trim(),
    advisor: (input.advisor ?? "").trim(),
    checklist_template_id: input.checklistTemplateId || null,
    function_test_template_id: input.functionTestTemplateId || null,
    reception_at: isoOrNull(input.receptionAt),
    promised_at: isoOrNull(input.promisedAt),
    next_service_at: input.nextServiceAt?.trim().slice(0, 10) || null,
    delivered_at: isoOrNull(input.deliveredAt),
    fault_reported: (input.faultReported ?? "").trim(),
    general_observations: (input.generalObservations ?? "").trim(),
    diagnosis_notes: (input.diagnosisNotes ?? "").trim(),
    service_notes: (input.serviceNotes ?? "").trim(),
    under_warranty: Boolean(input.underWarranty),
    authorized: Boolean(input.authorized),
    closed: Boolean(input.closed),
    tax_rate: input.taxRate ?? 16,
    discount: input.discount ?? 0,
    subtotal: totals.subtotal,
    tax_amount: totals.taxAmount,
    total: totals.total,
  };
}

function withoutNextServiceColumn<T extends Record<string, unknown>>(payload: T) {
  const next = { ...payload };
  delete next.next_service_at;
  return next;
}

export type ServiceOrderCalendarHit = {
  id: string;
  date: string;
  folio: string;
  clientName: string;
  equipmentName: string;
  technician: string;
  status: ServiceOrderStatus;
};

export async function listServiceOrderCalendarItems(): Promise<
  ServiceOrderCalendarHit[]
> {
  const { data, error } = await db
    .from("service_orders")
    .select(
      "id, folio, next_service_at, client_name, equipment_name, technician, status"
    )
    .not("next_service_at", "is", null)
    .neq("status", "cancelado");
  if (error) {
    if (isMissingColumnError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? [])
    .map((row: Record<string, unknown>) => ({
      id: String(row.id),
      date: dateOrEmpty(row.next_service_at).slice(0, 10),
      folio: String(row.folio ?? ""),
      clientName: String(row.client_name ?? ""),
      equipmentName: String(row.equipment_name ?? ""),
      technician: String(row.technician ?? ""),
      status: String(row.status ?? "borrador") as ServiceOrderStatus,
    }))
    .filter((row: ServiceOrderCalendarHit) => Boolean(row.date));
}

export async function getChecklistTemplates(options?: {
  includeInactive?: boolean;
}): Promise<ChecklistTemplate[]> {
  let query = db
    .from("service_checklist_templates")
    .select("*")
    .order("name", { ascending: true });
  if (!options?.includeInactive) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const templates = data ?? [];
  if (!templates.length) return [];

  const ids = templates.map((row: Record<string, unknown>) => row.id);
  const { data: points, error: pointsError } = await db
    .from("service_checklist_template_points")
    .select("*")
    .in("template_id", ids)
    .order("sort_order", { ascending: true });
  if (pointsError) throw new Error(pointsError.message);

  const byTpl = new Map<string, ChecklistTemplatePoint[]>();
  for (const row of points ?? []) {
    const tid = String(row.template_id);
    const list = byTpl.get(tid) ?? [];
    list.push(mapTemplatePoint(row));
    byTpl.set(tid, list);
  }

  return templates.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    equipmentKind: String(row.equipment_kind ?? "general"),
    listKind: parseListKind(row.list_kind),
    description: String(row.description ?? ""),
    isActive: Boolean(row.is_active),
    locked: Boolean(row.locked),
    lockedAt: dateOrEmpty(row.locked_at),
    lockedBy: String(row.locked_by ?? ""),
    points: byTpl.get(String(row.id)) ?? [],
  }));
}

function slugCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

export async function createChecklistTemplate(input: {
  name: string;
  equipmentKind?: string;
  listKind?: ListKind;
  description?: string;
  points?: string[];
}): Promise<ChecklistTemplate> {
  const name = input.name.trim();
  if (!name) throw new Error("El nombre de la plantilla es obligatorio.");

  const kind = (input.equipmentKind ?? "general").trim() || "general";
  const listKind: ListKind =
    input.listKind === "funcionamiento" ? "funcionamiento" : "verificacion";
  const base = slugCode(name) || "plantilla";
  let code = base;
  let attempt = 1;
  while (attempt < 20) {
    const { data: existing } = await db
      .from("service_checklist_templates")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!existing) break;
    attempt += 1;
    code = `${base}_${attempt}`;
  }

  const { data, error } = await db
    .from("service_checklist_templates")
    .insert({
      code,
      name,
      equipment_kind: kind,
      list_kind: listKind,
      description: (input.description ?? "").trim(),
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const templateId = String(data.id);
  const points = (input.points ?? [])
    .map((p) => p.trim())
    .filter(Boolean);
  if (points.length) {
    const { error: pointsError } = await db
      .from("service_checklist_template_points")
      .insert(
        points.map((label, index) => ({
          template_id: templateId,
          label,
          sort_order: index,
        }))
      );
    if (pointsError) throw new Error(pointsError.message);
  }

  const list = await getChecklistTemplates({ includeInactive: true });
  const created = list.find((t) => t.id === templateId);
  if (!created) throw new Error("No se pudo recargar la plantilla.");
  return created;
}

export async function updateChecklistTemplateMeta(
  templateId: string,
  patch: { name?: string; description?: string; isActive?: boolean }
): Promise<void> {
  await ensureTemplateUnlocked(templateId);
  const payload: Record<string, unknown> = {};
  if (patch.name != null) payload.name = patch.name.trim();
  if (patch.description != null) payload.description = patch.description.trim();
  if (patch.isActive != null) payload.is_active = patch.isActive;
  if (!Object.keys(payload).length) return;
  const { error } = await db
    .from("service_checklist_templates")
    .update(payload)
    .eq("id", templateId);
  if (error) throw new Error(error.message);
}

function intervalPayload(input: {
  unit?: string;
  minValue?: number | null;
  maxValue?: number | null;
}) {
  const minValue = input.minValue ?? null;
  const maxValue = input.maxValue ?? null;
  if (minValue != null && maxValue != null && minValue > maxValue) {
    throw new Error("El mínimo del intervalo no puede ser mayor que el máximo.");
  }
  const payload: Record<string, unknown> = {};
  const unit = (input.unit ?? "").trim();
  if (unit) payload.unit = unit;
  if (minValue != null) payload.min_value = minValue;
  if (maxValue != null) payload.max_value = maxValue;
  return payload;
}

const INTERVAL_COLUMNS = ["unit", "min_value", "max_value"] as const;

function withoutIntervalColumns(row: Record<string, unknown>) {
  const next = { ...row };
  for (const key of INTERVAL_COLUMNS) {
    delete next[key];
  }
  return next;
}

export async function addChecklistTemplatePoint(
  templateId: string,
  input:
    | string
    | {
        label: string;
        unit?: string;
        minValue?: number | null;
        maxValue?: number | null;
      }
): Promise<void> {
  await ensureTemplateUnlocked(templateId);
  const payload = typeof input === "string" ? { label: input } : input;
  const trimmed = payload.label.trim();
  if (!trimmed) throw new Error("El punto no puede estar vacío.");
  const { data: existing, error: countError } = await db
    .from("service_checklist_template_points")
    .select("sort_order")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (countError) throw new Error(countError.message);
  const nextOrder = Number(existing?.[0]?.sort_order ?? 0) + 1;
  const row = {
    template_id: templateId,
    label: trimmed,
    sort_order: nextOrder,
    ...intervalPayload(payload),
  };
  const { error } = await db.from("service_checklist_template_points").insert(row);
  if (error) {
    if (!isMissingColumnError(error)) throw new Error(error.message);
    const { error: retryError } = await db
      .from("service_checklist_template_points")
      .insert(withoutIntervalColumns(row));
    if (retryError) throw new Error(retryError.message);
  }
}

export async function updateChecklistTemplatePoint(
  pointId: string,
  patch: {
    label?: string;
    unit?: string;
    minValue?: number | null;
    maxValue?: number | null;
  }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.label != null) {
    const trimmed = patch.label.trim();
    if (!trimmed) throw new Error("El punto no puede estar vacío.");
    payload.label = trimmed;
  }
  if (patch.unit != null || patch.minValue !== undefined || patch.maxValue !== undefined) {
    intervalPayload(patch);
    if (patch.unit != null) payload.unit = patch.unit.trim();
    if (patch.minValue !== undefined) payload.min_value = patch.minValue ?? null;
    if (patch.maxValue !== undefined) payload.max_value = patch.maxValue ?? null;
  }
  if (!Object.keys(payload).length) return;
  const { data: point, error: fetchError } = await db
    .from("service_checklist_template_points")
    .select("template_id")
    .eq("id", pointId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!point) throw new Error("Punto no encontrado.");
  await ensureTemplateUnlocked(String(point.template_id));
  const { error } = await db
    .from("service_checklist_template_points")
    .update(payload)
    .eq("id", pointId);
  if (error) {
    if (!isMissingColumnError(error)) throw new Error(error.message);
    const stripped = withoutIntervalColumns(payload);
    if (!Object.keys(stripped).length) return;
    const { error: retryError } = await db
      .from("service_checklist_template_points")
      .update(stripped)
      .eq("id", pointId);
    if (retryError) throw new Error(retryError.message);
  }
}

export async function deleteChecklistTemplatePoint(
  pointId: string
): Promise<void> {
  const { data: point, error: fetchError } = await db
    .from("service_checklist_template_points")
    .select("template_id")
    .eq("id", pointId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!point) throw new Error("Punto no encontrado.");
  await ensureTemplateUnlocked(String(point.template_id));
  const { error } = await db
    .from("service_checklist_template_points")
    .delete()
    .eq("id", pointId);
  if (error) throw new Error(error.message);
}

export async function deleteChecklistTemplate(
  templateId: string,
  actor: string
): Promise<void> {
  await requireServiceAdvisor(
    actor,
    "Solo el asesor de servicios puede eliminar plantillas."
  );
  const { error: pointsError } = await db
    .from("service_checklist_template_points")
    .delete()
    .eq("template_id", templateId);
  if (pointsError) throw new Error(pointsError.message);
  const { error } = await db
    .from("service_checklist_templates")
    .delete()
    .eq("id", templateId);
  if (error) throw new Error(error.message);
}

export async function setChecklistTemplateLock(
  templateId: string,
  locked: boolean,
  actor: string
): Promise<void> {
  const me = await requireServiceAdvisor(
    actor,
    "Solo el asesor de servicios puede candar o quitar el candado de la plantilla."
  );
  const { error } = await db
    .from("service_checklist_templates")
    .update({
      locked,
      locked_at: locked ? new Date().toISOString() : null,
      locked_by: locked ? me.fullName : "",
    })
    .eq("id", templateId);
  if (error) throw new Error(error.message);
}

async function hydrateOrders(
  orderRows: Record<string, unknown>[]
): Promise<ServiceOrder[]> {
  if (!orderRows.length) return [];
  const ids = orderRows.map((row) => row.id);

  const [linesRes, checkRes, imagesRes, eventsRes, docsRes, linkedRes, instRes] =
    await Promise.all([
    db
      .from("service_order_lines")
      .select("*, product:inventory_items(sku, name)")
      .in("service_order_id", ids)
      .order("sort_order", { ascending: true }),
    db
      .from("service_order_checklist")
      .select("*")
      .in("service_order_id", ids)
      .order("sort_order", { ascending: true }),
    db
      .from("service_order_images")
      .select("*")
      .in("service_order_id", ids)
      .order("created_at", { ascending: false }),
    db
      .from("service_order_events")
      .select("*")
      .in("service_order_id", ids)
      .order("created_at", { ascending: false }),
    db
      .from("service_order_documents")
      .select("*")
      .in("service_order_id", ids)
      .order("created_at", { ascending: false }),
    db
      .from("service_order_linked_equipment")
      .select("*")
      .in("service_order_id", ids)
      .order("sort_order", { ascending: true }),
    db
      .from("service_order_instruments")
      .select("*")
      .in("service_order_id", ids)
      .order("sort_order", { ascending: true }),
  ]);

  if (linesRes.error) throw new Error(linesRes.error.message);
  if (checkRes.error) throw new Error(checkRes.error.message);
  if (imagesRes.error) throw new Error(imagesRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);
  if (docsRes.error) throw new Error(docsRes.error.message);
  if (linkedRes.error) throw new Error(linkedRes.error.message);
  if (instRes.error) throw new Error(instRes.error.message);

  const linesBy = new Map<string, ServiceOrderLine[]>();
  for (const row of linesRes.data ?? []) {
    const oid = String(row.service_order_id);
    const list = linesBy.get(oid) ?? [];
    list.push(
      mapLine(row, {
        sku: row.product?.sku,
        name: row.product?.name,
      })
    );
    linesBy.set(oid, list);
  }

  const checkBy = new Map<string, ServiceOrderChecklistItem[]>();
  for (const row of checkRes.data ?? []) {
    const oid = String(row.service_order_id);
    const list = checkBy.get(oid) ?? [];
    list.push(mapChecklist(row));
    checkBy.set(oid, list);
  }

  const imagesBy = new Map<string, ServiceOrderImage[]>();
  for (const row of imagesRes.data ?? []) {
    const oid = String(row.service_order_id);
    const list = imagesBy.get(oid) ?? [];
    list.push(mapImage(row));
    imagesBy.set(oid, list);
  }

  const eventsBy = new Map<string, ServiceOrderEvent[]>();
  for (const row of eventsRes.data ?? []) {
    const oid = String(row.service_order_id);
    const list = eventsBy.get(oid) ?? [];
    list.push(mapEvent(row));
    eventsBy.set(oid, list);
  }

  const docsBy = new Map<string, ServiceOrderDocument[]>();
  for (const row of docsRes.data ?? []) {
    const oid = String(row.service_order_id);
    const list = docsBy.get(oid) ?? [];
    list.push(mapDocument(row));
    docsBy.set(oid, list);
  }

  const linkedBy = new Map<string, ServiceOrderLinkedEquipment[]>();
  for (const row of linkedRes.data ?? []) {
    const oid = String(row.service_order_id);
    const list = linkedBy.get(oid) ?? [];
    list.push(mapLinkedEquipment(row));
    linkedBy.set(oid, list);
  }

  const instrumentsBy = new Map<string, ServiceOrderInstrument[]>();
  for (const row of instRes.data ?? []) {
    const oid = String(row.service_order_id);
    const list = instrumentsBy.get(oid) ?? [];
    list.push(mapOrderInstrument(row));
    instrumentsBy.set(oid, list);
  }

  return orderRows.map((row) => {
    const id = String(row.id);
    return mapOrder(
      row,
      linesBy.get(id) ?? [],
      checkBy.get(id) ?? [],
      imagesBy.get(id) ?? [],
      eventsBy.get(id) ?? [],
      docsBy.get(id) ?? [],
      linkedBy.get(id) ?? [],
      instrumentsBy.get(id) ?? []
    );
  });
}

export async function getServiceOrders(): Promise<ServiceOrder[]> {
  const { data, error } = await db
    .from("service_orders")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return hydrateOrders(data ?? []);
}

export async function listServiceOrderSummaries(): Promise<ServiceOrderSummary[]> {
  const [ordersRes, linkedRes] = await Promise.all([
    db
      .from("service_orders")
      .select(
        "id, folio, status, service_type, technician, reception_at, created_at, client_id, client_name, equipment_id, equipment_name, equipment_serial"
      )
      .order("created_at", { ascending: false }),
    db
      .from("service_order_linked_equipment")
      .select("service_order_id, equipment_id"),
  ]);
  if (ordersRes.error) throw new Error(ordersRes.error.message);
  if (linkedRes.error) throw new Error(linkedRes.error.message);

  const linkedBy = new Map<string, string[]>();
  for (const row of linkedRes.data ?? []) {
    const orderId = String(row.service_order_id);
    const equipmentId = row.equipment_id ? String(row.equipment_id) : "";
    if (!equipmentId) continue;
    const list = linkedBy.get(orderId) ?? [];
    list.push(equipmentId);
    linkedBy.set(orderId, list);
  }

  return (ordersRes.data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    folio: String(row.folio ?? ""),
    status: String(row.status ?? "borrador") as ServiceOrderSummary["status"],
    serviceType: String(row.service_type ?? "diagnostico") as ServiceOrderSummary["serviceType"],
    technician: String(row.technician ?? ""),
    receptionAt: dateOrEmpty(row.reception_at),
    createdAt: String(row.created_at ?? ""),
    clientId: row.client_id ? String(row.client_id) : null,
    clientName: String(row.client_name ?? ""),
    equipmentId: row.equipment_id ? String(row.equipment_id) : null,
    equipmentName: String(row.equipment_name ?? ""),
    equipmentSerial: String(row.equipment_serial ?? ""),
    linkedEquipmentIds: linkedBy.get(String(row.id)) ?? [],
  }));
}

export async function getServiceOrder(id: string): Promise<ServiceOrder | null> {
  const { data, error } = await db
    .from("service_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [order] = await hydrateOrders([data]);
  return order ?? null;
}

export async function createServiceOrder(
  input: ServiceOrderInput
): Promise<ServiceOrder> {
  const createdBy = (input.createdBy ?? "").trim();
  const kind = input.orderKind ?? "servicio";
  const folio = await nextFolio(kind);
  const lines = input.lines ?? [];

  const insertPayload = {
    folio,
    ...payloadFromInput(input, lines),
    created_by: createdBy,
    reception_at:
      isoOrNull(input.receptionAt) ??
      (kind === "servicio" ? new Date().toISOString() : null),
  };

  let { data, error } = await db
    .from("service_orders")
    .insert(insertPayload)
    .select("*")
    .single();
  if (error && isMissingColumnError(error)) {
    const retry = await db
      .from("service_orders")
      .insert(withoutNextServiceColumn(insertPayload))
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No se pudo crear la orden.");

  if (lines.length) {
    const { error: linesError } = await db
      .from("service_order_lines")
      .insert(lines.map((line, index) => linePayload(data.id, line, index)));
    if (linesError) throw new Error(linesError.message);
  }

  if (input.checklistTemplateId) {
    await applyChecklistTemplate(data.id, input.checklistTemplateId, createdBy);
  }
  if (input.functionTestTemplateId) {
    await applyChecklistTemplate(
      data.id,
      input.functionTestTemplateId,
      createdBy
    );
  }

  await addEvent(
    data.id,
    `Orden creada · ${folio}`,
    createdBy,
    "creacion"
  );
  if (input.nextServiceAt?.trim()) {
    await addEvent(
      data.id,
      `Próximo servicio agendado: ${input.nextServiceAt.trim().slice(0, 10)}`,
      createdBy,
      "nota"
    );
  }

  const created = await getServiceOrder(data.id);
  if (!created) throw new Error("No se pudo recargar la orden.");
  return created;
}

export async function updateServiceOrder(
  id: string,
  input: ServiceOrderInput
): Promise<ServiceOrder> {
  await ensureOrderUnlocked(id);
  const current = await getServiceOrder(id);
  if (!current) throw new Error("Orden no encontrada.");

  const lines = input.lines ?? current.lines.map((line) => ({
    lineKind: line.lineKind,
    productId: line.productId,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unitPrice,
    lineStatus: line.lineStatus,
    notes: line.notes,
  }));

  const updatePayload = {
    ...payloadFromInput(
      { ...input, orderKind: input.orderKind ?? current.orderKind },
      lines
    ),
    updated_at: new Date().toISOString(),
  };
  let { error } = await db
    .from("service_orders")
    .update(updatePayload)
    .eq("id", id);
  if (error && isMissingColumnError(error)) {
    const retry = await db
      .from("service_orders")
      .update(withoutNextServiceColumn(updatePayload))
      .eq("id", id);
    error = retry.error;
  }
  if (error) throw new Error(error.message);

  if (input.lines) {
    await replaceServiceOrderLines(id, input.lines);
  }

  if (
    input.checklistTemplateId &&
    input.checklistTemplateId !== current.checklistTemplateId
  ) {
    await applyChecklistTemplate(
      id,
      input.checklistTemplateId,
      input.createdBy ?? ""
    );
  }

  if (
    input.functionTestTemplateId &&
    input.functionTestTemplateId !== current.functionTestTemplateId
  ) {
    await applyChecklistTemplate(
      id,
      input.functionTestTemplateId,
      input.createdBy ?? ""
    );
  }

  if (input.status && input.status !== current.status) {
    await addEvent(
      id,
      `Estatus: ${serviceOrderStatusLabel(current.status)} → ${serviceOrderStatusLabel(input.status)}`,
      input.createdBy ?? "",
      "estatus"
    );
  }

  const nextDate = (input.nextServiceAt ?? "").trim().slice(0, 10);
  const currentDate = (current.nextServiceAt ?? "").slice(0, 10);
  if (nextDate !== currentDate) {
    await addEvent(
      id,
      nextDate
        ? `Próximo servicio agendado: ${nextDate}`
        : "Se quitó la fecha de próximo servicio",
      input.createdBy ?? "",
      "nota"
    );
  }

  const updated = await getServiceOrder(id);
  if (!updated) throw new Error("No se pudo recargar la orden.");
  return updated;
}

export async function setServiceOrderStatus(
  id: string,
  status: ServiceOrderStatus,
  createdBy: string
): Promise<void> {
  await ensureOrderUnlocked(id);
  const current = await getServiceOrder(id);
  if (!current) throw new Error("Orden no encontrada.");

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "entregado") {
    patch.delivered_at = new Date().toISOString();
  }

  const { error } = await db.from("service_orders").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  await addEvent(
    id,
    `Estatus: ${serviceOrderStatusLabel(current.status)} → ${serviceOrderStatusLabel(status)}`,
    createdBy,
    "estatus"
  );
}

export async function setServiceOrderLock(
  orderId: string,
  locked: boolean,
  actor: string
): Promise<void> {
  const me = await requireServiceAdvisor(
    actor,
    "Solo el asesor de servicios puede candar o quitar el candado de la orden."
  );

  const { error } = await db
    .from("service_orders")
    .update({
      locked,
      locked_at: locked ? new Date().toISOString() : null,
      locked_by: locked ? me.fullName : "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) throw new Error(error.message);

  await addEvent(
    orderId,
    locked
      ? `Orden cerrado por el asesor ${me.fullName}`
      : `Candado retirado por el asesor ${me.fullName}`,
    actor,
    "candado"
  );
}

export async function deleteServiceOrder(id: string): Promise<void> {
  await ensureOrderUnlocked(id);
  const order = await getServiceOrder(id);
  if (order) {
    const paths = [
      ...order.images.map((img) => img.filePath),
      ...order.documents.map((doc) => doc.filePath),
    ].filter(Boolean);
    if (paths.length) {
      await supabase.storage.from(MEDIA_BUCKET).remove(paths);
    }
  }
  const { error } = await db.from("service_orders").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function replaceServiceOrderLines(
  orderId: string,
  lines: ServiceOrderLineInput[]
): Promise<void> {
  await ensureOrderUnlocked(orderId);
  const { error: delError } = await db
    .from("service_order_lines")
    .delete()
    .eq("service_order_id", orderId);
  if (delError) throw new Error(delError.message);

  if (lines.length) {
    const { error } = await db
      .from("service_order_lines")
      .insert(lines.map((line, index) => linePayload(orderId, line, index)));
    if (error) throw new Error(error.message);
  }

  const totals = computeServiceTotals(lines);
  await db
    .from("service_orders")
    .update({
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      total: totals.total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
}

export async function applyChecklistTemplate(
  orderId: string,
  templateId: string,
  createdBy: string
): Promise<void> {
  await ensureOrderUnlocked(orderId);
  const { data: template, error: templateError } = await db
    .from("service_checklist_templates")
    .select("id, name, list_kind")
    .eq("id", templateId)
    .maybeSingle();
  if (templateError) throw new Error(templateError.message);
  if (!template) throw new Error("Plantilla no encontrada.");

  const listKind = parseListKind(template.list_kind);

  const { data: points, error } = await db
    .from("service_checklist_template_points")
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);

  const { error: deleteError } = await db
    .from("service_order_checklist")
    .delete()
    .eq("service_order_id", orderId)
    .eq("list_kind", listKind);
  if (deleteError) throw new Error(deleteError.message);

  if (points?.length) {
    const rows = points.map((row: Record<string, unknown>, index: number) => ({
      service_order_id: orderId,
      template_point_id: row.id,
      label: row.label,
      list_kind: listKind,
      unit: String(row.unit ?? ""),
      min_value: optionalNumber(row.min_value),
      max_value: optionalNumber(row.max_value),
      measured_value: "",
      result: "pendiente",
      sort_order: Number(row.sort_order ?? index),
    }));
    const { error: insertError } = await db
      .from("service_order_checklist")
      .insert(rows);
    if (insertError) {
      if (!isMissingColumnError(insertError)) throw new Error(insertError.message);
      const { error: retryError } = await db
        .from("service_order_checklist")
        .insert(rows.map((row: Record<string, unknown>) => withoutIntervalColumns(row)));
      if (retryError) throw new Error(retryError.message);
    }
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (listKind === "funcionamiento") {
    patch.function_test_template_id = templateId;
  } else {
    patch.checklist_template_id = templateId;
  }

  const { error: updateError } = await db
    .from("service_orders")
    .update(patch)
    .eq("id", orderId);
  if (updateError) throw new Error(updateError.message);

  const eventLabel =
    listKind === "funcionamiento"
      ? `Plantilla de pruebas de funcionamiento aplicada: ${String(template.name)}`
      : `Plantilla de checklist de verificación aplicada: ${String(template.name)}`;
  await addEvent(orderId, eventLabel, createdBy, "checklist");
}

export async function updateChecklistItem(
  itemId: string,
  result: ChecklistResult,
  notes?: string,
  extra?: { measuredValue?: string }
): Promise<void> {
  const { data: item, error: fetchError } = await db
    .from("service_order_checklist")
    .select("service_order_id")
    .eq("id", itemId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!item) throw new Error("Punto no encontrado.");
  await ensureOrderUnlocked(String(item.service_order_id));
  const payload: Record<string, unknown> = { result };
  if (notes != null) payload.notes = notes.trim();
  if (extra?.measuredValue != null) payload.measured_value = extra.measuredValue.trim();
  const { error } = await db
    .from("service_order_checklist")
    .update(payload)
    .eq("id", itemId);
  if (error) throw new Error(error.message);
}

export async function updateFunctionTestMeasurement(
  item: ServiceOrderChecklistItem,
  measuredValue: string
): Promise<void> {
  const nextResult =
    item.result === "no_aplica"
      ? "no_aplica"
      : evaluateFunctionTestResult(measuredValue, item.minValue, item.maxValue);
  await updateChecklistItem(item.id, nextResult, item.notes, { measuredValue });
}

export async function addServiceOrderFunctionTest(input: {
  orderId: string;
  label: string;
  unit?: string;
  minValue?: number | null;
  maxValue?: number | null;
  createdBy?: string;
}): Promise<void> {
  await ensureOrderUnlocked(input.orderId);
  const label = input.label.trim();
  if (!label) throw new Error("El punto a revisar no puede estar vacío.");
  const interval = intervalPayload(input);

  const { data: existing, error: countError } = await db
    .from("service_order_checklist")
    .select("sort_order")
    .eq("service_order_id", input.orderId)
    .eq("list_kind", "funcionamiento")
    .order("sort_order", { ascending: false })
    .limit(1);
  if (countError) throw new Error(countError.message);
  const nextOrder = Number(existing?.[0]?.sort_order ?? 0) + 1;

  const { error } = await db.from("service_order_checklist").insert({
    service_order_id: input.orderId,
    label,
    list_kind: "funcionamiento",
    measured_value: "",
    result: "pendiente",
    sort_order: nextOrder,
    ...interval,
  });
  if (error) {
    if (!isMissingColumnError(error)) throw new Error(error.message);
    const { error: retryError } = await db.from("service_order_checklist").insert({
      service_order_id: input.orderId,
      label,
      list_kind: "funcionamiento",
      measured_value: "",
      result: "pendiente",
      sort_order: nextOrder,
    });
    if (retryError) throw new Error(retryError.message);
  }

  await addEvent(
    input.orderId,
    `Punto de prueba agregado: ${label}`,
    input.createdBy ?? "",
    "checklist"
  );
}

export async function addServiceOrderNote(
  orderId: string,
  message: string,
  createdBy: string,
  isInternal = true
): Promise<void> {
  await ensureOrderUnlocked(orderId);
  if (!message.trim()) throw new Error("Escribe un mensaje.");
  await addEvent(orderId, message.trim(), createdBy, "nota", isInternal);
}

export async function uploadServiceOrderImage(input: {
  orderId: string;
  stage: ImageStage;
  file: File;
  caption?: string;
  uploadedBy?: string;
}): Promise<ServiceOrderImage> {
  await ensureOrderUnlocked(input.orderId);
  const safeName = input.file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${input.orderId}/${input.stage}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, input.file, { upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicData } = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(path);

  const { data, error } = await db
    .from("service_order_images")
    .insert({
      service_order_id: input.orderId,
      stage: input.stage,
      caption: (input.caption ?? "").trim(),
      file_path: path,
      file_url: publicData.publicUrl,
      uploaded_by: (input.uploadedBy ?? "").trim(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await addEvent(
    input.orderId,
    `Imagen subida (${input.stage}): ${input.file.name}`,
    input.uploadedBy ?? "",
    "imagen"
  );

  return mapImage(data);
}

export async function deleteServiceOrderImage(
  image: ServiceOrderImage
): Promise<void> {
  await ensureOrderUnlocked(image.serviceOrderId);
  if (image.filePath) {
    await supabase.storage.from(MEDIA_BUCKET).remove([image.filePath]);
  }
  const { error } = await db
    .from("service_order_images")
    .delete()
    .eq("id", image.id);
  if (error) throw new Error(error.message);
}

function isPdfFile(file: File) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

function isImageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name);
}

function defaultDocumentTitle(docType: string, fileName: string) {
  if (docType === "seguridad_electrica") return "Examen de seguridad eléctrica";
  if (docType === "orden_firmada") return "Orden firmada y sellada (hospital)";
  return fileName;
}

export async function uploadServiceOrderDocument(input: {
  orderId: string;
  file: File;
  docType?: ServiceDocumentType;
  title?: string;
  uploadedBy?: string;
}): Promise<ServiceOrderDocument> {
  await ensureOrderUnlocked(input.orderId);
  const docType = input.docType ?? "seguridad_electrica";
  if (docType === "seguridad_electrica" && !isPdfFile(input.file)) {
    throw new Error("Solo se permiten archivos PDF.");
  }
  if (
    docType === "orden_firmada" &&
    !isPdfFile(input.file) &&
    !isImageFile(input.file)
  ) {
    throw new Error("Sube un PDF o una imagen del documento escaneado.");
  }
  const safeName = input.file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${input.orderId}/docs/${docType}/${Date.now()}-${safeName}`;
  const contentType =
    input.file.type ||
    (isPdfFile(input.file) ? "application/pdf" : "application/octet-stream");

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, input.file, {
      upsert: false,
      contentType,
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicData } = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(path);

  const title =
    (input.title ?? "").trim() || defaultDocumentTitle(docType, input.file.name);
  const row = {
    service_order_id: input.orderId,
    doc_type: docType,
    title,
    file_path: path,
    file_url: publicData.publicUrl,
    file_name: input.file.name,
    uploaded_by: (input.uploadedBy ?? "").trim(),
  };

  let { data, error } = await db
    .from("service_order_documents")
    .insert(row)
    .select("*")
    .single();
  if (
    error &&
    docType === "orden_firmada" &&
    /doc_type|check constraint|23514/i.test(`${error.message} ${error.code ?? ""}`)
  ) {
    const retry = await db
      .from("service_order_documents")
      .insert({ ...row, doc_type: "otro" })
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error) throw new Error(error.message);

  await addEvent(
    input.orderId,
    docType === "orden_firmada"
      ? `Orden firmada/sellada subida: ${input.file.name}`
      : `PDF subido (${docType}): ${input.file.name}`,
    input.uploadedBy ?? "",
    "documento"
  );

  return mapDocument(data);
}

export async function deleteServiceOrderDocument(
  doc: ServiceOrderDocument
): Promise<void> {
  await ensureOrderUnlocked(doc.serviceOrderId);
  if (doc.filePath) {
    await supabase.storage.from(MEDIA_BUCKET).remove([doc.filePath]);
  }
  const { error } = await db
    .from("service_order_documents")
    .delete()
    .eq("id", doc.id);
  if (error) throw new Error(error.message);
}

export async function addLinkedEquipment(input: {
  orderId: string;
  equipmentId?: string | null;
  equipmentName?: string;
  equipmentBrand?: string;
  equipmentModel?: string;
  equipmentSerial?: string;
  equipmentLocation?: string;
  relationLabel?: string;
  notes?: string;
  createdBy?: string;
}): Promise<ServiceOrderLinkedEquipment> {
  await ensureOrderUnlocked(input.orderId);
  const order = await getServiceOrder(input.orderId);
  if (!order) throw new Error("Orden no encontrada.");

  const nextOrder =
    order.linkedEquipment.reduce(
      (max, item) => Math.max(max, item.sortOrder),
      -1
    ) + 1;

  const { data, error } = await db
    .from("service_order_linked_equipment")
    .insert({
      service_order_id: input.orderId,
      equipment_id: input.equipmentId || null,
      equipment_name: (input.equipmentName ?? "").trim(),
      equipment_brand: (input.equipmentBrand ?? "").trim(),
      equipment_model: (input.equipmentModel ?? "").trim(),
      equipment_serial: (input.equipmentSerial ?? "").trim(),
      equipment_location: (input.equipmentLocation ?? "").trim(),
      relation_label: (input.relationLabel ?? "Equipo ligado").trim() || "Equipo ligado",
      notes: (input.notes ?? "").trim(),
      sort_order: nextOrder,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const name =
    (input.equipmentName ?? "").trim() ||
    "Equipo ligado";
  await addEvent(
    input.orderId,
    `Equipo ligado agregado: ${name} (${(input.relationLabel ?? "Equipo ligado").trim()})`,
    input.createdBy ?? "",
    "equipo_ligado"
  );

  return mapLinkedEquipment(data);
}

export async function removeLinkedEquipment(
  linkId: string,
  createdBy?: string
): Promise<void> {
  const { data, error: fetchError } = await db
    .from("service_order_linked_equipment")
    .select("service_order_id, equipment_name, relation_label")
    .eq("id", linkId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!data) throw new Error("Equipo ligado no encontrado.");
  await ensureOrderUnlocked(String(data.service_order_id));

  const { error } = await db
    .from("service_order_linked_equipment")
    .delete()
    .eq("id", linkId);
  if (error) throw new Error(error.message);

  await addEvent(
    String(data.service_order_id),
    `Equipo ligado eliminado: ${String(data.equipment_name || "Equipo")} (${String(data.relation_label || "ligado")})`,
    createdBy ?? "",
    "equipo_ligado"
  );
}

export async function addServiceOrderInstrument(input: {
  orderId: string;
  instrumentId?: string | null;
  instrumentType?: string;
  instrumentName?: string;
  instrumentBrand?: string;
  instrumentModel?: string;
  instrumentSerial?: string;
  usageNotes?: string;
  createdBy?: string;
}): Promise<ServiceOrderInstrument> {
  await ensureOrderUnlocked(input.orderId);
  const order = await getServiceOrder(input.orderId);
  if (!order) throw new Error("Orden no encontrada.");

  const nextOrder =
    order.instruments.reduce((max, item) => Math.max(max, item.sortOrder), -1) +
    1;

  const { data, error } = await db
    .from("service_order_instruments")
    .insert({
      service_order_id: input.orderId,
      instrument_id: input.instrumentId || null,
      instrument_type: (input.instrumentType ?? "simulador").trim() || "simulador",
      instrument_name: (input.instrumentName ?? "").trim(),
      instrument_brand: (input.instrumentBrand ?? "").trim(),
      instrument_model: (input.instrumentModel ?? "").trim(),
      instrument_serial: (input.instrumentSerial ?? "").trim(),
      usage_notes: (input.usageNotes ?? "").trim(),
      sort_order: nextOrder,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const name = (input.instrumentName ?? "").trim() || "Instrumento";
  await addEvent(
    input.orderId,
    `Instrumento usado: ${name}`,
    input.createdBy ?? "",
    "instrumento"
  );

  return mapOrderInstrument(data);
}

export async function removeServiceOrderInstrument(
  linkId: string,
  createdBy?: string
): Promise<void> {
  const { data, error: fetchError } = await db
    .from("service_order_instruments")
    .select("service_order_id, instrument_name, instrument_type")
    .eq("id", linkId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!data) throw new Error("Instrumento no encontrado en la orden.");
  await ensureOrderUnlocked(String(data.service_order_id));

  const { error } = await db
    .from("service_order_instruments")
    .delete()
    .eq("id", linkId);
  if (error) throw new Error(error.message);

  await addEvent(
    String(data.service_order_id),
    `Instrumento quitado: ${String(data.instrument_name || "Instrumento")}`,
    createdBy ?? "",
    "instrumento"
  );
}
