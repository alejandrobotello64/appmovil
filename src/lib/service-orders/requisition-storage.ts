import { supabase } from "@/lib/supabase/client";
import { getProductAvailableQty } from "@/lib/holds/storage";
import { applyStockMovement } from "@/lib/warehouse/stock";
import type {
  CreateRequisitionInput,
  FulfillLineInput,
  RequisitionLineStatus,
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
    productId: String(row.product_id),
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
    serviceOrderId: String(row.service_order_id),
    serviceOrderFolio: String(order?.folio ?? row.service_order_folio ?? ""),
    clientName: String(order?.client_name ?? row.client_name ?? ""),
    equipmentName: String(order?.equipment_name ?? row.equipment_name ?? ""),
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

async function nextRequisitionFolio() {
  const year = new Date().getFullYear();
  const prefix = `SOL-OS-${year}-`;
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
    ...new Set(rows.map((r) => String(r.service_order_id)).filter(Boolean)),
  ];

  const [linesRes, ordersRes] = await Promise.all([
    db
      .from("service_order_requisition_lines")
      .select("*, product:inventory_items(sku, name)")
      .in("requisition_id", ids),
    db
      .from("service_orders")
      .select("id, folio, client_name, equipment_name")
      .in("id", orderIds),
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
}): Promise<ServiceOrderRequisition[]> {
  let query = db
    .from("service_order_requisitions")
    .select("*")
    .order("requested_at", { ascending: false });

  if (filters?.serviceOrderId) {
    query = query.eq("service_order_id", filters.serviceOrderId);
  }
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

export async function createServiceOrderRequisition(
  input: CreateRequisitionInput
): Promise<ServiceOrderRequisition> {
  if (!input.lines.length) {
    throw new Error("Selecciona al menos un artículo del catálogo para solicitar.");
  }

  for (const line of input.lines) {
    if (!line.productId) {
      throw new Error("Cada línea de solicitud debe venir del catálogo de almacén.");
    }
    if (!(Number(line.quantity) > 0)) {
      throw new Error("La cantidad solicitada debe ser mayor a 0.");
    }
  }

  const { data: order, error: orderError } = await db
    .from("service_orders")
    .select("id, folio")
    .eq("id", input.serviceOrderId)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message);
  if (!order) throw new Error("Orden de servicio no encontrada.");

  const folio = await nextRequisitionFolio();
  const { data: req, error } = await db
    .from("service_order_requisitions")
    .insert({
      folio,
      service_order_id: input.serviceOrderId,
      status: "solicitada",
      requested_by: input.requestedBy.trim(),
      notes: (input.notes ?? "").trim(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const { error: linesError } = await db
    .from("service_order_requisition_lines")
    .insert(
      input.lines.map((line) => ({
        requisition_id: req.id,
        service_order_line_id: line.serviceOrderLineId || null,
        product_id: line.productId,
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

  const lineIds = input.lines
    .map((l) => l.serviceOrderLineId)
    .filter(Boolean) as string[];
  if (lineIds.length) {
    await db
      .from("service_order_lines")
      .update({ line_status: "solicitado" })
      .in("id", lineIds);
  }

  await db.from("service_order_events").insert({
    service_order_id: input.serviceOrderId,
    event_type: "solicitud_almacen",
    message: `Solicitud a almacén ${folio} · ${input.lines.length} línea(s)`,
    is_internal: true,
    created_by: input.requestedBy.trim(),
  });

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
    const available = await getProductAvailableQty(line.productId);
    if (item.quantity > available) {
      throw new Error(
        `Stock insuficiente para ${line.productSku || line.description}. Disponible: ${available}.`
      );
    }
  }

  for (const item of toFulfill) {
    const line = req.lines.find((l) => l.id === item.lineId)!;
    await applyStockMovement({
      productId: line.productId,
      movementType: "salida",
      quantity: item.quantity,
      createdBy: fulfilledBy,
      reason: "Surtido a orden de servicio",
      note: `${req.folio} · ${req.serviceOrderFolio} · ${line.description}`,
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

  await db.from("service_order_events").insert({
    service_order_id: req.serviceOrderId,
    event_type: "surtido_almacen",
    message: `Almacén surtió ${req.folio} · estatus ${nextStatus}`,
    is_internal: true,
    created_by: fulfilledBy.trim(),
  });

  const all = await getServiceOrderRequisitions();
  const found = all.find((r) => r.id === requisitionId);
  if (!found) throw new Error("No se pudo recargar la solicitud.");
  return found;
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

  await db.from("service_order_events").insert({
    service_order_id: req.serviceOrderId,
    event_type: "solicitud_cancelada",
    message: `Solicitud ${req.folio} cancelada`,
    is_internal: true,
    created_by: cancelledBy.trim(),
  });
}
