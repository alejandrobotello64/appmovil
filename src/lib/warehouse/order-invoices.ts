import { supabase } from "@/lib/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const BUCKET = "purchase-invoices";

type Row = Record<string, unknown>;

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));

export type PurchaseOrderInvoice = {
  id: string;
  orderId: string;
  invoiceNumber: string;
  cfdiUuid: string;
  issuerRfc: string;
  issuerName: string;
  invoiceDate: string;
  subtotal: number;
  total: number;
  currency: string;
  pdfPath: string;
  pdfUrl: string;
  xmlPath: string;
  xmlUrl: string;
  notes: string;
  uploadedBy: string;
  createdAt: string;
};

export type PurchaseOrderInvoiceInput = {
  orderId: string;
  invoiceNumber: string;
  cfdiUuid: string;
  issuerRfc: string;
  issuerName: string;
  invoiceDate: string;
  subtotal: number;
  total: number;
  currency: string;
  notes: string;
  uploadedBy: string;
  pdfFile?: File | null;
  xmlFile?: File | null;
};

/** Datos que se pueden leer del XML de un CFDI 3.3 / 4.0. */
export type CfdiData = {
  invoiceNumber: string;
  cfdiUuid: string;
  issuerRfc: string;
  issuerName: string;
  invoiceDate: string;
  subtotal: number;
  total: number;
  currency: string;
};

export function mapInvoice(row: Row): PurchaseOrderInvoice {
  return {
    id: str(row.id),
    orderId: str(row.order_id),
    invoiceNumber: str(row.invoice_number),
    cfdiUuid: str(row.cfdi_uuid),
    issuerRfc: str(row.issuer_rfc),
    issuerName: str(row.issuer_name),
    invoiceDate: str(row.invoice_date),
    subtotal: Number(row.subtotal ?? 0) || 0,
    total: Number(row.total ?? 0) || 0,
    currency: str(row.currency) || "MXN",
    pdfPath: str(row.pdf_path),
    pdfUrl: str(row.pdf_url),
    xmlPath: str(row.xml_path),
    xmlUrl: str(row.xml_url),
    notes: str(row.notes),
    uploadedBy: str(row.uploaded_by),
    createdAt: str(row.created_at),
  };
}

export async function getPurchaseOrderInvoices(orderIds?: string[]): Promise<PurchaseOrderInvoice[]> {
  if (orderIds && orderIds.length === 0) return [];
  let query = db.from("purchase_order_invoices").select("*").order("created_at", { ascending: true });
  if (orderIds) query = query.in("order_id", orderIds);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(mapInvoice);
}

function firstByLocalName(doc: Document, name: string) {
  return doc.getElementsByTagNameNS("*", name)[0] ?? null;
}

function attr(element: Element | null, ...names: string[]) {
  if (!element) return "";
  for (const name of names) {
    const value = element.getAttribute(name);
    if (value) return value.trim();
  }
  return "";
}

export function parseCfdiXml(xml: string): CfdiData {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("El archivo XML no es válido.");
  }
  const comprobante = firstByLocalName(doc, "Comprobante");
  if (!comprobante) throw new Error("El XML no parece un CFDI (falta el nodo Comprobante).");
  const emisor = firstByLocalName(doc, "Emisor");
  const timbre = firstByLocalName(doc, "TimbreFiscalDigital");
  const serie = attr(comprobante, "Serie", "serie");
  const folio = attr(comprobante, "Folio", "folio");
  return {
    invoiceNumber: [serie, folio].filter(Boolean).join("-"),
    cfdiUuid: attr(timbre, "UUID").toUpperCase(),
    issuerRfc: attr(emisor, "Rfc", "rfc").toUpperCase(),
    issuerName: attr(emisor, "Nombre", "nombre"),
    invoiceDate: attr(comprobante, "Fecha", "fecha").slice(0, 10),
    subtotal: Number(attr(comprobante, "SubTotal", "subTotal")) || 0,
    total: Number(attr(comprobante, "Total", "total")) || 0,
    currency: attr(comprobante, "Moneda", "moneda") || "MXN",
  };
}

async function uploadFile(orderId: string, file: File) {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${orderId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export async function addPurchaseOrderInvoice(input: PurchaseOrderInvoiceInput): Promise<PurchaseOrderInvoice> {
  const invoiceNumber = input.invoiceNumber.trim();
  const cfdiUuid = input.cfdiUuid.trim().toUpperCase();
  if (!invoiceNumber && !cfdiUuid) throw new Error("Captura el folio o el UUID de la factura.");
  if (!(input.total > 0)) throw new Error("Captura el total de la factura.");
  if (!input.pdfFile && !input.xmlFile) throw new Error("Adjunta el PDF o el XML de la factura.");

  const uploaded: string[] = [];
  try {
    const pdf = input.pdfFile ? await uploadFile(input.orderId, input.pdfFile) : null;
    if (pdf) uploaded.push(pdf.path);
    const xml = input.xmlFile ? await uploadFile(input.orderId, input.xmlFile) : null;
    if (xml) uploaded.push(xml.path);

    const { data, error } = await db
      .from("purchase_order_invoices")
      .insert({
        order_id: input.orderId,
        invoice_number: invoiceNumber,
        cfdi_uuid: cfdiUuid,
        issuer_rfc: input.issuerRfc.trim().toUpperCase(),
        issuer_name: input.issuerName.trim(),
        invoice_date: input.invoiceDate || null,
        subtotal: input.subtotal || 0,
        total: input.total,
        currency: input.currency.trim().toUpperCase() || "MXN",
        pdf_path: pdf?.path ?? "",
        pdf_url: pdf?.url ?? "",
        xml_path: xml?.path ?? "",
        xml_url: xml?.url ?? "",
        notes: input.notes.trim(),
        uploaded_by: input.uploadedBy,
      })
      .select("*")
      .single();
    if (error) {
      if (String(error.message).includes("purchase_order_invoices_uuid_key")) {
        throw new Error("Esa factura (UUID) ya está registrada en otra orden de compra.");
      }
      throw new Error(error.message);
    }
    return mapInvoice(data as Row);
  } catch (err) {
    if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
    throw err;
  }
}

export async function deletePurchaseOrderInvoice(invoice: PurchaseOrderInvoice): Promise<void> {
  const { error } = await db.from("purchase_order_invoices").delete().eq("id", invoice.id);
  if (error) throw new Error(error.message);
  const paths = [invoice.pdfPath, invoice.xmlPath].filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}
