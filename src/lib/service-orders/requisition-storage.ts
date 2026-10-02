import { supabase } from "@/lib/supabase/client";
import { getProductAvailableQty } from "@/lib/holds/storage";
import { applyStockMovement } from "@/lib/warehouse/stock";
import type {
  CreateQuoteRequisitionInput,
  CreateRequisitionInput,
  FulfillLineInput,
  RequisitionFulfillment,
  RequisitionLineInput,
  RequisitionLineStatus,
  RequisitionPriority,
  RequisitionSource,
  RequisitionStatus,
  ServiceOrderRequisition,
  ServiceOrderRequisitionLine,
} from "./requisitions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function mapLine(
  row: Record<string, unknown>,
  product?: { sku?: string; name?: string }
): ServiceOrderRequisitionLine {
  return {
    id: String(row.id),
    requisitionId: String(row.requisition_id),
    serviceOrderLineId: row.service_order_line_id
      ? String(row.service_order_line_id)
      : null,
    quoteLineId: row.quote_line_id ? String(row.quote_line_id) : null,
    productId: row.product_id ? String(row.product_id) : null,
    productSku: String(product?.sku ?? ""),
    productName: String(product?.name ?? ""),
    description: String(row.description ?? ""),
    quantityRequested: Number(row.quantity_requested ?? 0),
    quantityFulfilled: Number(row.quantity_fulfilled ?? 0),
    unit: String(row.unit ?? "pza"),
    lineStatus: String(row.line_status ?? "pendiente") as RequisitionLineStatus,
    notes: String(row.notes ?? ""),
  };
}

