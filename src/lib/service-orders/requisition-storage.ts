import { supabase } from "@/lib/supabase/client";
import { getProductAvailableQty } from "@/lib/holds/storage";
import {
  applyOutboundStock,
  fulfillmentLotKey,
  listFulfillmentLots,
} from "@/lib/warehouse/stock";
import {
  sameRequester,
  type CreateQuoteRequisitionInput,
  type CreateRequisitionInput,
  type FulfillLineInput,
  type RequisitionFulfillment,
  type RequisitionLineInput,
  type RequisitionLineStatus,
  type RequisitionPriority,
  type RequisitionSource,
  type RequisitionStatus,
  type ServiceOrderRequisition,
  type ServiceOrderRequisitionLine,
} from "./requisitions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function mapLine(
  row: Record<string, unknown>,
  product?: { sku?: string; name?: string; brand?: string; model?: string; partNumber?: string }
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
    productBrand: String(product?.brand ?? "").trim(),
    productModel: String(product?.model ?? "").trim(),
    partNumber: String(product?.partNumber ?? "").trim(),
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
  order?: { folio?: string; client_name?: string; equipment_name?: string; promised_at?: string | null }
): ServiceOrderRequisition {
  const source = row.source_type === "cotizacion" ? "cotizacion" : "orden_servicio";
  const neededBy = row.needed_by ? String(row.needed_by) : "";
  const orderPromise = order?.promised_at ? String(order.promised_at) : "";
  return {
    id: String(row.id),
    folio: String(row.folio),
    sourceType: source as RequisitionSource,
    serviceOrderId: row.service_order_id ? String(row.service_order_id) : null,
    serviceOrderFolio: String(order?.folio ?? row.service_order_folio ?? ""),
    quoteId: row.quote_id ? String(row.quote_id) : null,
    quoteFolio: String(row.quote_folio ?? ""),
    clientName: String(order?.client_name || row.client_name || ""),
    equipmentName: String(order?.equipment_name ?? row.equipment_name ?? ""),
    priority: (row.priority === "urgente" ? "urgente" : "normal") as RequisitionPriority,
    neededBy,
    promisedAt: source === "cotizacion" ? neededBy : orderPromise || neededBy,
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
      .select("*, product:inventory_items(sku, name, brand, model, part_number), quote_line:quote_lines(part_number)")
      .in("requisition_id", ids),
    orderIds.length
      ? db
          .from("service_orders")
          .select("id, folio, client_name, equipment_name, promised_at")
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
    const catalogPart = String(row.product?.part_number ?? "").trim();
    const quotePart = String(row.quote_line?.part_number ?? "").trim();
    list.push(
      mapLine(row, {
        sku: row.product?.sku,
        name: row.product?.name,
        brand: row.product?.brand,
        model: row.product?.model,
        partNumber: catalogPart || quotePart,
      })
    );
    linesBy.set(rid, list);
  }

  return rows.map((row) => {
    const order = orderById.get(String(row.service_order_id));
    return mapRequisition(row, linesBy.get(String(row.id)) ?? [], order);
  });
}

export type RequisitionOriginDetails = {
  sourceType: RequisitionSource;
  folio: string;
  title: string;
  serviceType: string;
  priority: string;
  clientName: string;
  contactName: string;
  contactPhone: string;
  address: string;
  city: string;
  state: string;
  promisedAt: string;
  promiseLabel: string;
  equipmentName: string;
  equipmentBrand: string;
  equipmentModel: string;
  equipmentSerial: string;
  equipmentLocation: string;
  faultReported: string;
  technician: string;
  advisor: string;
  salesperson: string;
};

function embeddedRecord(value: unknown): Record<string, unknown> {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" ? (row as Record<string, unknown>) : {};
}

