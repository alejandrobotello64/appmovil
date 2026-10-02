import { supabase } from "@/lib/supabase/client";
import { staffDisplayName } from "@/lib/users/staff";
import {
  expenseKindMeta,
  formatMoney,
  reportTitle,
  statusMeta,
  type ExpenseCategoryId,
  type ExpenseItem,
  type ExpenseItemInput,
  type ExpenseKind,
  type ExpenseReport,
  type ExpenseReportEvent,
  type ExpenseReportInput,
  type ExpenseStatus,
  type PaymentMethod,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const BUCKET = "expense-receipts";

type Row = Record<string, unknown>;

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const num = (value: unknown) => Number(value ?? 0) || 0;
const dateOnly = (value: unknown) => (value ? String(value).slice(0, 10) : "");
const cents = (value: number) => Math.round((value || 0) * 100) / 100;

function mapItem(row: Row): ExpenseItem {
  return {
    id: str(row.id),
    reportId: str(row.report_id),
    expenseDate: dateOnly(row.expense_date),
    category: (str(row.category) || "otros") as ExpenseCategoryId,
    concept: str(row.concept),
    supplierName: str(row.supplier_name),
    supplierRfc: str(row.supplier_rfc),
    invoiceNumber: str(row.invoice_number),
    cfdiUuid: str(row.cfdi_uuid),
    subtotal: num(row.subtotal),
    tax: num(row.tax),
    total: num(row.total),
    paymentMethod: (str(row.payment_method) || "efectivo") as PaymentMethod,
    pdfPath: str(row.pdf_path),
    pdfUrl: str(row.pdf_url),
    xmlPath: str(row.xml_path),
    xmlUrl: str(row.xml_url),
    notes: str(row.notes),
    createdBy: str(row.created_by),
    createdAt: str(row.created_at),
  };
}

function mapEvent(row: Row): ExpenseReportEvent {
  return {
    id: str(row.id),
    reportId: str(row.report_id),
    eventType: str(row.event_type),
    message: str(row.message),
    createdBy: str(row.created_by),
    createdAt: str(row.created_at),
  };
}

function mapReport(
  row: Row,
  items: ExpenseItem[] = [],
  events: ExpenseReportEvent[] = []
): ExpenseReport {
  return {
    id: str(row.id),
    folio: str(row.folio),
    kind: (str(row.kind) || "viaticos") as ExpenseKind,
    title: str(row.title),
    employeeName: str(row.employee_name),
    employeeUsername: str(row.employee_username),
    department: str(row.department),
    purpose: str(row.purpose),
    destination: str(row.destination),
    clientName: str(row.client_name),
    startDate: dateOnly(row.start_date),
    endDate: dateOnly(row.end_date),
    advanceAmount: num(row.advance_amount),
    status: (str(row.status) || "en_captura") as ExpenseStatus,
    reviewedBy: str(row.reviewed_by),
    reviewedAt: str(row.reviewed_at),
    reviewNotes: str(row.review_notes),
    notes: str(row.notes),
    createdBy: str(row.created_by),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    items,
    events,
  };
}

function reportPayload(input: ExpenseReportInput) {
  const meta = expenseKindMeta(input.kind);
  const employeeName = input.employeeName.trim();
  if (!employeeName) throw new Error("Indica el colaborador responsable.");
  if (meta.isTrip && !input.destination.trim()) throw new Error("Indica el destino del viaje.");
  if (!meta.isTrip && !input.title.trim()) throw new Error("Escribe un título para el registro.");
  if (!input.startDate || !input.endDate) throw new Error("Indica las fechas o el periodo.");
  if (input.endDate < input.startDate) {
    throw new Error("La fecha final no puede ser anterior a la inicial.");
  }
  if (!(input.advanceAmount >= 0)) throw new Error("El anticipo no puede ser negativo.");
  return {
    kind: input.kind,
    title: input.title.trim(),
    employee_name: employeeName,
    employee_username: input.employeeUsername.trim(),
    department: input.department.trim(),
    purpose: input.purpose.trim(),
    destination: meta.isTrip ? input.destination.trim() : "",
    client_name: input.clientName.trim(),
    start_date: input.startDate,
    end_date: input.endDate,
    advance_amount: meta.advanceLabel ? cents(input.advanceAmount) : 0,
    notes: input.notes.trim(),
  };
}

export type ExpenseEmployee = { username: string; fullName: string; department: string };

export async function listExpenseEmployees(): Promise<ExpenseEmployee[]> {
  const { data, error } = await supabase.rpc("list_app_users");
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((row) => row.is_active)
    .map((row) => ({
      username: row.username,
      fullName: staffDisplayName(row.full_name, row.username),
      department: row.department ?? "",
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));
}

async function logEvent(reportId: string, eventType: string, message: string, actor: string) {
  const { error } = await db
    .from("expense_report_events")
    .insert({ report_id: reportId, event_type: eventType, message, created_by: actor });
  if (error) throw new Error(error.message);
}

export type ExpenseReportFilters = {
  kind?: ExpenseKind;
  /** Registros cuyo periodo se traslapa con [from, to]. */
  from?: string;
  to?: string;
  ids?: string[];
};

export async function getExpenseReports(
  filters: ExpenseReportFilters = {}
): Promise<ExpenseReport[]> {
  if (filters.ids && filters.ids.length === 0) return [];
  let query = db.from("expense_reports").select("*").order("start_date", { ascending: false });
  if (filters.ids) query = query.in("id", filters.ids);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.from) query = query.gte("end_date", filters.from);
  if (filters.to) query = query.lte("start_date", filters.to);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];

  const ids = rows.map((row) => str(row.id));
  const [itemsRes, eventsRes] = await Promise.all([
    db
      .from("expense_items")
      .select("*")
      .in("report_id", ids)
      .order("expense_date", { ascending: true })
      .order("created_at", { ascending: true }),
    db
      .from("expense_report_events")
      .select("*")
      .in("report_id", ids)
      .order("created_at", { ascending: true }),
  ]);
  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  const items = ((itemsRes.data ?? []) as Row[]).map(mapItem);
  const events = ((eventsRes.data ?? []) as Row[]).map(mapEvent);
  return rows.map((row) => {
    const id = str(row.id);
    return mapReport(
      row,
      items.filter((item) => item.reportId === id),
      events.filter((event) => event.reportId === id)
    );
  });
}

