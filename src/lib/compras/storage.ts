import { supabase } from "@/lib/supabase/client";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/lib/warehouse/orders";
import type {
  CreatePurchaseRequestInput,
  PurchaseRequest,
  PurchaseRequestLine,
  PurchaseRequestReason,
  PurchaseRequestSource,
  PurchaseRequestStatus,
} from "./types";
import { isOpenPurchaseRequest } from "./types";

const LOCAL_KEY = "mas.purchase-requests.v1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

let useLocal: boolean | null = null;

type LocalBundle = { requests: PurchaseRequest[] };

function isMissingRelation(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const text = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    text.includes("does not exist") ||
    text.includes("could not find the table") ||
    text.includes("schema cache")
  );
}

function isMissingColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const text = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    (text.includes("column") && text.includes("does not exist")) ||
    (text.includes("could not find the") && text.includes("column"))
  );
}

function readLocal(): PurchaseRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalBundle | PurchaseRequest[];
    return Array.isArray(parsed) ? parsed : parsed.requests ?? [];
  } catch {
    return [];
  }
}

function writeLocal(rows: PurchaseRequest[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify({ requests: rows }));
}

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

/** La nube guarda el estatus histórico. La pantalla usa los nombres actuales. */
const STORED_STATUS_TO_APP: Record<string, PurchaseRequestStatus> = {
  pendiente: "solicitada",
  en_proceso: "en_compra",
  ordenada: "pedida",
  solicitada: "solicitada",
  en_compra: "en_compra",
  pedida: "pedida",
  parcial: "parcial",
  recibida: "recibida",
  cancelada: "cancelada",
  rechazada: "rechazada",
};

const APP_STATUS_TO_STORED: Record<string, string> = {
  solicitada: "pendiente",
  en_compra: "en_proceso",
  pedida: "ordenada",
  parcial: "en_proceso",
  recibida: "recibida",
  cancelada: "cancelada",
  rechazada: "rechazada",
};

function fromStoredStatus(value: unknown): PurchaseRequestStatus {
  const status = text(value);
  return STORED_STATUS_TO_APP[status] ?? "solicitada";
}

function toStoredStatus(status: string) {
  return APP_STATUS_TO_STORED[status] ?? status;
}

function storedSource(sourceType: string) {
  return sourceType === "manual" ? "manual" : "surtimiento";
}

function mapLine(row: Record<string, unknown>): PurchaseRequestLine {
  const requested = row.quantity_requested ?? row.quantity ?? 0;
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    sourceLineId: row.source_line_id
      ? String(row.source_line_id)
      : row.requisition_line_id
        ? String(row.requisition_line_id)
        : null,
    productId: row.product_id ? String(row.product_id) : null,
    productSku: text(row.product_sku),
    productName: text(row.product_name) || text(row.description),
    quantityRequested: Number(requested),
    quantityOrdered: Number(row.quantity_ordered ?? 0),
    quantityReceived: Number(row.quantity_received ?? 0),
    unit: text(row.unit) || "pza",
    notes: text(row.notes),
  };
}

function mapRequest(
  row: Record<string, unknown>,
  lines: PurchaseRequestLine[]
): PurchaseRequest {
  const storedSourceType = text(row.source_type);
  const legacySource = text(row.source);
  const sourceType = (
    storedSourceType && storedSourceType !== "manual"
      ? storedSourceType
      : legacySource && legacySource !== "manual"
        ? legacySource
        : storedSourceType || legacySource || "manual"
  ) as PurchaseRequestSource;
  const sourceId = row.source_id || row.requisition_id || row.service_order_id || null;
  const sourceFolio =
    text(row.source_folio) || text(row.requisition_folio) || text(row.service_order_folio);
  return {
    id: String(row.id),
    folio: String(row.folio),
    status: fromStoredStatus(row.status),
    sourceType,
    sourceId: sourceId ? String(sourceId) : null,
    sourceFolio,
    reason: (text(row.reason) || "no_surtible") as PurchaseRequestReason,
    requestedBy: text(row.requested_by),
    requestedAt: String(row.requested_at ?? row.created_at ?? ""),
    takenBy: text(row.taken_by) || text(row.assigned_to),
    takenAt: row.taken_at ? String(row.taken_at) : "",
    warehouseNotes: text(row.warehouse_notes) || text(row.notes) || text(row.justification),
    comprasNotes: text(row.compras_notes) || text(row.purchasing_notes),
    purchaseOrderId: row.purchase_order_id ? String(row.purchase_order_id) : null,
    purchaseOrderNumber: text(row.purchase_order_number),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    lines,
  };
}