/** Equipo a la izquierda y cliente, dirección, estado y fecha promesa a la derecha. */
export async function getRequisitionOriginDetails(
  requisition: Pick<
    ServiceOrderRequisition,
    | "sourceType"
    | "serviceOrderId"
    | "serviceOrderFolio"
    | "quoteId"
    | "quoteFolio"
    | "clientName"
    | "equipmentName"
    | "neededBy"
    | "deliveryAddress"
  >
): Promise<RequisitionOriginDetails> {
  const empty: RequisitionOriginDetails = {
    sourceType: requisition.sourceType,
    folio:
      requisition.sourceType === "cotizacion"
        ? requisition.quoteFolio
        : requisition.serviceOrderFolio,
    title: "",
    serviceType: "",
    priority: "",
    clientName: requisition.clientName,
    contactName: "",
    contactPhone: "",
    address: requisition.deliveryAddress,
    city: "",
    state: "",
    promisedAt: requisition.sourceType === "cotizacion" ? requisition.neededBy : "",
    promiseLabel: requisition.sourceType === "cotizacion" ? "Fecha requerida" : "Fecha promesa",
    equipmentName: requisition.equipmentName,
    equipmentBrand: "",
    equipmentModel: "",
    equipmentSerial: "",
    equipmentLocation: "",
    faultReported: "",
    technician: "",
    advisor: "",
    salesperson: "",
  };

  if (requisition.sourceType === "cotizacion") {
    if (!requisition.quoteId) return empty;
    const { data, error } = await db
      .from("quotes")
      .select(
        "folio, title, client_name, contact_name, contact_phone, city, state, salesperson, client:clients(address, city, state)"
      )
      .eq("id", requisition.quoteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = (data ?? {}) as Record<string, unknown>;
    const client = embeddedRecord(row.client);
    return {
      ...empty,
      folio: String(row.folio ?? empty.folio),
      title: String(row.title ?? ""),
      clientName: String(row.client_name || empty.clientName),
      contactName: String(row.contact_name ?? ""),
      contactPhone: String(row.contact_phone ?? ""),
      address: String(client.address || requisition.deliveryAddress || ""),
      city: String(client.city || row.city || ""),
      state: String(client.state || row.state || ""),
      salesperson: String(row.salesperson ?? ""),
    };
  }

  if (!requisition.serviceOrderId) return empty;
  const { data, error } = await db
    .from("service_orders")
    .select(
      "folio, priority, service_type, client_name, contact_name, contact_phone, equipment_name, equipment_brand, equipment_model, equipment_serial, equipment_location, technician, advisor, promised_at, fault_reported, client:clients(address, city, state)"
    )
    .eq("id", requisition.serviceOrderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  const client = embeddedRecord(row.client);
  return {
    ...empty,
    folio: String(row.folio ?? empty.folio),
    serviceType: String(row.service_type ?? ""),
    priority: String(row.priority ?? ""),
    clientName: String(row.client_name || empty.clientName),
    contactName: String(row.contact_name ?? ""),
    contactPhone: String(row.contact_phone ?? ""),
    address: String(client.address ?? ""),
    city: String(client.city ?? ""),
    state: String(client.state ?? ""),
    promisedAt: row.promised_at ? String(row.promised_at) : "",
    equipmentName: String(row.equipment_name || empty.equipmentName),
    equipmentBrand: String(row.equipment_brand ?? ""),
    equipmentModel: String(row.equipment_model ?? ""),
    equipmentSerial: String(row.equipment_serial ?? ""),
    equipmentLocation: String(row.equipment_location ?? ""),
    faultReported: String(row.fault_reported ?? ""),
    technician: String(row.technician ?? ""),
    advisor: String(row.advisor ?? ""),
  };
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

type ChosenLotDemand = {
  productId: string;
  quantity: number;
  lotNumber: string;
  expiryDate: string;
  label: string;
};

function slicesForFulfillment(item: FulfillLineInput) {
  const listed = (item.lots ?? []).filter((slice) => Number(slice.quantity) > 0);
  if (listed.length) return listed;
  if (!item.lotSpecified || !(Number(item.quantity) > 0)) return [];
  return [
    {
      lotNumber: item.lotNumber ?? "",
      expiryDate: item.expiryDate ?? "",
      quantity: Number(item.quantity),
    },
  ];
}

function lotSliceNote(slice: { lotNumber: string; expiryDate: string; quantity: number }) {
  const when = slice.expiryDate ? ` · caduca ${slice.expiryDate.slice(0, 10)}` : "";
  return `Lote ${slice.lotNumber.trim() || "sin número"}${when} · ${slice.quantity}`;
}

function chosenLotDemands(
  lines: ServiceOrderRequisitionLine[],
  fulfillments: FulfillLineInput[]
): ChosenLotDemand[] {
  return fulfillments.flatMap((item) => {
    const line = lines.find((entry) => entry.id === item.lineId);
    if (!line?.productId) return [];
    return slicesForFulfillment(item).map((slice) => ({
      productId: line.productId as string,
      quantity: Number(slice.quantity),
      lotNumber: slice.lotNumber ?? "",
      expiryDate: slice.expiryDate ?? "",
      label: line.productSku || line.description,
    }));
  });
}

async function assertChosenLots(items: ChosenLotDemand[]) {
  if (!items.length) return;
  const lots = await listFulfillmentLots(items.map((item) => item.productId));
  const demand = new Map<string, ChosenLotDemand>();
  for (const item of items) {
    const lot = {
      lotNumber: item.lotNumber.trim(),
      expiryDate: item.expiryDate.slice(0, 10),
    };
    const key = `${item.productId}\t${fulfillmentLotKey(lot)}`;
    const prev = demand.get(key);
    if (prev) prev.quantity += item.quantity;
    else demand.set(key, { ...item, ...lot });
  }
  for (const need of demand.values()) {
    const match = (lots.get(need.productId) ?? []).find(
      (option) => fulfillmentLotKey(option) === fulfillmentLotKey(need)
    );
    const available = match?.available ?? 0;
    if (need.quantity > available + 0.0001) {
      const lotLabel = need.lotNumber || "sin número";
      const when = need.expiryDate ? ` con caducidad ${need.expiryDate}` : "";
      throw new Error(
        `El lote ${lotLabel}${when} de ${need.label} solo tiene ${available} disponibles. Elige otro lote o reduce la cantidad.`
      );
    }
  }
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
  await assertChosenLots(chosenLotDemands(req.lines, toFulfill));
  for (const item of toFulfill) {
    const line = req.lines.find((l) => l.id === item.lineId)!;
    const slices = slicesForFulfillment(item);
    if (line.productId) {
      const note = [req.folio, fromQuote ? req.quoteFolio : req.serviceOrderFolio, fromQuote ? req.clientName : "", line.description]
        .filter(Boolean)
        .join(" · ");
      const reason = fromQuote ? "Surtido a venta (cotización)" : "Surtido a orden de servicio";
      if (slices.length) {
        const covered = slices.reduce((sum, slice) => sum + Number(slice.quantity), 0);
        if (Math.abs(covered - Number(item.quantity)) > 0.0001) {
          throw new Error(
            `Los lotes de ${line.productSku || line.description} no cubren la cantidad a surtir.`
          );
        }
        for (const slice of slices) {
          await applyOutboundStock({
            productId: line.productId,
            quantity: slice.quantity,
            createdBy: fulfilledBy,
            reason,
            note,
            preferredLot: { lotNumber: slice.lotNumber, expiryDate: slice.expiryDate },
          });
        }
      } else {
        await applyOutboundStock({
          productId: line.productId,
          quantity: item.quantity,
          createdBy: fulfilledBy,
          reason,
          note,
        });
      }
    }

    const lotNote = slices.map(lotSliceNote).join("; ");
    await db.from("service_order_requisition_fulfillments").insert({
      requisition_id: req.id,
      line_id: line.id,
      quantity: Number(item.quantity),
      fulfilled_by: fulfilledBy.trim(),
      notes: [
        line.productId ? "" : "Entrega directa fuera de catálogo (sin inventario)",
        lotNote,
        warehouseNotes.trim(),
      ]
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

export type RequisitionFulfillJob = {
  requisitionId: string;
  fulfillments: FulfillLineInput[];
};

/**
 * Surte varias solicitudes de la misma persona en un solo paso
 * (aunque vengan de órdenes o cotizaciones distintas).
 */
export async function fulfillServiceOrderRequisitions(
  jobs: RequisitionFulfillJob[],
  fulfilledBy: string,
  warehouseNotes = ""
): Promise<ServiceOrderRequisition[]> {
  const nonempty = jobs
    .map((job) => ({
      ...job,
      fulfillments: job.fulfillments.filter((item) => Number(item.quantity) > 0),
    }))
    .filter((job) => job.fulfillments.length > 0);
  if (!nonempty.length) {
    throw new Error("Indica al menos una cantidad a surtir.");
  }
  if (nonempty.length === 1) {
    return [
      await fulfillServiceOrderRequisition(
        nonempty[0].requisitionId,
        nonempty[0].fulfillments,
        fulfilledBy,
        warehouseNotes
      ),
    ];
  }

  const list = await getServiceOrderRequisitions();
  const needed = new Map<string, { quantity: number; label: string }>();
  const lotDemands: ChosenLotDemand[] = [];
  let requester = "";
  for (const job of nonempty) {
    const req = list.find((item) => item.id === job.requisitionId);
    if (!req) throw new Error("Solicitud no encontrada.");
    if (req.status === "cancelada" || req.status === "surtida") {
      throw new Error(`${req.folio} ya no se puede surtir.`);
    }
    if (!requester) requester = req.requestedBy;
    else if (!sameRequester(req.requestedBy, requester)) {
      throw new Error(
        "Solo puedes surtir juntas solicitudes de la misma persona, aunque sean de distintas órdenes."
      );
    }
    for (const item of job.fulfillments) {
      const line = req.lines.find((entry) => entry.id === item.lineId);
      if (!line) throw new Error(`Línea no encontrada en ${req.folio}.`);
      const remaining = Math.max(0, line.quantityRequested - line.quantityFulfilled);
      if (item.quantity > remaining + 0.0001) {
        throw new Error(
          `No puedes surtir más de lo pendiente en ${line.description} (${req.folio}).`
        );
      }
      if (!line.productId) continue;
      const prev = needed.get(line.productId) ?? {
        quantity: 0,
        label: line.productSku || line.description,
      };
      needed.set(line.productId, {
        quantity: prev.quantity + Number(item.quantity),
        label: prev.label,
      });
    }
    lotDemands.push(...chosenLotDemands(req.lines, job.fulfillments));
  }
  await assertChosenLots(lotDemands);

  for (const [productId, info] of needed) {
    const available = await getProductAvailableQty(productId);
    if (info.quantity > available) {
      throw new Error(
        `Stock insuficiente para ${info.label}. Se necesitan ${info.quantity} entre las solicitudes juntas. Disponible: ${available}.`
      );
    }
  }

  const results: ServiceOrderRequisition[] = [];
  for (const job of nonempty) {
    results.push(
      await fulfillServiceOrderRequisition(
        job.requisitionId,
        job.fulfillments,
        fulfilledBy,
        warehouseNotes
      )
    );
  }
  return results;
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