export async function getExpenseReport(id: string): Promise<ExpenseReport | null> {
  return (await getExpenseReports({ ids: [id] }))[0] ?? null;
}

export async function createExpenseReport(
  input: ExpenseReportInput,
  actor: string
): Promise<ExpenseReport> {
  const { data, error } = await db
    .from("expense_reports")
    .insert({ ...reportPayload(input), created_by: actor })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const report = mapReport(data as Row);
  const advance =
    report.advanceAmount > 0
      ? ` con ${expenseKindMeta(report.kind).advanceLabel.toLowerCase()} de ${formatMoney(report.advanceAmount)}`
      : "";
  await logEvent(report.id, "creado", `${reportTitle(report)} registrado${advance}.`, actor);
  return (await getExpenseReport(report.id)) ?? report;
}

export async function updateExpenseReport(id: string, input: ExpenseReportInput, actor: string) {
  const { error } = await db.from("expense_reports").update(reportPayload(input)).eq("id", id);
  if (error) throw new Error(error.message);
  await logEvent(id, "editado", "Datos generales actualizados.", actor);
}

const STATUS_EVENTS: Partial<Record<ExpenseStatus, string>> = {
  por_revisar: "Comprobación enviada a revisión.",
  aprobado: "Comprobación aprobada.",
  rechazado: "Comprobación rechazada; regresa a captura.",
  cerrado: "Registro cerrado (saldo liquidado).",
  cancelado: "Registro cancelado.",
  en_captura: "Registro reabierto para captura.",
};

export async function setExpenseReportStatus(
  report: ExpenseReport,
  status: ExpenseStatus,
  actor: string,
  notes = ""
) {
  if (status === "por_revisar" && report.items.length === 0) {
    throw new Error("Captura al menos un gasto antes de enviar a revisión.");
  }
  if (status === "rechazado" && !notes.trim()) {
    throw new Error("Indica el motivo del rechazo.");
  }
  const patch: Row = { status };
  if (status === "aprobado" || status === "rechazado") {
    patch.reviewed_by = actor;
    patch.reviewed_at = new Date().toISOString();
    patch.review_notes = notes.trim();
  }
  const { error } = await db.from("expense_reports").update(patch).eq("id", report.id);
  if (error) throw new Error(error.message);
  const base = STATUS_EVENTS[status] ?? `Estatus: ${statusMeta(status).label}.`;
  await logEvent(report.id, status, notes.trim() ? `${base} ${notes.trim()}` : base, actor);
}

