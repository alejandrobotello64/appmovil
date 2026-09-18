import { supabase } from "@/lib/supabase/client";
import {
  computeQuoteTotals,
  quoteStatusLabel,
  type Quote,
  type QuoteEvent,
  type QuoteInput,
  type QuoteLine,
  type QuoteLineInput,
  type QuoteStatus,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function dateOrEmpty(value: unknown) {
  return value ? String(value).slice(0, 10) : "";
}

function mapLine(
  row: Record<string, unknown>,
  product?: { sku?: string; name?: string }
): QuoteLine {
  return {
    id: String(row.id),
    quoteId: String(row.quote_id),
    productId: row.product_id ? String(row.product_id) : null,
    productSku: String(product?.sku ?? ""),
    productName: String(product?.name ?? ""),
    description: String(row.description ?? ""),
    quantity: Number(row.quantity ?? 0),
    unit: String(row.unit ?? "pza"),
    unitPrice: Number(row.unit_price ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
    notes: String(row.notes ?? ""),
  };
}

function mapEvent(row: Record<string, unknown>): QuoteEvent {
  return {
    id: String(row.id),
    quoteId: String(row.quote_id),
    eventType: String(row.event_type ?? "nota"),
    message: String(row.message ?? ""),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at),
  };
}

function mapQuote(
  row: Record<string, unknown>,
  lines: QuoteLine[],
  events: QuoteEvent[]
): Quote {
  return {
    id: String(row.id),
    folio: String(row.folio),
    title: String(row.title ?? ""),
    clientId: row.client_id ? String(row.client_id) : null,
    clientName: String(row.client_name ?? ""),
    contactName: String(row.contact_name ?? ""),
    contactEmail: String(row.contact_email ?? ""),
    contactPhone: String(row.contact_phone ?? ""),
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    status: String(row.status ?? "borrador") as QuoteStatus,
    quoteDate: dateOrEmpty(row.quote_date),
    validUntil: dateOrEmpty(row.valid_until),
    nextFollowUp: dateOrEmpty(row.next_follow_up),
    lastContactAt: dateOrEmpty(row.last_contact_at),
    currency: String(row.currency ?? "MXN"),
    subtotal: Number(row.subtotal ?? 0),
    taxRate: Number(row.tax_rate ?? 16),
    taxAmount: Number(row.tax_amount ?? 0),
    total: Number(row.total ?? 0),
    discount: Number(row.discount ?? 0),
    salesperson: String(row.salesperson ?? ""),
    probability: Number(row.probability ?? 0),
    notes: String(row.notes ?? ""),
    lossReason: String(row.loss_reason ?? ""),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lines,
    events,
  };
}

async function nextFolio() {
  const year = new Date().getFullYear();
  const prefix = `COT-${year}-`;
  const { data, error } = await db
    .from("quotes")
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
  quoteId: string,
  message: string,
  createdBy: string,
  eventType = "nota"
) {
  const { error } = await db.from("quote_events").insert({
    quote_id: quoteId,
    event_type: eventType,
    message,
    created_by: createdBy,
  });
  if (error) throw new Error(error.message);
}

function linePayload(quoteId: string, line: QuoteLineInput, index: number) {
  return {
    quote_id: quoteId,
    product_id: line.productId || null,
    description: line.description.trim(),
    quantity: Number(line.quantity),
    unit: (line.unit ?? "pza").trim() || "pza",
    unit_price: Number(line.unitPrice),
    sort_order: index,
    notes: (line.notes ?? "").trim(),
  };
}

function payloadFromInput(input: QuoteInput, lines: QuoteLineInput[]) {
  const totals = computeQuoteTotals(
    lines,
    input.discount ?? 0,
    input.taxRate ?? 16
  );
  return {
    title: (input.title ?? "").trim(),
    client_id: input.clientId || null,
    client_name: (input.clientName ?? "").trim(),
    contact_name: (input.contactName ?? "").trim(),
    contact_email: (input.contactEmail ?? "").trim(),
    contact_phone: (input.contactPhone ?? "").trim(),
    city: (input.city ?? "").trim(),
    state: (input.state ?? "").trim(),
    status: input.status ?? "borrador",
    quote_date: input.quoteDate || new Date().toISOString().slice(0, 10),
    valid_until: input.validUntil || null,
    next_follow_up: input.nextFollowUp || null,
    last_contact_at: input.lastContactAt || null,
    tax_rate: Number(input.taxRate ?? 16),
    discount: Number(input.discount ?? 0),
    subtotal: totals.subtotal,
    tax_amount: totals.taxAmount,
    total: totals.total,
    salesperson: (input.salesperson ?? "").trim(),
    probability: Math.min(100, Math.max(0, Number(input.probability ?? 50))),
    notes: (input.notes ?? "").trim(),
    loss_reason: (input.lossReason ?? "").trim(),
  };
}

export async function getQuotes(): Promise<Quote[]> {
  const { data: rows, error } = await db
    .from("quotes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const quoteRows = rows ?? [];
  if (!quoteRows.length) return [];

  const ids = quoteRows.map((row: Record<string, unknown>) => row.id);
  const [linesRes, eventsRes] = await Promise.all([
    db
      .from("quote_lines")
      .select("*, product:inventory_items(sku, name)")
      .in("quote_id", ids)
      .order("sort_order", { ascending: true }),
    db
      .from("quote_events")
      .select("*")
      .in("quote_id", ids)
      .order("created_at", { ascending: false }),
  ]);
  if (linesRes.error) throw new Error(linesRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  const linesBy = new Map<string, QuoteLine[]>();
  for (const row of linesRes.data ?? []) {
    const quoteId = String(row.quote_id);
    const list = linesBy.get(quoteId) ?? [];
    list.push(
      mapLine(row, { sku: row.product?.sku, name: row.product?.name })
    );
    linesBy.set(quoteId, list);
  }

  const eventsBy = new Map<string, QuoteEvent[]>();
  for (const row of eventsRes.data ?? []) {
    const quoteId = String(row.quote_id);
    const list = eventsBy.get(quoteId) ?? [];
    list.push(mapEvent(row));
    eventsBy.set(quoteId, list);
  }

  return quoteRows.map((row: Record<string, unknown>) =>
    mapQuote(
      row,
      linesBy.get(String(row.id)) ?? [],
      eventsBy.get(String(row.id)) ?? []
    )
  );
}

export async function getQuote(id: string): Promise<Quote | null> {
  const rows = await getQuotes();
  return rows.find((item) => item.id === id) ?? null;
}

export async function createQuote(input: QuoteInput): Promise<Quote> {
  const lines = (input.lines ?? []).filter(
    (line) => line.description.trim() && line.quantity > 0
  );
  if (!input.clientName?.trim() && !input.clientId) {
    throw new Error("Indica el cliente de la cotización.");
  }
  if (!lines.length) {
    throw new Error("Agrega al menos una partida.");
  }

  const folio = await nextFolio();
  const createdBy = (input.createdBy ?? "").trim();
  const { data, error } = await db
    .from("quotes")
    .insert({
      folio,
      ...payloadFromInput(input, lines),
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const { error: linesError } = await db
    .from("quote_lines")
    .insert(lines.map((line, index) => linePayload(data.id, line, index)));
  if (linesError) {
    await db.from("quotes").delete().eq("id", data.id);
    throw new Error(linesError.message);
  }

  await addEvent(data.id, `Cotización ${folio} creada`, createdBy, "creacion");
  const created = await getQuote(data.id);
  if (!created) throw new Error("No se pudo recargar la cotización.");
  return created;
}

export async function updateQuote(
  id: string,
  input: QuoteInput
): Promise<Quote> {
  const current = await getQuote(id);
  if (!current) throw new Error("Cotización no encontrada.");

  const lines = (input.lines ?? []).filter(
    (line) => line.description.trim() && line.quantity > 0
  );
  if (!lines.length) throw new Error("Agrega al menos una partida.");

  const { error } = await db
    .from("quotes")
    .update({
      ...payloadFromInput(input, lines),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const { error: delError } = await db
    .from("quote_lines")
    .delete()
    .eq("quote_id", id);
  if (delError) throw new Error(delError.message);

  const { error: linesError } = await db
    .from("quote_lines")
    .insert(lines.map((line, index) => linePayload(id, line, index)));
  if (linesError) throw new Error(linesError.message);

  if (input.status && input.status !== current.status) {
    await addEvent(
      id,
      `Estatus: ${quoteStatusLabel(current.status)} → ${quoteStatusLabel(input.status)}`,
      input.createdBy ?? "",
      "estatus"
    );
  }

  const updated = await getQuote(id);
  if (!updated) throw new Error("No se pudo recargar la cotización.");
  return updated;
}

export async function setQuoteStatus(
  id: string,
  status: QuoteStatus,
  createdBy = "",
  lossReason = ""
): Promise<void> {
  const current = await getQuote(id);
  if (!current) throw new Error("Cotización no encontrada.");
  if (current.status === status) return;

  const { error } = await db
    .from("quotes")
    .update({
      status,
      loss_reason:
        status === "rechazada" || status === "cancelada"
          ? lossReason || current.lossReason
          : current.lossReason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await addEvent(
    id,
    `Estatus: ${quoteStatusLabel(current.status)} → ${quoteStatusLabel(status)}`,
    createdBy,
    "estatus"
  );
}

export async function addQuoteFollowUp(input: {
  quoteId: string;
  message: string;
  nextFollowUp?: string;
  createdBy?: string;
}): Promise<void> {
  if (!input.message.trim()) throw new Error("Escribe el seguimiento.");
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await db
    .from("quotes")
    .update({
      last_contact_at: today,
      next_follow_up: input.nextFollowUp || null,
      status: "en_seguimiento",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.quoteId);
  if (error) throw new Error(error.message);

  await addEvent(
    input.quoteId,
    input.message.trim(),
    input.createdBy ?? "",
    "seguimiento"
  );
}

export async function deleteQuote(id: string): Promise<void> {
  const { error } = await db.from("quotes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
