import { supabase } from "@/lib/supabase/client";
import { getProductAvailableQty } from "@/lib/holds/storage";
import { requisitionLinePending, type ServiceOrderRequisition } from "@/lib/service-orders/requisitions";
import { findStaffProfile } from "@/lib/users/staff";
import { cancelPurchaseOrder, createPurchaseOrder } from "@/lib/warehouse/orders";
import {
  OPEN_PURCHASE_STATUSES,
  type CreatePurchaseRequestInput,
  type PurchaseOrdersFromRequestInput,
  type PurchasePriority,
  type PurchaseRequest,
  type PurchaseRequestEvent,
  type PurchaseRequestLine,
  type PurchaseRequestSource,
  type PurchaseRequestStatus,
  type RequisitionShortage,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Row = Record<string, unknown>;

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const num = (value: unknown) => Number(value ?? 0) || 0;

function mapLine(row: Row): PurchaseRequestLine {
  return {
    id: str(row.id),
    requestId: str(row.request_id),
    requisitionLineId: row.requisition_line_id ? str(row.requisition_line_id) : null,
    productId: row.product_id ? str(row.product_id) : null,
    productSku: str(row.product_sku),
    productName: str(row.product_name),
    description: str(row.description),
    unit: str(row.unit) || "pza",
    quantity: num(row.quantity),
    stockAtRequest: num(row.stock_at_request),
    notes: str(row.notes),
    purchaseOrderId: row.purchase_order_id ? str(row.purchase_order_id) : null,
  };
}

function mapEvent(row: Row): PurchaseRequestEvent {
  return {
    id: str(row.id),
    eventType: str(row.event_type),
    message: str(row.message),
    actor: str(row.actor),
    createdAt: str(row.created_at),
  };
}

function mapRequest(row: Row, lines: PurchaseRequestLine[], events: PurchaseRequestEvent[]): PurchaseRequest {
  return {
    id: str(row.id),
    folio: str(row.folio),
    status: (str(row.status) || "pendiente") as PurchaseRequestStatus,
    priority: (str(row.priority) || "normal") as PurchasePriority,
    source: (str(row.source) || "manual") as PurchaseRequestSource,
    requisitionId: row.requisition_id ? str(row.requisition_id) : null,
    requisitionFolio: str(row.requisition_folio),
    serviceOrderId: row.service_order_id ? str(row.service_order_id) : null,
    serviceOrderFolio: str(row.service_order_folio),
    clientName: str(row.client_name),
    equipmentName: str(row.equipment_name),
    justification: str(row.justification),
    neededBy: str(row.needed_by),
    notes: str(row.notes),
    requester: {
      username: str(row.requested_by),
      name: str(row.requester_name) || str(row.requested_by),
      jobTitle: str(row.requester_job_title),
      department: str(row.requester_department),
    },
    requestedAt: str(row.requested_at),
    assignedTo: str(row.assigned_to),
    purchasingNotes: str(row.purchasing_notes),
    purchaseOrderId: row.purchase_order_id ? str(row.purchase_order_id) : null,
    purchaseOrderNumber: str(row.purchase_order_number),
    supplierName: str(row.supplier_name),
    orderedAt: str(row.ordered_at),
    receivedAt: str(row.received_at),
    closedBy: str(row.closed_by),
    closedReason: str(row.closed_reason),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    lines,
    events,
  };
}

async function logEvent(requestId: string, eventType: string, message: string, actor: string) {
  await db.from("purchase_request_events").insert({
    request_id: requestId,
    event_type: eventType,
    message,
    actor,
  });
}

/**
 * Recalcula el resumen de OCs del encabezado a partir de las líneas: la solicitud queda
 * "ordenada" solo cuando todos sus materiales tienen OC; si falta alguno sigue "en proceso".
 */
async function refreshOrderSummary(id: string) {
  const [requestRes, linesRes] = await Promise.all([
    db.from("purchase_requests").select("status, ordered_at").eq("id", id).maybeSingle(),
    db.from("purchase_request_lines").select("purchase_order_id").eq("request_id", id),
  ]);
  if (requestRes.error) throw new Error(requestRes.error.message);
  if (linesRes.error) throw new Error(linesRes.error.message);
  if (!requestRes.data) return;

  const lines = (linesRes.data ?? []) as Row[];
  const orderIds = [...new Set(lines.map((line) => str(line.purchase_order_id)).filter(Boolean))];
  let orders: Row[] = [];
  if (orderIds.length) {
    const { data, error } = await db
      .from("purchase_orders")
      .select("id, order_number, supplier_name, created_at")
      .in("id", orderIds)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    orders = (data ?? []) as Row[];
  }

  const status = str(requestRes.data.status) as PurchaseRequestStatus;
  const allAssigned = lines.length > 0 && lines.every((line) => line.purchase_order_id);
  let nextStatus = status;
  if (status === "pendiente" || status === "en_proceso" || status === "ordenada") {
    if (allAssigned) nextStatus = "ordenada";
    else if (orderIds.length || status === "ordenada") nextStatus = "en_proceso";
  }

  const { error } = await db
    .from("purchase_requests")
    .update({
      status: nextStatus,
      purchase_order_id: orders[0] ? str(orders[0].id) : null,
      purchase_order_number: orders.map((order) => str(order.order_number)).join(", "),
      supplier_name: [...new Set(orders.map((order) => str(order.supplier_name)).filter(Boolean))].join(", "),
      ordered_at: orders.length ? str(requestRes.data.ordered_at) || new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Las solicitudes siguen el estatus de sus órdenes de compra (una por proveedor): si una OC
 * se cancela, sus materiales regresan a compras; cuando almacén recibe todas, se cierra.
 */
async function syncWithPurchaseOrders(rows: Row[]) {
  const active = rows.filter((row) => row.status === "en_proceso" || row.status === "ordenada");
  if (!active.length) return false;
  const { data: lineRows, error: linesError } = await db
    .from("purchase_request_lines")
    .select("id, request_id, purchase_order_id")
    .in("request_id", active.map((row) => row.id));
  if (linesError) return false;
  const lines = (lineRows ?? []) as Row[];
  const orderIds = [...new Set(lines.map((line) => str(line.purchase_order_id)).filter(Boolean))];
  const orderById = new Map<string, Row>();
  if (orderIds.length) {
    const { data, error } = await db.from("purchase_orders").select("id, status, order_number").in("id", orderIds);
    if (error) return false;
    for (const order of (data ?? []) as Row[]) orderById.set(str(order.id), order);
  }

  let changed = false;
  for (const row of active) {
    const id = str(row.id);
    const own = lines.filter((line) => str(line.request_id) === id);
    const ownOrderIds = [...new Set(own.map((line) => str(line.purchase_order_id)).filter(Boolean))];
    const cancelled = ownOrderIds.filter((orderId) => (str(orderById.get(orderId)?.status) || "cancelado") === "cancelado");

    if (cancelled.length) {
      await db.from("purchase_request_lines").update({ purchase_order_id: null }).eq("request_id", id).in("purchase_order_id", cancelled);
      for (const orderId of cancelled) {
        await logEvent(
          id,
          "oc_cancelada",
          `La orden de compra ${str(orderById.get(orderId)?.order_number)} se canceló; sus materiales regresan a compras.`,
          "sistema"
        );
      }
      await refreshOrderSummary(id).catch(() => undefined);
      changed = true;
      continue;
    }

    const allAssigned = own.length > 0 && own.every((line) => line.purchase_order_id);
    if (row.status === "ordenada" && !allAssigned) {
      await refreshOrderSummary(id).catch(() => undefined);
      changed = true;
    } else if (
      row.status === "ordenada" &&
      ownOrderIds.every((orderId) => str(orderById.get(orderId)?.status) === "recibido")
    ) {
      await db
        .from("purchase_requests")
        .update({ status: "recibida", received_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "ordenada");
      await logEvent(
        id,
        "recibida",
        `Almacén recibió ${ownOrderIds.length === 1 ? "la orden de compra" : "las órdenes de compra"} ${ownOrderIds
          .map((orderId) => str(orderById.get(orderId)?.order_number))
          .join(", ")}.`,
        "sistema"
      );
      changed = true;
    }
  }
  return changed;
}

async function hydrate(rows: Row[]): Promise<PurchaseRequest[]> {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [linesRes, eventsRes] = await Promise.all([
    db.from("purchase_request_lines").select("*").in("request_id", ids).order("sort_order", { ascending: true }),
    db.from("purchase_request_events").select("*").in("request_id", ids).order("created_at", { ascending: true }),
  ]);
  if (linesRes.error) throw new Error(linesRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);
  const linesBy = new Map<string, PurchaseRequestLine[]>();
  for (const row of (linesRes.data ?? []) as Row[]) {
    const list = linesBy.get(str(row.request_id)) ?? [];
    list.push(mapLine(row));
    linesBy.set(str(row.request_id), list);
  }
  const eventsBy = new Map<string, PurchaseRequestEvent[]>();
  for (const row of (eventsRes.data ?? []) as Row[]) {
    const list = eventsBy.get(str(row.request_id)) ?? [];
    list.push(mapEvent(row));
    eventsBy.set(str(row.request_id), list);
  }
  return rows.map((row) => mapRequest(row, linesBy.get(str(row.id)) ?? [], eventsBy.get(str(row.id)) ?? []));
}

async function selectRequests(filters?: { requisitionId?: string; id?: string }) {
  let query = db.from("purchase_requests").select("*").order("requested_at", { ascending: false });
  if (filters?.requisitionId) query = query.eq("requisition_id", filters.requisitionId);
  if (filters?.id) query = query.eq("id", filters.id);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

export async function getPurchaseRequests(filters?: { requisitionId?: string }): Promise<PurchaseRequest[]> {
  let rows = await selectRequests(filters);
  if (await syncWithPurchaseOrders(rows)) rows = await selectRequests(filters);
  return hydrate(rows);
}

export async function getPurchaseRequest(id: string): Promise<PurchaseRequest> {
  const [request] = await hydrate(await selectRequests({ id }));
  if (!request) throw new Error("Solicitud de compra no encontrada.");
  return request;
}

async function nextFolio() {
  const prefix = `SC-${new Date().getFullYear()}-`;
  const { data, error } = await db
    .from("purchase_requests")
    .select("folio")
    .like("folio", `${prefix}%`)
    .order("folio", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = str((data as Row[] | null)?.[0]?.folio);
  const seq = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(4, "0")}`;
}

export async function createPurchaseRequest(input: CreatePurchaseRequestInput): Promise<PurchaseRequest> {
  const lines = input.lines.filter((line) => line.quantity > 0 && (line.description.trim() || line.productId));
  if (!lines.length) throw new Error("Agrega al menos un material con cantidad mayor a 0.");
  if (!input.requisitionId && !input.justification.trim()) {
    throw new Error("Explica para qué se necesita la compra.");
  }

  let requisitionFolio = "";
  let serviceOrderId = input.serviceOrderId ?? null;
  let quoteRef: { id: string; folio: string; clientName: string } | null = null;
  if (input.requisitionId) {
    const { data, error } = await db
      .from("service_order_requisitions")
      .select("folio, service_order_id, source_type, quote_id, quote_folio, client_name")
      .eq("id", input.requisitionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("La solicitud de surtimiento ya no existe.");
    requisitionFolio = str(data.folio);
    serviceOrderId = data.service_order_id ? str(data.service_order_id) : serviceOrderId;
    if (data.source_type === "cotizacion") {
      quoteRef = { id: str(data.quote_id), folio: str(data.quote_folio), clientName: str(data.client_name) };
    }
  }

  let order: Row | null = null;
  if (serviceOrderId) {
    const { data } = await db
      .from("service_orders")
      .select("id, folio, client_name, equipment_name")
      .eq("id", serviceOrderId)
      .maybeSingle();
    order = (data as Row | null) ?? null;
  }

  const name = (input.requester.fullName ?? "").trim() || input.requester.username;
  const profile = (await findStaffProfile(name)) ?? (await findStaffProfile(input.requester.username));

  let created: Row | null = null;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    const folio = await nextFolio();
    const { data, error } = await db
      .from("purchase_requests")
      .insert({
        folio,
        status: "pendiente",
        priority: input.priority,
        source: input.requisitionId ? "surtimiento" : "manual",
        requisition_id: input.requisitionId || null,
        requisition_folio: requisitionFolio,
        service_order_id: order ? order.id : null,
        service_order_folio: str(order?.folio),
        client_name: str(order?.client_name) || (quoteRef?.clientName ?? ""),
        equipment_name: str(order?.equipment_name),
        justification: input.justification.trim(),
        needed_by: input.neededBy || null,
        notes: input.notes.trim(),
        requested_by: input.requester.username,
        requester_name: profile?.fullName || name,
        requester_job_title: profile?.jobTitle ?? "",
        requester_department: profile?.department ?? "",
      })
      .select("*")
      .single();
    if (!error) created = data as Row;
    else if (!String(error.message).includes("purchase_requests_folio_key")) throw new Error(error.message);
  }
  if (!created) throw new Error("No se pudo asignar un folio. Intenta de nuevo.");

  const { error: linesError } = await db.from("purchase_request_lines").insert(
    lines.map((line, index) => ({
      request_id: created.id,
      requisition_line_id: line.requisitionLineId || null,
      product_id: line.productId || null,
      product_sku: (line.productSku ?? "").trim(),
      product_name: (line.productName ?? "").trim(),
      description: line.description.trim() || (line.productName ?? "").trim(),
      unit: (line.unit ?? "pza").trim() || "pza",
      quantity: line.quantity,
      stock_at_request: line.stockAtRequest ?? 0,
      notes: (line.notes ?? "").trim(),
      sort_order: index,
    }))
  );
  if (linesError) {
    await db.from("purchase_requests").delete().eq("id", created.id);
    throw new Error(linesError.message);
  }

  const folio = str(created.folio);
  await logEvent(
    str(created.id),
    "solicitud",
    requisitionFolio
      ? `Solicitud de compra por faltantes de ${requisitionFolio} · ${lines.length} material(es).`
      : `Solicitud de compra creada · ${lines.length} material(es).`,
    profile?.fullName || name
  );
  if (order) {
    await db.from("service_order_events").insert({
      service_order_id: order.id,
      event_type: "solicitud_compra",
      message: `Solicitud de compra ${folio}${requisitionFolio ? ` por faltantes de ${requisitionFolio}` : ""}`,
      is_internal: true,
      created_by: input.requester.username,
    });
  }
  if (quoteRef?.id) {
    await db.from("quote_events").insert({
      quote_id: quoteRef.id,
      event_type: "solicitud_compra",
      message: `Compras: solicitud ${folio} por faltantes de ${requisitionFolio}`,
      created_by: input.requester.username,
    });
  }
  return getPurchaseRequest(str(created.id));
}

async function requireStatus(id: string, allowed: PurchaseRequestStatus[], message: string) {
  const request = await getPurchaseRequest(id);
  if (!allowed.includes(request.status)) throw new Error(message);
  return request;
}

export async function takePurchaseRequest(id: string, actor: string, notes = ""): Promise<PurchaseRequest> {
  await requireStatus(id, ["pendiente"], "Solo se pueden tomar solicitudes pendientes.");
  const { error } = await db
    .from("purchase_requests")
    .update({ status: "en_proceso", assigned_to: actor, ...(notes.trim() ? { purchasing_notes: notes.trim() } : {}) })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logEvent(id, "en_proceso", `${actor} tomó la solicitud para cotizar y comprar.`, actor);
  return getPurchaseRequest(id);
}

export async function savePurchasingNotes(id: string, notes: string, actor: string): Promise<PurchaseRequest> {
  const { error } = await db.from("purchase_requests").update({ purchasing_notes: notes.trim() }).eq("id", id);
  if (error) throw new Error(error.message);
  await logEvent(id, "nota", "Se actualizaron las notas de compras.", actor);
  return getPurchaseRequest(id);
}

export async function createPurchaseOrdersFromRequest(
  id: string,
  input: PurchaseOrdersFromRequestInput
): Promise<PurchaseRequest> {
  const request = await requireStatus(
    id,
    ["pendiente", "en_proceso"],
    "Solo se pueden generar órdenes de compra de solicitudes pendientes o en proceso."
  );
  const groups = input.orders.filter((group) => group.lineIds.length > 0);
  if (!groups.length) throw new Error("Asigna un proveedor al menos a un material.");

  const seenLines = new Set<string>();
  const seenSuppliers = new Set<string>();
  for (const group of groups) {
    const supplierName = group.supplierName.trim();
    if (!supplierName) throw new Error("Cada orden de compra necesita un proveedor.");
    const supplierKey = group.supplierId ?? supplierName.toLowerCase();
    if (seenSuppliers.has(supplierKey)) {
      throw new Error(`${supplierName} aparece dos veces; junta sus materiales en una sola orden.`);
    }
    seenSuppliers.add(supplierKey);
    for (const lineId of group.lineIds) {
      const line = request.lines.find((item) => item.id === lineId);
      if (!line) throw new Error("Uno de los materiales ya no existe en la solicitud.");
      const label = line.description || line.productName;
      if (line.purchaseOrderId) throw new Error(`${label} ya tiene orden de compra.`);
      if (seenLines.has(lineId)) throw new Error(`${label} está asignado a dos proveedores.`);
      seenLines.add(lineId);
      const price = input.unitPrices[lineId] ?? 0;
      if (!(price >= 0)) throw new Error(`Precio inválido en ${label}.`);
    }
  }

  const notes = [
    `Solicitud de compra ${request.folio}`,
    request.requisitionFolio && `Surtimiento ${request.requisitionFolio}`,
    request.serviceOrderFolio && `OS ${request.serviceOrderFolio}`,
    input.notes.trim(),
  ]
    .filter(Boolean)
    .join(" · ");

  let createdCount = 0;
  try {
    for (const group of groups) {
      const lines = request.lines.filter((line) => group.lineIds.includes(line.id));
      const order = await createPurchaseOrder({
        supplierId: group.supplierId,
        supplierName: group.supplierName.trim(),
        expectedDate: input.expectedDate,
        notes,
        createdBy: input.actor,
        items: lines.map((line) => ({
          itemId: line.productId,
          itemSku: line.productSku,
          itemName: line.productName || line.description,
          quantity: Math.ceil(line.quantity),
          unitPrice: input.unitPrices[line.id] ?? 0,
        })),
      });
      const { error } = await db
        .from("purchase_request_lines")
        .update({ purchase_order_id: order.id })
        .in("id", group.lineIds);
      if (error) {
        await cancelPurchaseOrder(order.id).catch(() => undefined);
        throw new Error(error.message);
      }
      createdCount += 1;
      await logEvent(
        id,
        "ordenada",
        `Orden de compra ${order.orderNumber} generada con ${order.supplierName} · ${lines.length} material(es).`,
        input.actor
      );
    }
  } finally {
    if (createdCount) {
      await db.from("purchase_requests").update({ assigned_to: request.assignedTo || input.actor }).eq("id", id);
      await refreshOrderSummary(id);
    }
  }
  return getPurchaseRequest(id);
}

export async function markPurchaseRequestReceived(id: string, actor: string, notes = ""): Promise<PurchaseRequest> {
  await requireStatus(id, ["en_proceso", "ordenada"], "Solo se pueden cerrar compras en proceso u ordenadas.");
  const { error } = await db
    .from("purchase_requests")
    .update({ status: "recibida", received_at: new Date().toISOString(), closed_by: actor })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logEvent(id, "recibida", notes.trim() ? `Marcada como recibida: ${notes.trim()}` : "Marcada como recibida.", actor);
  return getPurchaseRequest(id);
}

export async function closePurchaseRequest(
  id: string,
  action: "rechazada" | "cancelada",
  actor: string,
  reason: string
): Promise<PurchaseRequest> {
  const request = await requireStatus(
    id,
    ["pendiente", "en_proceso"],
    "Solo se pueden rechazar o cancelar solicitudes que aún no tienen orden de compra."
  );
  if (request.lines.some((line) => line.purchaseOrderId)) {
    throw new Error("Ya hay órdenes de compra generadas para esta solicitud; cancélalas primero en Órdenes de compra.");
  }
  if (!reason.trim()) throw new Error(action === "rechazada" ? "Indica el motivo del rechazo." : "Indica el motivo de la cancelación.");
  const { error } = await db
    .from("purchase_requests")
    .update({ status: action, closed_by: actor, closed_reason: reason.trim() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logEvent(id, action, `${action === "rechazada" ? "Rechazada" : "Cancelada"}: ${reason.trim()}`, actor);
  return getPurchaseRequest(id);
}

/**
 * Para cada línea con pendiente: cuánto hay disponible en almacén, cuánto ya está en
 * compras abiertas y cuánto falta comprar todavía.
 */
export async function getRequisitionShortages(
  requisition: ServiceOrderRequisition,
  purchases: PurchaseRequest[]
): Promise<RequisitionShortage[]> {
  const inPurchaseByLine = new Map<string, number>();
  for (const purchase of purchases) {
    if (!OPEN_PURCHASE_STATUSES.includes(purchase.status)) continue;
    for (const line of purchase.lines) {
      if (!line.requisitionLineId) continue;
      inPurchaseByLine.set(line.requisitionLineId, (inPurchaseByLine.get(line.requisitionLineId) ?? 0) + line.quantity);
    }
  }
  const pendingLines = requisition.lines.filter((line) => requisitionLinePending(line) > 0);
  const available = await Promise.all(
    pendingLines.map((line) => (line.productId ? getProductAvailableQty(line.productId).catch(() => 0) : 0))
  );
  return pendingLines.map((line, index) => {
    const pending = requisitionLinePending(line);
    const stock = Math.max(0, available[index]);
    const inPurchase = inPurchaseByLine.get(line.id) ?? 0;
    return {
      lineId: line.id,
      productId: line.productId,
      productSku: line.productSku,
      description: line.description || line.productName,
      unit: line.unit,
      pending,
      available: stock,
      inPurchase,
      shortage: Math.max(0, pending - stock - inPurchase),
    };
  });
}