function nextLocalFolio(existing: PurchaseRequest[]) {
  const year = new Date().getFullYear();
  const prefix = `SC-${year}-`;
  let max = 0;
  for (const row of existing) {
    if (!row.folio.startsWith(prefix)) continue;
    const seq = Number(row.folio.slice(prefix.length));
    if (Number.isFinite(seq) && seq > max) max = seq;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

async function nextRemoteFolio() {
  const year = new Date().getFullYear();
  const prefix = `SC-${year}-`;
  const { data, error } = await db
    .from("purchase_requests")
    .select("folio")
    .like("folio", `${prefix}%`)
    .order("folio", { ascending: false })
    .limit(1);
  if (error) {
    if (isMissingRelation(error)) {
      useLocal = true;
      return nextLocalFolio(readLocal());
    }
    throw new Error(error.message);
  }
  const last = data?.[0]?.folio as string | undefined;
  const seq = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(4, "0")}`;
}

function validateInput(input: CreatePurchaseRequestInput) {
  const lines = input.lines.filter((line) => line.quantity > 0);
  if (lines.length === 0) {
    throw new Error("Agrega al menos un producto a la solicitud de compra.");
  }
  return lines;
}

async function hydrateRemote(
  rows: Record<string, unknown>[]
): Promise<PurchaseRequest[]> {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const { data, error } = await db
    .from("purchase_request_lines")
    .select("*")
    .in("request_id", ids);
  if (error) throw new Error(error.message);
  const lines = ((data ?? []) as Record<string, unknown>[]).map(mapLine);
  return rows.map((row) =>
    mapRequest(
      row,
      lines.filter((line) => line.requestId === String(row.id))
    )
  );
}

export async function getPurchaseRequests(): Promise<PurchaseRequest[]> {
  if (useLocal) {
    return readLocal().sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }

  const { data, error } = await db
    .from("purchase_requests")
    .select("*")
    .order("requested_at", { ascending: false });

  if (error) {
    if (isMissingRelation(error)) {
      useLocal = true;
      return readLocal().sort((a, b) =>
        b.requestedAt.localeCompare(a.requestedAt)
      );
    }
    throw new Error(error.message);
  }

  useLocal = false;
  return hydrateRemote((data ?? []) as Record<string, unknown>[]);
}

export async function getPurchaseRequest(
  id: string
): Promise<PurchaseRequest | null> {
  const list = await getPurchaseRequests();
  return list.find((item) => item.id === id) ?? null;
}

export async function getOpenPurchaseRequestsForSource(
  sourceType: PurchaseRequestSource,
  sourceId: string
): Promise<PurchaseRequest[]> {
  const list = await getPurchaseRequests();
  return list.filter(
    (item) =>
      item.sourceType === sourceType &&
      item.sourceId === sourceId &&
      isOpenPurchaseRequest(item.status)
  );
}

export async function createPurchaseRequest(
  input: CreatePurchaseRequestInput
): Promise<PurchaseRequest> {
  const lines = validateInput(input);
  const stamp = nowIso();

  if (useLocal !== false) {
    if (useLocal === null) {
      const probe = await db.from("purchase_requests").select("id").limit(1);
      if (probe.error && isMissingRelation(probe.error)) {
        useLocal = true;
      } else if (probe.error) {
        throw new Error(probe.error.message);
      } else {
        useLocal = false;
      }
    }
  }

  if (useLocal) {
    const existing = readLocal();
    const id = newId();
    const request: PurchaseRequest = {
      id,
      folio: nextLocalFolio(existing),
      status: "solicitada",
      sourceType: input.sourceType ?? "manual",
      sourceId: input.sourceId ?? null,
      sourceFolio: input.sourceFolio ?? "",
      reason: input.reason ?? "no_surtible",
      requestedBy: input.requestedBy,
      requestedAt: stamp,
      takenBy: "",
      takenAt: "",
      warehouseNotes: input.warehouseNotes ?? "",
      comprasNotes: "",
      purchaseOrderId: null,
      purchaseOrderNumber: "",
      createdAt: stamp,
      updatedAt: stamp,
      lines: lines.map((line) => ({
        id: newId(),
        requestId: id,
        sourceLineId: line.sourceLineId ?? null,
        productId: line.productId,
        productSku: line.productSku,
        productName: line.productName,
        quantityRequested: line.quantity,
        quantityOrdered: 0,
        quantityReceived: 0,
        unit: line.unit ?? "pza",
        notes: line.notes ?? "",
      })),
    };
    writeLocal([request, ...existing]);
    return request;
  }

  const folio = await nextRemoteFolio();
  const sourceType = input.sourceType ?? "manual";
  const sourceId = input.sourceId ?? null;
  const sourceFolio = input.sourceFolio ?? "";
  const warehouseNotes = input.warehouseNotes ?? "";
  const fullHeader = {
    folio,
    status: toStoredStatus("solicitada"),
    source: storedSource(sourceType),
    source_type: sourceType,
    source_id: sourceId,
    source_folio: sourceFolio,
    requisition_id: sourceType === "requisicion_os" ? sourceId : null,
    requisition_folio: sourceType === "requisicion_os" ? sourceFolio : "",
    reason: input.reason ?? "no_surtible",
    requested_by: input.requestedBy,
    notes: warehouseNotes,
    justification: warehouseNotes,
    warehouse_notes: warehouseNotes,
  };
  const stubHeader = {
    folio,
    status: toStoredStatus("solicitada"),
    source: storedSource(sourceType),
    requisition_id: sourceType === "requisicion_os" ? sourceId : null,
    requisition_folio: sourceType === "requisicion_os" ? sourceFolio : "",
    requested_by: input.requestedBy,
    notes: warehouseNotes,
    justification: warehouseNotes,
  };

  let headerInsert = await db
    .from("purchase_requests")
    .insert(fullHeader)
    .select("*")
    .single();

  if (headerInsert.error && isMissingColumn(headerInsert.error)) {
    headerInsert = await db
      .from("purchase_requests")
      .insert(stubHeader)
      .select("*")
      .single();
  }

  if (headerInsert.error) {
    if (isMissingRelation(headerInsert.error)) {
      useLocal = true;
      return createPurchaseRequest(input);
    }
    throw new Error(headerInsert.error.message);
  }

  const header = headerInsert.data;
  const fullLines = lines.map((line, index) => ({
    request_id: header.id,
    source_line_id: line.sourceLineId ?? null,
    requisition_line_id: sourceType === "requisicion_os" ? line.sourceLineId ?? null : null,
    product_id: line.productId,
    product_sku: line.productSku,
    product_name: line.productName,
    description: line.productName,
    quantity: line.quantity,
    quantity_requested: line.quantity,
    unit: line.unit ?? "pza",
    notes: line.notes ?? "",
    sort_order: index,
  }));
  const stubLines = lines.map((line, index) => ({
    request_id: header.id,
    requisition_line_id: sourceType === "requisicion_os" ? line.sourceLineId ?? null : null,
    product_id: line.productId,
    product_sku: line.productSku,
    product_name: line.productName,
    description: line.productName,
    quantity: line.quantity,
    unit: line.unit ?? "pza",
    notes: line.notes ?? "",
    sort_order: index,
  }));

  let linesInsert = await db
    .from("purchase_request_lines")
    .insert(fullLines)
    .select("*");

  if (linesInsert.error && isMissingColumn(linesInsert.error)) {
    linesInsert = await db
      .from("purchase_request_lines")
      .insert(stubLines)
      .select("*");
  }

  if (linesInsert.error) throw new Error(linesInsert.error.message);
  return mapRequest(
    header,
    ((linesInsert.data ?? []) as Record<string, unknown>[]).map(mapLine)
  );
}

async function patchRequest(
  id: string,
  patch: Partial<PurchaseRequest>,
  linePatch?: (lines: PurchaseRequestLine[]) => PurchaseRequestLine[]
): Promise<PurchaseRequest> {
  const current = await getPurchaseRequest(id);
  if (!current) throw new Error("Solicitud de compra no encontrada.");
  const stamp = nowIso();
  const next: PurchaseRequest = {
    ...current,
    ...patch,
    lines: linePatch ? linePatch(current.lines) : current.lines,
    updatedAt: stamp,
  };

  if (useLocal) {
    writeLocal(
      readLocal().map((item) => (item.id === id ? next : item))
    );
    return next;
  }

  const fullPatch = {
    status: toStoredStatus(next.status),
    taken_by: next.takenBy,
    taken_at: next.takenAt || null,
    warehouse_notes: next.warehouseNotes,
    compras_notes: next.comprasNotes,
    notes: next.warehouseNotes,
    justification: next.warehouseNotes,
    purchasing_notes: next.comprasNotes,
    purchase_order_id: next.purchaseOrderId,
    purchase_order_number: next.purchaseOrderNumber,
  };
  const stubPatch = {
    status: toStoredStatus(next.status),
    notes: next.warehouseNotes,
    justification: next.warehouseNotes,
    purchasing_notes: next.comprasNotes,
    purchase_order_id: next.purchaseOrderId,
    purchase_order_number: next.purchaseOrderNumber,
  };

  let updated = await db
    .from("purchase_requests")
    .update(fullPatch)
    .eq("id", id)
    .select("*")
    .single();
  if (updated.error && isMissingColumn(updated.error)) {
    updated = await db
      .from("purchase_requests")
      .update(stubPatch)
      .eq("id", id)
      .select("*")
      .single();
  }
  if (updated.error) throw new Error(updated.error.message);

  if (linePatch) {
    for (const line of next.lines) {
      let lineUpdate = await db
        .from("purchase_request_lines")
        .update({
          quantity_ordered: line.quantityOrdered,
          quantity_received: line.quantityReceived,
          notes: line.notes,
        })
        .eq("id", line.id);
      if (lineUpdate.error && isMissingColumn(lineUpdate.error)) {
        lineUpdate = await db
          .from("purchase_request_lines")
          .update({ notes: line.notes })
          .eq("id", line.id);
      }
      if (lineUpdate.error) throw new Error(lineUpdate.error.message);
    }
  }

  return mapRequest(updated.data, next.lines);
}

export async function takePurchaseRequest(
  id: string,
  actor: string,
  comprasNotes?: string
): Promise<PurchaseRequest> {
  const current = await getPurchaseRequest(id);
  if (!current) throw new Error("Solicitud de compra no encontrada.");
  if (current.status === "cancelada" || current.status === "recibida") {
    throw new Error("Esta solicitud ya está cerrada.");
  }
  return patchRequest(id, {
    status: current.status === "solicitada" ? "en_compra" : current.status,
    takenBy: actor,
    takenAt: current.takenAt || nowIso(),
    comprasNotes: comprasNotes ?? current.comprasNotes,
  });
}

export async function cancelPurchaseRequest(
  id: string,
  actor: string
): Promise<PurchaseRequest> {
  const current = await getPurchaseRequest(id);
  if (!current) throw new Error("Solicitud de compra no encontrada.");
  if (current.status === "recibida") {
    throw new Error("No se puede cancelar una solicitud ya recibida.");
  }
  return patchRequest(id, {
    status: "cancelada",
    comprasNotes: current.comprasNotes
      ? current.comprasNotes
      : `Cancelada por ${actor}`,
  });
}

export async function updatePurchaseRequestNotes(
  id: string,
  notes: { warehouseNotes?: string; comprasNotes?: string }
): Promise<PurchaseRequest> {
  const current = await getPurchaseRequest(id);
  if (!current) throw new Error("Solicitud de compra no encontrada.");
  return patchRequest(id, {
    warehouseNotes: notes.warehouseNotes ?? current.warehouseNotes,
    comprasNotes: notes.comprasNotes ?? current.comprasNotes,
  });
}

export async function linkPurchaseRequestToOrder(
  requestId: string,
  orderId: string,
  orderNumber: string
): Promise<PurchaseRequest> {
  const current = await getPurchaseRequest(requestId);
  if (!current) throw new Error("Solicitud de compra no encontrada.");
  return patchRequest(
    requestId,
    {
      status: "pedida",
      purchaseOrderId: orderId,
      purchaseOrderNumber: orderNumber,
      takenAt: current.takenAt || nowIso(),
    },
    (lines) =>
      lines.map((line) => ({
        ...line,
        quantityOrdered: Math.max(line.quantityOrdered, line.quantityRequested),
      }))
  );
}

export async function createPurchaseOrderFromRequest(
  requestId: string,
  actor: string,
  extra?: {
    supplierId?: string | null;
    supplierName?: string;
    expectedDate?: string;
    notes?: string;
    items?: Array<{
      itemId: string | null;
      itemSku: string;
      itemName: string;
      quantity: number;
      unitPrice: number;
    }>;
  }
): Promise<{ order: PurchaseOrder; request: PurchaseRequest }> {
  const request = await getPurchaseRequest(requestId);
  if (!request) throw new Error("Solicitud de compra no encontrada.");
  if (request.status === "cancelada" || request.status === "recibida") {
    throw new Error("No se puede generar un pedido desde esta solicitud.");
  }
  if (request.purchaseOrderId) {
    throw new Error(
      `Esta solicitud ya tiene el pedido ${request.purchaseOrderNumber || "vinculado"}.`
    );
  }

  const { createPurchaseOrder } = await import("@/lib/warehouse/orders");
  const items =
    extra?.items ??
    request.lines.map((line) => ({
      itemId: line.productId,
      itemSku: line.productSku,
      itemName: line.productName,
      quantity: line.quantityRequested,
      unitPrice: 0,
    }));

  const order = await createPurchaseOrder({
    supplierId: extra?.supplierId ?? null,
    supplierName: extra?.supplierName ?? "Por asignar",
    expectedDate: extra?.expectedDate ?? "",
    notes: [extra?.notes, `Solicitud ${request.folio}`]
      .filter(Boolean)
      .join(" · "),
    createdBy: actor,
    items,
  });

  const linked = await linkPurchaseRequestToOrder(
    request.id,
    order.id,
    order.orderNumber
  );
  return { order, request: linked };
}

export async function syncPurchaseRequestForOrder(
  orderId: string,
  status: PurchaseOrderStatus,
  items?: Array<{
    itemId: string | null;
    itemSku: string;
    receivedQuantity: number;
  }>
): Promise<void> {
  const list = await getPurchaseRequests();
  const matches = list.filter((item) => item.purchaseOrderId === orderId);
  if (matches.length === 0) return;

  const nextStatus: PurchaseRequestStatus | null =
    status === "recibido"
      ? "recibida"
      : status === "parcial"
        ? "parcial"
        : status === "cancelado"
          ? "cancelada"
          : status === "enviado"
            ? "pedida"
            : null;

  for (const request of matches) {
    await patchRequest(
      request.id,
      nextStatus ? { status: nextStatus } : {},
      items
        ? (lines) =>
            lines.map((line) => {
              const match = items.find(
                (item) =>
                  (line.productId && item.itemId === line.productId) ||
                  item.itemSku === line.productSku
              );
              return match
                ? { ...line, quantityReceived: match.receivedQuantity }
                : line;
            })
        : undefined
    );
  }
}