export async function deleteExpenseReport(report: ExpenseReport) {
  const paths = report.items.flatMap((item) => [item.pdfPath, item.xmlPath]).filter(Boolean);
  const { error } = await db.from("expense_reports").delete().eq("id", report.id);
  if (error) throw new Error(error.message);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}

async function uploadReceipt(reportId: string, file: File) {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${reportId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

function itemPayload(input: ExpenseItemInput) {
  if (!input.expenseDate) throw new Error("Indica la fecha del gasto.");
  if (!(input.total > 0)) throw new Error("Captura el total del gasto.");
  if (!input.concept.trim() && !input.supplierName.trim()) {
    throw new Error("Describe el concepto o el proveedor del gasto.");
  }
  return {
    expense_date: input.expenseDate,
    category: input.category,
    concept: input.concept.trim(),
    supplier_name: input.supplierName.trim(),
    supplier_rfc: input.supplierRfc.trim().toUpperCase(),
    invoice_number: input.invoiceNumber.trim(),
    cfdi_uuid: input.cfdiUuid.trim().toUpperCase(),
    subtotal: cents(input.subtotal),
    tax: cents(input.tax),
    total: cents(input.total),
    payment_method: input.paymentMethod,
    notes: input.notes.trim(),
  };
}

function saveError(error: { message?: string }) {
  return String(error.message ?? "").includes("expense_items_uuid_key")
    ? new Error("Esa factura (UUID) ya está registrada en otro gasto.")
    : new Error(String(error.message ?? "No se pudo guardar el gasto."));
}

export async function addExpenseItem(
  reportId: string,
  input: ExpenseItemInput,
  actor: string
): Promise<ExpenseItem> {
  const payload = itemPayload(input);
  const uploaded: string[] = [];
  try {
    const pdf = input.pdfFile ? await uploadReceipt(reportId, input.pdfFile) : null;
    if (pdf) uploaded.push(pdf.path);
    const xml = input.xmlFile ? await uploadReceipt(reportId, input.xmlFile) : null;
    if (xml) uploaded.push(xml.path);

    const { data, error } = await db
      .from("expense_items")
      .insert({
        ...payload,
        report_id: reportId,
        pdf_path: pdf?.path ?? "",
        pdf_url: pdf?.url ?? "",
        xml_path: xml?.path ?? "",
        xml_url: xml?.url ?? "",
        created_by: actor,
      })
      .select("*")
      .single();
    if (error) throw saveError(error);
    return mapItem(data as Row);
  } catch (err) {
    if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
    throw err;
  }
}

export async function updateExpenseItem(item: ExpenseItem, input: ExpenseItemInput) {
  const payload: Row = itemPayload(input);
  const uploaded: string[] = [];
  const replaced: string[] = [];
  try {
    if (input.pdfFile) {
      const pdf = await uploadReceipt(item.reportId, input.pdfFile);
      uploaded.push(pdf.path);
      payload.pdf_path = pdf.path;
      payload.pdf_url = pdf.url;
      if (item.pdfPath) replaced.push(item.pdfPath);
    }
    if (input.xmlFile) {
      const xml = await uploadReceipt(item.reportId, input.xmlFile);
      uploaded.push(xml.path);
      payload.xml_path = xml.path;
      payload.xml_url = xml.url;
      if (item.xmlPath) replaced.push(item.xmlPath);
    }
    const { error } = await db.from("expense_items").update(payload).eq("id", item.id);
    if (error) throw saveError(error);
  } catch (err) {
    if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
    throw err;
  }
  if (replaced.length) await supabase.storage.from(BUCKET).remove(replaced);
}

export async function deleteExpenseItem(item: ExpenseItem) {
  const { error } = await db.from("expense_items").delete().eq("id", item.id);
  if (error) throw new Error(error.message);
  const paths = [item.pdfPath, item.xmlPath].filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}
