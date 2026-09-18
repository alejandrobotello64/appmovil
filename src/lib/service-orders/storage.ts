import { supabase } from "@/lib/supabase/client";
import {
  computeServiceTotals,
  serviceOrderStatusLabel,
  type ChecklistResult,
  type ChecklistTemplate,
  type ChecklistTemplatePoint,
  type ImageStage,
  type ServiceOrder,
  type ServiceOrderChecklistItem,
  type ServiceOrderEvent,
  type ServiceOrderImage,
  type ServiceOrderInput,
  type ServiceOrderKind,
  type ServiceOrderLine,
  type ServiceOrderLineInput,
  type ServiceOrderStatus,
  type ServiceLineKind,
  type ServiceLineStatus,
  type ServiceType,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const MEDIA_BUCKET = "service-order-media";

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

function mapTemplatePoint(row: Record<string, unknown>): ChecklistTemplatePoint {
  return {
    id: String(row.id),
    templateId: String(row.template_id),
    label: String(row.label ?? ""),
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

function mapChecklist(row: Record<string, unknown>): ServiceOrderChecklistItem {
  return {
    id: String(row.id),
    serviceOrderId: String(row.service_order_id),
    templatePointId: row.template_point_id ? String(row.template_point_id) : null,
    label: String(row.label ?? ""),
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
  events: ServiceOrderEvent[]
): ServiceOrder {
  return {
    id: String(row.id),
    folio: String(row.folio),
    orderKind: String(row.order_kind ?? "servicio") as ServiceOrderKind,
    status: String(row.status ?? "borrador") as ServiceOrderStatus,
    priority: (String(row.priority ?? "normal") === "urgente"
      ? "urgente"
      : "normal") as "normal" | "urgente",
    serviceType: String(row.service_type ?? "mantenimiento") as ServiceType,
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
    receptionAt: dateOrEmpty(row.reception_at),
    promisedAt: dateOrEmpty(row.promised_at),
    deliveredAt: dateOrEmpty(row.delivered_at),
    faultReported: String(row.fault_reported ?? ""),
    generalObservations: String(row.general_observations ?? ""),
    diagnosisNotes: String(row.diagnosis_notes ?? ""),
    serviceNotes: String(row.service_notes ?? ""),
    authorized: Boolean(row.authorized),
    closed: Boolean(row.closed),
    currency: String(row.currency ?? "MXN"),
    subtotal: Number(row.subtotal ?? 0),
    taxRate: Number(row.tax_rate ?? 16),
    taxAmount: Number(row.tax_amount ?? 0),
    discount: Number(row.discount ?? 0),
    total: Number(row.total ?? 0),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lines,
    checklist,
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
    service_type: input.serviceType ?? "mantenimiento",
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
    reception_at: isoOrNull(input.receptionAt),
    promised_at: isoOrNull(input.promisedAt),
    delivered_at: isoOrNull(input.deliveredAt),
    fault_reported: (input.faultReported ?? "").trim(),
    general_observations: (input.generalObservations ?? "").trim(),
    diagnosis_notes: (input.diagnosisNotes ?? "").trim(),
    service_notes: (input.serviceNotes ?? "").trim(),
    authorized: Boolean(input.authorized),
    closed: Boolean(input.closed),
    tax_rate: input.taxRate ?? 16,
    discount: input.discount ?? 0,
    subtotal: totals.subtotal,
    tax_amount: totals.taxAmount,
    total: totals.total,
  };
}

export async function getChecklistTemplates(): Promise<ChecklistTemplate[]> {
  const { data, error } = await db
    .from("service_checklist_templates")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
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
    description: String(row.description ?? ""),
    isActive: Boolean(row.is_active),
    points: byTpl.get(String(row.id)) ?? [],
  }));
}

async function hydrateOrders(
  orderRows: Record<string, unknown>[]
): Promise<ServiceOrder[]> {
  if (!orderRows.length) return [];
  const ids = orderRows.map((row) => row.id);

  const [linesRes, checkRes, imagesRes, eventsRes] = await Promise.all([
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
  ]);

  if (linesRes.error) throw new Error(linesRes.error.message);
  if (checkRes.error) throw new Error(checkRes.error.message);
  if (imagesRes.error) throw new Error(imagesRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);

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

  return orderRows.map((row) => {
    const id = String(row.id);
    return mapOrder(
      row,
      linesBy.get(id) ?? [],
      checkBy.get(id) ?? [],
      imagesBy.get(id) ?? [],
      eventsBy.get(id) ?? []
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

  const { data, error } = await db
    .from("service_orders")
    .insert({
      folio,
      ...payloadFromInput(input, lines),
      created_by: createdBy,
      reception_at:
        isoOrNull(input.receptionAt) ??
        (kind === "servicio" ? new Date().toISOString() : null),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (lines.length) {
    const { error: linesError } = await db
      .from("service_order_lines")
      .insert(lines.map((line, index) => linePayload(data.id, line, index)));
    if (linesError) throw new Error(linesError.message);
  }

  if (input.checklistTemplateId) {
    await applyChecklistTemplate(data.id, input.checklistTemplateId, createdBy);
  }

  await addEvent(
    data.id,
    `Orden creada · ${folio}`,
    createdBy,
    "creacion"
  );

  const created = await getServiceOrder(data.id);
  if (!created) throw new Error("No se pudo recargar la orden.");
  return created;
}

export async function updateServiceOrder(
  id: string,
  input: ServiceOrderInput
): Promise<ServiceOrder> {
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

  const { error } = await db
    .from("service_orders")
    .update({
      ...payloadFromInput({ ...input, orderKind: input.orderKind ?? current.orderKind }, lines),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
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

  if (input.status && input.status !== current.status) {
    await addEvent(
      id,
      `Estatus: ${serviceOrderStatusLabel(current.status)} → ${serviceOrderStatusLabel(input.status)}`,
      input.createdBy ?? "",
      "estatus"
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

export async function deleteServiceOrder(id: string): Promise<void> {
  const order = await getServiceOrder(id);
  if (order) {
    const paths = order.images.map((img) => img.filePath).filter(Boolean);
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
  const { data: points, error } = await db
    .from("service_checklist_template_points")
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);

  await db
    .from("service_order_checklist")
    .delete()
    .eq("service_order_id", orderId);

  if (points?.length) {
    const { error: insertError } = await db.from("service_order_checklist").insert(
      points.map((row: Record<string, unknown>, index: number) => ({
        service_order_id: orderId,
        template_point_id: row.id,
        label: row.label,
        result: "pendiente",
        sort_order: Number(row.sort_order ?? index),
      }))
    );
    if (insertError) throw new Error(insertError.message);
  }

  await db
    .from("service_orders")
    .update({
      checklist_template_id: templateId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  await addEvent(orderId, "Plantilla de revisión de puntos aplicada", createdBy, "checklist");
}

export async function updateChecklistItem(
  itemId: string,
  result: ChecklistResult,
  notes?: string
): Promise<void> {
  const { error } = await db
    .from("service_order_checklist")
    .update({
      result,
      notes: (notes ?? "").trim(),
    })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
}

export async function addServiceOrderNote(
  orderId: string,
  message: string,
  createdBy: string,
  isInternal = true
): Promise<void> {
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
  if (image.filePath) {
    await supabase.storage.from(MEDIA_BUCKET).remove([image.filePath]);
  }
  const { error } = await db
    .from("service_order_images")
    .delete()
    .eq("id", image.id);
  if (error) throw new Error(error.message);
}