function mapRequisition(
  row: Record<string, unknown>,
  lines: ServiceOrderRequisitionLine[],
  order?: { folio?: string; client_name?: string; equipment_name?: string }
): ServiceOrderRequisition {
  return {
    id: String(row.id),
    folio: String(row.folio),
    sourceType: (row.source_type === "cotizacion" ? "cotizacion" : "orden_servicio") as RequisitionSource,
    serviceOrderId: row.service_order_id ? String(row.service_order_id) : null,
    serviceOrderFolio: String(order?.folio ?? row.service_order_folio ?? ""),
    quoteId: row.quote_id ? String(row.quote_id) : null,
    quoteFolio: String(row.quote_folio ?? ""),
    clientName: String(order?.client_name || row.client_name || ""),
    equipmentName: String(order?.equipment_name ?? row.equipment_name ?? ""),
    priority: (row.priority === "urgente" ? "urgente" : "normal") as RequisitionPriority,
    neededBy: row.needed_by ? String(row.needed_by) : "",
    deliveryAddress: String(row.delivery_address ?? ""),
    status: String(row.status ?? "solicitada") as RequisitionStatus,
    requestedBy: String(row.requested_by ?? ""),
    requestedAt: String(row.requested_at ?? row.created_at ?? ""),
    fulfilledBy: String(row.fulfilled_by ?? ""),
    fulfilledAt: row.fulfilled_at ? String(row.fulfilled_at) : "",
    notes: String(row.notes ?? ""),
    warehouseNotes: String(row.warehouse_notes ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lines,
  };
}

async function nextRequisitionFolio(source: RequisitionSource = "orden_servicio") {
  const year = new Date().getFullYear();
  const prefix = `${source === "cotizacion" ? "SOL-COT" : "SOL-OS"}-${year}-`;
  const { data, error } = await db
    .from("service_order_requisitions")
    .select("folio")
    .like("folio", `${prefix}%`)
    .order("folio", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = data?.[0]?.folio as string | undefined;
  const seq = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(4, "0")}`;
}

async function hydrateRequisitions(
  rows: Record<string, unknown>[]
): Promise<ServiceOrderRequisition[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const orderIds = [
    ...new Set(rows.map((r) => (r.service_order_id ? String(r.service_order_id) : "")).filter(Boolean)),
  ];

  const [linesRes, ordersRes] = await Promise.all([
    db
      .from("service_order_requisition_lines")
      .select("*, product:inventory_items(sku, name)")
      .in("requisition_id", ids),
    orderIds.length
      ? db
          .from("service_orders")
          .select("id, folio, client_name, equipment_name")
          .in("id", orderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (linesRes.error) throw new Error(linesRes.error.message);
  if (ordersRes.error) throw new Error(ordersRes.error.message);

  const orderById = new Map<string, Record<string, unknown>>();
  for (const order of ordersRes.data ?? []) {
    orderById.set(String(order.id), order);
  }

  const linesBy = new Map<string, ServiceOrderRequisitionLine[]>();
  for (const row of linesRes.data ?? []) {
    const rid = String(row.requisition_id);
    const list = linesBy.get(rid) ?? [];
    list.push(
      mapLine(row, {
        sku: row.product?.sku,
        name: row.product?.name,
      })
    );
    linesBy.set(rid, list);
  }

  return rows.map((row) => {
    const order = orderById.get(String(row.service_order_id));
    return mapRequisition(row, linesBy.get(String(row.id)) ?? [], order);
  });
}

export async function getServiceOrderRequisitions(filters?: {
  status?: RequisitionStatus | RequisitionStatus[];
  serviceOrderId?: string;
  quoteId?: string;
  sourceType?: RequisitionSource;
}): Promise<ServiceOrderRequisition[]> {
  let query = db
    .from("service_order_requisitions")
    .select("*")
    .order("requested_at", { ascending: false });

  if (filters?.serviceOrderId) {
    query = query.eq("service_order_id", filters.serviceOrderId);
  }
  if (filters?.quoteId) query = query.eq("quote_id", filters.quoteId);
  if (filters?.sourceType) query = query.eq("source_type", filters.sourceType);
  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in("status", filters.status);
    } else {
      query = query.eq("status", filters.status);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return hydrateRequisitions(data ?? []);
}

export async function getOpenWarehouseRequisitions(): Promise<
  ServiceOrderRequisition[]
> {
  return getServiceOrderRequisitions({
    status: ["solicitada", "parcial"],
  });
}

function validateRequisitionLines(lines: RequisitionLineInput[], allowOffCatalog = false) {
  if (!lines.length) {
    throw new Error("Selecciona al menos un artículo para solicitar.");
  }
  for (const line of lines) {
    if (!line.productId && !allowOffCatalog) {
      throw new Error("Cada línea de solicitud debe venir del catálogo de almacén.");
    }
    if (!line.productId && !line.description.trim()) {
      throw new Error("Las partidas fuera de catálogo necesitan una descripción.");
    }
    if (!(Number(line.quantity) > 0)) {
      throw new Error("La cantidad solicitada debe ser mayor a 0.");
    }
  }
}

/** Inserta cabecera y líneas; reintenta si otro usuario tomó el mismo folio. */
async function insertRequisition(
  source: RequisitionSource,
  header: Record<string, unknown>,
  lines: RequisitionLineInput[]
): Promise<Record<string, unknown>> {
  let req: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 3 && !req; attempt++) {
    const folio = await nextRequisitionFolio(source);
    const { data, error } = await db
      .from("service_order_requisitions")
      .insert({ ...header, folio, source_type: source, status: "solicitada" })
      .select("*")
      .single();
    if (!error) req = data as Record<string, unknown>;
    else if (!String(error.message).includes("folio")) throw new Error(error.message);
  }
  if (!req) throw new Error("No se pudo asignar un folio. Intenta de nuevo.");

  const { error: linesError } = await db
    .from("service_order_requisition_lines")
    .insert(
      lines.map((line) => ({
        requisition_id: req.id,
        service_order_line_id: line.serviceOrderLineId || null,
        quote_line_id: line.quoteLineId || null,
        product_id: line.productId || null,
        description: line.description.trim(),
        quantity_requested: Number(line.quantity),
        quantity_fulfilled: 0,
        unit: (line.unit ?? "pza").trim() || "pza",
        line_status: "pendiente",
        notes: (line.notes ?? "").trim(),
      }))
    );
  if (linesError) {
    await db.from("service_order_requisitions").delete().eq("id", req.id);
    throw new Error(linesError.message);
  }
  return req;
}

/** Deja constancia en la bitácora del documento de origen (OS o cotización). */
async function logOriginEvent(
  req: Pick<ServiceOrderRequisition, "sourceType" | "serviceOrderId" | "quoteId">,
  eventType: string,
  message: string,
  actor: string
) {
  if (req.sourceType === "cotizacion") {
    if (!req.quoteId) return;
    await db.from("quote_events").insert({
      quote_id: req.quoteId,
      event_type: eventType,
      message,
      created_by: actor.trim(),
    });
    return;
  }
  if (!req.serviceOrderId) return;
  await db.from("service_order_events").insert({
    service_order_id: req.serviceOrderId,
    event_type: eventType,
    message,
    is_internal: true,
    created_by: actor.trim(),
  });
}

export async function createQuoteRequisition(
  input: CreateQuoteRequisitionInput
): Promise<ServiceOrderRequisition> {
  validateRequisitionLines(input.lines, true);

  const { data: quote, error: quoteError } = await db
    .from("quotes")
    .select("id, folio, client_name, status")
    .eq("id", input.quoteId)
    .maybeSingle();
  if (quoteError) throw new Error(quoteError.message);
  if (!quote) throw new Error("Cotización no encontrada.");
  if (["rechazada", "cancelada", "vencida"].includes(String(quote.status))) {
    throw new Error("No se puede surtir una cotización rechazada, cancelada o vencida.");
  }

  const req = await insertRequisition(
    "cotizacion",
    {
      quote_id: input.quoteId,
      quote_folio: String(quote.folio ?? ""),
      client_name: String(quote.client_name ?? ""),
      priority: input.priority === "urgente" ? "urgente" : "normal",
      needed_by: input.neededBy || null,
      delivery_address: (input.deliveryAddress ?? "").trim(),
      requested_by: input.requestedBy.trim(),
      notes: (input.notes ?? "").trim(),
    },
    input.lines
  );

  const units = input.lines.reduce((sum, line) => sum + Number(line.quantity), 0);
  const offCatalog = input.lines.filter((line) => !line.productId).length;
  await logOriginEvent(
    { sourceType: "cotizacion", serviceOrderId: null, quoteId: input.quoteId },
    "surtimiento",
    `Solicitud de surtimiento ${String(req.folio)} enviada a almacén · ${input.lines.length} partida(s), ${units} unidad(es)${
      offCatalog ? ` · ${offCatalog} fuera de catálogo` : ""
    }`,
    input.requestedBy
  );

  const [created] = await hydrateRequisitions([req]);
  return created;
}

export async function createServiceOrderRequisition(
  input: CreateRequisitionInput
): Promise<ServiceOrderRequisition> {
  validateRequisitionLines(input.lines);

  const { data: order, error: orderError } = await db
    .from("service_orders")
    .select("id, folio")
    .eq("id", input.serviceOrderId)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message);
  if (!order) throw new Error("Orden de servicio no encontrada.");

  const req = await insertRequisition(
    "orden_servicio",
    {
      service_order_id: input.serviceOrderId,
      requested_by: input.requestedBy.trim(),
      notes: (input.notes ?? "").trim(),
    },
    input.lines
  );
  const folio = String(req.folio);

  const lineIds = input.lines
    .map((l) => l.serviceOrderLineId)
    .filter(Boolean) as string[];
  if (lineIds.length) {
    await db
      .from("service_order_lines")
      .update({ line_status: "solicitado" })
      .in("id", lineIds);
  }

  await logOriginEvent(
    { sourceType: "orden_servicio", serviceOrderId: input.serviceOrderId, quoteId: null },
    "solicitud_almacen",
    `Solicitud a almacén ${folio} · ${input.lines.length} línea(s)`,
    input.requestedBy
  );

  const [created] = await hydrateRequisitions([req]);
  return created;
}

function lineStatusAfterFulfill(
  requested: number,
  fulfilled: number
): RequisitionLineStatus {
  if (fulfilled <= 0) return "pendiente";
  if (fulfilled + 0.0001 >= requested) return "surtido";
  return "parcial";
}

function requisitionStatusFromLines(
  lines: Pick<
    ServiceOrderRequisitionLine,
    "quantityRequested" | "quantityFulfilled" | "lineStatus"
  >[]
): RequisitionStatus {
  const active = lines.filter((l) => l.lineStatus !== "cancelado");
  if (!active.length) return "cancelada";
  if (active.every((l) => l.quantityFulfilled + 0.0001 >= l.quantityRequested)) {
    return "surtida";
  }
  if (active.some((l) => l.quantityFulfilled > 0)) return "parcial";
  return "solicitada";
}

/** Almacén surte líneas: descuenta inventario y actualiza la OS. */
export async function fulfillServiceOrderRequisition(
  requisitionId: string,
  fulfillments: FulfillLineInput[],
  fulfilledBy: string,
  warehouseNotes = ""
): Promise<ServiceOrderRequisition> {
  const list = await getServiceOrderRequisitions();
  const req = list.find((r) => r.id === requisitionId);
  if (!req) throw new Error("Solicitud no encontrada.");
  if (req.status === "cancelada" || req.status === "surtida") {
    throw new Error("Esta solicitud ya no se puede surtir.");
  }

  const toFulfill = fulfillments.filter((f) => Number(f.quantity) > 0);
  if (!toFulfill.length) {
    throw new Error("Indica al menos una cantidad a surtir.");
  }

  for (const item of toFulfill) {
    const line = req.lines.find((l) => l.id === item.lineId);
    if (!line) throw new Error("Línea de solicitud no encontrada.");
    const remaining = Math.max(
      0,
      line.quantityRequested - line.quantityFulfilled
    );
    if (item.quantity > remaining + 0.0001) {
      throw new Error(
        `No puedes surtir más de lo pendiente en ${line.description} (pendiente: ${remaining}).`
      );
    }
    if (!line.productId) continue;
    const available = await getProductAvailableQty(line.productId);
    if (item.quantity > available) {
      throw new Error(
        `Stock insuficiente para ${line.productSku || line.description}. Disponible: ${available}.`
      );
    }
  }

  const fromQuote = req.sourceType === "cotizacion";
  for (const item of toFulfill) {
    const line = req.lines.find((l) => l.id === item.lineId)!;
    if (line.productId) {
      await applyStockMovement({
        productId: line.productId,
        movementType: "salida",
        quantity: item.quantity,
        createdBy: fulfilledBy,
        reason: fromQuote ? "Surtido a venta (cotización)" : "Surtido a orden de servicio",
        note: [req.folio, fromQuote ? req.quoteFolio : req.serviceOrderFolio, fromQuote ? req.clientName : "", line.description]
          .filter(Boolean)
          .join(" · "),
      });
    }

    await db.from("service_order_requisition_fulfillments").insert({
      requisition_id: req.id,
      line_id: line.id,
      quantity: Number(item.quantity),
      fulfilled_by: fulfilledBy.trim(),
      notes: [line.productId ? "" : "Entrega directa fuera de catálogo (sin inventario)", warehouseNotes.trim()]
        .filter(Boolean)
        .join(" · "),
    });

    const newFulfilled = Number(line.quantityFulfilled) + Number(item.quantity);
    const status = lineStatusAfterFulfill(line.quantityRequested, newFulfilled);
    await db
      .from("service_order_requisition_lines")
      .update({
        quantity_fulfilled: newFulfilled,
        line_status: status,
      })
      .eq("id", line.id);

    if (line.serviceOrderLineId) {
      await db
        .from("service_order_lines")
        .update({
          line_status: status === "surtido" ? "disponible" : "solicitado",
        })
        .eq("id", line.serviceOrderLineId);
    }
  }

  const refreshedLines = (
    await db
      .from("service_order_requisition_lines")
      .select("*")
      .eq("requisition_id", requisitionId)
  ).data as Record<string, unknown>[] | null;

  const mapped = (refreshedLines ?? []).map((row) => mapLine(row));
  const nextStatus = requisitionStatusFromLines(mapped);
  const patch: Record<string, unknown> = {
    status: nextStatus,
    warehouse_notes: warehouseNotes.trim() || req.warehouseNotes,
    updated_at: new Date().toISOString(),
  };
  if (nextStatus === "surtida" || nextStatus === "parcial") {
    patch.fulfilled_by = fulfilledBy.trim();
    patch.fulfilled_at = new Date().toISOString();
  }

  const { error } = await db
    .from("service_order_requisitions")
    .update(patch)
    .eq("id", requisitionId);
  if (error) throw new Error(error.message);

  const surtidoNow = toFulfill.reduce((sum, item) => sum + Number(item.quantity), 0);
  await logOriginEvent(
    req,
    "surtido_almacen",
    `Almacén surtió ${surtidoNow} unidad(es) de ${req.folio} · ${
      nextStatus === "surtida" ? "surtimiento completo" : "surtimiento parcial"
    }`,
    fulfilledBy
  );

  const all = await getServiceOrderRequisitions();
  const found = all.find((r) => r.id === requisitionId);
  if (!found) throw new Error("No se pudo recargar la solicitud.");
  return found;
}

export async function getRequisitionFulfillments(
  requisitionId: string
): Promise<RequisitionFulfillment[]> {
  const { data, error } = await db
    .from("service_order_requisition_fulfillments")
    .select("*")
    .eq("requisition_id", requisitionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    requisitionId: String(row.requisition_id),
    lineId: row.line_id ? String(row.line_id) : null,
    quantity: Number(row.quantity ?? 0),
    fulfilledBy: String(row.fulfilled_by ?? ""),
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at ?? ""),
  }));
}

export async function cancelServiceOrderRequisition(
  requisitionId: string,
  cancelledBy: string
): Promise<void> {
  const all = await getServiceOrderRequisitions();
  const req = all.find((r) => r.id === requisitionId);
  if (!req) throw new Error("Solicitud no encontrada.");
  if (req.status === "surtida") {
    throw new Error("No se puede cancelar una solicitud ya surtida.");
  }
  if (req.lines.some((l) => l.quantityFulfilled > 0)) {
    throw new Error(
      "Ya hay material surtido. No se puede cancelar completa; surte el resto o marca líneas."
    );
  }

  const { error } = await db
    .from("service_order_requisitions")
    .update({
      status: "cancelada",
      updated_at: new Date().toISOString(),
    })
    .eq("id", requisitionId);
  if (error) throw new Error(error.message);

  await db
    .from("service_order_requisition_lines")
    .update({ line_status: "cancelado" })
    .eq("requisition_id", requisitionId);

  const lineIds = req.lines
    .map((l) => l.serviceOrderLineId)
    .filter(Boolean) as string[];
  if (lineIds.length) {
    await db
      .from("service_order_lines")
      .update({ line_status: "pendiente" })
      .in("id", lineIds);
  }

  await logOriginEvent(req, "solicitud_cancelada", `Solicitud de surtimiento ${req.folio} cancelada`, cancelledBy);
}
