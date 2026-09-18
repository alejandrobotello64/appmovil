import { supabase } from "@/lib/supabase/client";
import { createInventoryHold } from "@/lib/holds/storage";
import type { InventoryHold } from "@/lib/holds/types";
import type {
  Tender,
  TenderDocument,
  TenderDocType,
  TenderEvent,
  TenderInput,
  TenderLine,
  TenderLineInput,
  TenderStatus,
} from "./types";
import { tenderStatusLabel } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function dateOrEmpty(value: unknown) {
  return value ? String(value).slice(0, 10) : "";
}

function mapLine(
  row: Record<string, unknown>,
  product?: { sku?: string; name?: string }
): TenderLine {
  return {
    id: String(row.id),
    tenderId: String(row.tender_id),
    clavePartida: String(row.clave_partida ?? ""),
    descripcion: String(row.descripcion ?? ""),
    productId: row.product_id ? String(row.product_id) : null,
    productSku: String(product?.sku ?? row.product_sku ?? ""),
    productName: String(product?.name ?? row.product_name ?? ""),
    quantity: Number(row.quantity ?? 0),
    unit: String(row.unit ?? "pza"),
    unitPrice: Number(row.unit_price ?? 0),
    cumpleEspec: String(row.cumple_espec ?? "si") as TenderLine["cumpleEspec"],
    notaTecnica: String(row.nota_tecnica ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapEvent(row: Record<string, unknown>): TenderEvent {
  return {
    id: String(row.id),
    tenderId: String(row.tender_id),
    eventType: String(row.event_type ?? "nota"),
    message: String(row.message ?? ""),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at),
  };
}

function mapDocument(row: Record<string, unknown>): TenderDocument {
  return {
    id: String(row.id),
    tenderId: String(row.tender_id),
    docType: String(row.doc_type ?? "otro") as TenderDocType,
    name: String(row.name ?? ""),
    filePath: String(row.file_path ?? ""),
    fileUrl: String(row.file_url ?? ""),
    notes: String(row.notes ?? ""),
    uploadedBy: String(row.uploaded_by ?? ""),
    createdAt: String(row.created_at),
  };
}

function mapTender(
  row: Record<string, unknown>,
  lines: TenderLine[],
  events: TenderEvent[],
  documents: TenderDocument[]
): Tender {
  return {
    id: String(row.id),
    folioInterno: String(row.folio_interno),
    folioComprasmx: String(row.folio_comprasmx ?? ""),
    urlComprasmx: String(row.url_comprasmx ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    convocante: String(row.convocante ?? ""),
    clientId: row.client_id ? String(row.client_id) : null,
    state: String(row.state ?? ""),
    city: String(row.city ?? ""),
    procedimiento: String(row.procedimiento ?? "LP") as Tender["procedimiento"],
    caracter: String(row.caracter ?? "federal") as Tender["caracter"],
    status: String(row.status ?? "prospecto") as TenderStatus,
    publishedAt: dateOrEmpty(row.published_at),
    juntaAclaraciones: dateOrEmpty(row.junta_aclaraciones),
    limitePreguntas: dateOrEmpty(row.limite_preguntas),
    limitePropuestas: dateOrEmpty(row.limite_propuestas),
    falloAt: dateOrEmpty(row.fallo_at),
    firmaAt: dateOrEmpty(row.firma_at),
    montoEstimado: Number(row.monto_estimado ?? 0),
    montoOfertado: Number(row.monto_ofertado ?? 0),
    moneda: String(row.moneda ?? "MXN"),
    responsableNombre: String(row.responsable_nombre ?? ""),
    probabilidad: Number(row.probabilidad ?? 0),
    notes: String(row.notes ?? ""),
    holdId: row.hold_id ? String(row.hold_id) : null,
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lines,
    events,
    documents,
  };
}

async function nextFolioInterno() {
  const year = new Date().getFullYear();
  const prefix = `LIC-${year}-`;
  const { data, error } = await db
    .from("tenders")
    .select("folio_interno")
    .like("folio_interno", `${prefix}%`)
    .order("folio_interno", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = data?.[0]?.folio_interno as string | undefined;
  const seq = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(4, "0")}`;
}

async function addEvent(
  tenderId: string,
  message: string,
  createdBy: string,
  eventType = "nota"
) {
  const { error } = await db.from("tender_events").insert({
    tender_id: tenderId,
    event_type: eventType,
    message,
    created_by: createdBy,
  });
  if (error) throw new Error(error.message);
}

function payloadFromInput(input: TenderInput) {
  return {
    folio_comprasmx: input.folioComprasmx.trim(),
    url_comprasmx: (input.urlComprasmx ?? "").trim(),
    title: input.title.trim(),
    description: (input.description ?? "").trim(),
    convocante: (input.convocante ?? "").trim(),
    client_id: input.clientId || null,
    state: (input.state ?? "").trim(),
    city: (input.city ?? "").trim(),
    procedimiento: input.procedimiento ?? "LP",
    caracter: input.caracter ?? "federal",
    status: input.status ?? "prospecto",
    published_at: input.publishedAt || null,
    junta_aclaraciones: input.juntaAclaraciones || null,
    limite_preguntas: input.limitePreguntas || null,
    limite_propuestas: input.limitePropuestas || null,
    fallo_at: input.falloAt || null,
    firma_at: input.firmaAt || null,
    monto_estimado: Number(input.montoEstimado ?? 0),
    monto_ofertado: Number(input.montoOfertado ?? 0),
    responsable_nombre: (input.responsableNombre ?? "").trim(),
    probabilidad: Math.min(100, Math.max(0, Number(input.probabilidad ?? 0))),
    notes: (input.notes ?? "").trim(),
  };
}

function linePayload(tenderId: string, line: TenderLineInput, index: number) {
  return {
    tender_id: tenderId,
    clave_partida: (line.clavePartida ?? "").trim(),
    descripcion: line.descripcion.trim(),
    product_id: line.productId || null,
    quantity: Number(line.quantity),
    unit: (line.unit ?? "pza").trim() || "pza",
    unit_price: Number(line.unitPrice),
    cumple_espec: line.cumpleEspec ?? "si",
    nota_tecnica: (line.notaTecnica ?? "").trim(),
    sort_order: index,
  };
}

export async function getTenders(): Promise<Tender[]> {
  const { data: rows, error } = await db
    .from("tenders")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const tenderRows = rows ?? [];
  if (tenderRows.length === 0) return [];

  const ids = tenderRows.map((row: Record<string, unknown>) => row.id);

  const [linesRes, eventsRes, docsRes] = await Promise.all([
    db
      .from("tender_lines")
      .select("*, product:inventory_items(sku, name)")
      .in("tender_id", ids)
      .order("sort_order", { ascending: true }),
    db
      .from("tender_events")
      .select("*")
      .in("tender_id", ids)
      .order("created_at", { ascending: false }),
    db
      .from("tender_documents")
      .select("*")
      .in("tender_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  if (linesRes.error) throw new Error(linesRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);
  if (docsRes.error) throw new Error(docsRes.error.message);

  const linesBy = new Map<string, TenderLine[]>();
  for (const row of linesRes.data ?? []) {
    const tenderId = String(row.tender_id);
    const list = linesBy.get(tenderId) ?? [];
    list.push(
      mapLine(row, {
        sku: row.product?.sku,
        name: row.product?.name,
      })
    );
    linesBy.set(tenderId, list);
  }

  const eventsBy = new Map<string, TenderEvent[]>();
  for (const row of eventsRes.data ?? []) {
    const tenderId = String(row.tender_id);
    const list = eventsBy.get(tenderId) ?? [];
    list.push(mapEvent(row));
    eventsBy.set(tenderId, list);
  }

  const docsBy = new Map<string, TenderDocument[]>();
  for (const row of docsRes.data ?? []) {
    const tenderId = String(row.tender_id);
    const list = docsBy.get(tenderId) ?? [];
    list.push(mapDocument(row));
    docsBy.set(tenderId, list);
  }

  return tenderRows.map((row: Record<string, unknown>) =>
    mapTender(
      row,
      linesBy.get(String(row.id)) ?? [],
      eventsBy.get(String(row.id)) ?? [],
      docsBy.get(String(row.id)) ?? []
    )
  );
}

export async function getTender(id: string): Promise<Tender | null> {
  const rows = await getTenders();
  return rows.find((item) => item.id === id) ?? null;
}

export async function createTender(input: TenderInput): Promise<Tender> {
  if (!input.title.trim()) throw new Error("El título es obligatorio.");
  if (!input.folioComprasmx.trim()) {
    throw new Error("El folio CompraMX es obligatorio.");
  }

  const folio = await nextFolioInterno();
  const createdBy = (input.createdBy ?? "").trim();
  const { data, error } = await db
    .from("tenders")
    .insert({
      folio_interno: folio,
      ...payloadFromInput(input),
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const lines = input.lines ?? [];
  if (lines.length) {
    const { error: linesError } = await db
      .from("tender_lines")
      .insert(lines.map((line, index) => linePayload(data.id, line, index)));
    if (linesError) throw new Error(linesError.message);
  }

  await addEvent(
    data.id,
    `Licitación creada · ${folio}`,
    createdBy,
    "creacion"
  );

  const created = await getTender(data.id);
  if (!created) throw new Error("No se pudo recargar la licitación.");
  return created;
}

export async function updateTender(
  id: string,
  input: TenderInput
): Promise<Tender> {
  if (!input.title.trim()) throw new Error("El título es obligatorio.");
  if (!input.folioComprasmx.trim()) {
    throw new Error("El folio CompraMX es obligatorio.");
  }

  const current = await getTender(id);
  if (!current) throw new Error("Licitación no encontrada.");

  const { error } = await db
    .from("tenders")
    .update({
      ...payloadFromInput(input),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (input.status && input.status !== current.status) {
    await addEvent(
      id,
      `Estatus: ${tenderStatusLabel(current.status)} → ${tenderStatusLabel(input.status)}`,
      input.createdBy ?? "",
      "estatus"
    );
  }

  const updated = await getTender(id);
  if (!updated) throw new Error("No se pudo recargar la licitación.");
  return updated;
}

export async function setTenderStatus(
  id: string,
  status: TenderStatus,
  createdBy = ""
): Promise<void> {
  const current = await getTender(id);
  if (!current) throw new Error("Licitación no encontrada.");
  if (current.status === status) return;

  const { error } = await db
    .from("tenders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await addEvent(
    id,
    `Estatus: ${tenderStatusLabel(current.status)} → ${tenderStatusLabel(status)}`,
    createdBy,
    "estatus"
  );
}

export async function deleteTender(id: string): Promise<void> {
  const { error } = await db.from("tenders").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function replaceTenderLines(
  tenderId: string,
  lines: TenderLineInput[]
): Promise<void> {
  const { error: delError } = await db
    .from("tender_lines")
    .delete()
    .eq("tender_id", tenderId);
  if (delError) throw new Error(delError.message);

  if (!lines.length) return;

  const { error } = await db
    .from("tender_lines")
    .insert(lines.map((line, index) => linePayload(tenderId, line, index)));
  if (error) throw new Error(error.message);

  const offered = lines.reduce(
    (sum, line) => sum + Number(line.quantity) * Number(line.unitPrice),
    0
  );
  await db
    .from("tenders")
    .update({
      monto_ofertado: offered,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenderId);
}

export async function addTenderNote(
  tenderId: string,
  message: string,
  createdBy: string
): Promise<void> {
  if (!message.trim()) throw new Error("Escribe una nota.");
  await addEvent(tenderId, message.trim(), createdBy, "nota");
}

export async function uploadTenderDocument(input: {
  tenderId: string;
  docType: TenderDocType;
  name: string;
  file: File;
  notes?: string;
  uploadedBy?: string;
}): Promise<TenderDocument> {
  const safeName = input.file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${input.tenderId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("tender-documents")
    .upload(path, input.file, { upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicData } = supabase.storage
    .from("tender-documents")
    .getPublicUrl(path);

  const { data, error } = await db
    .from("tender_documents")
    .insert({
      tender_id: input.tenderId,
      doc_type: input.docType,
      name: input.name.trim() || input.file.name,
      file_path: path,
      file_url: publicData.publicUrl,
      notes: (input.notes ?? "").trim(),
      uploaded_by: (input.uploadedBy ?? "").trim(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await addEvent(
    input.tenderId,
    `Documento: ${data.name}`,
    input.uploadedBy ?? "",
    "documento"
  );

  return mapDocument(data);
}

export async function deleteTenderDocument(doc: TenderDocument): Promise<void> {
  if (doc.filePath) {
    await supabase.storage.from("tender-documents").remove([doc.filePath]);
  }
  const { error } = await db.from("tender_documents").delete().eq("id", doc.id);
  if (error) throw new Error(error.message);
}

/** Convierte una licitación ganada en apartado de proyecto. */
export async function convertTenderToHold(
  tender: Tender,
  createdBy: string
): Promise<InventoryHold> {
  if (tender.status !== "ganada") {
    throw new Error("Solo se puede convertir una licitación ganada.");
  }
  if (tender.holdId) {
    throw new Error("Esta licitación ya tiene un apartado vinculado.");
  }

  const linkedLines = tender.lines.filter((line) => line.productId);
  if (!linkedLines.length) {
    throw new Error(
      "Agrega partidas vinculadas a productos del inventario para crear el apartado."
    );
  }

  const hold = await createInventoryHold({
    projectName: `${tender.folioInterno} · ${tender.title}`,
    clientName: tender.convocante,
    clientCity: tender.city,
    clientState: tender.state,
    neededBy: tender.firmaAt || tender.falloAt || "",
    notes: `Desde licitación CompraMX ${tender.folioComprasmx}`,
    createdBy,
    lines: linkedLines.map((line) => ({
      productId: line.productId!,
      quantity: Math.max(1, Math.round(line.quantity)),
      notes: line.clavePartida || line.descripcion,
    })),
  });

  const { error } = await db
    .from("tenders")
    .update({
      hold_id: hold.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tender.id);
  if (error) throw new Error(error.message);

  await addEvent(
    tender.id,
    `Convertida a apartado ${hold.folio}`,
    createdBy,
    "apartado"
  );

  return hold;
}

export type TenderCalendarHit = {
  id: string;
  tenderId: string;
  date: string;
  title: string;
  subtitle: string;
};

export function buildTenderCalendarItems(
  tenders: Tender[]
): TenderCalendarHit[] {
  const hits: TenderCalendarHit[] = [];
  for (const tender of tenders) {
    if (
      tender.status === "cancelada" ||
      tender.status === "perdida" ||
      tender.status === "desierta"
    ) {
      continue;
    }
    const milestones: { key: string; date: string; label: string }[] = [
      {
        key: "junta",
        date: tender.juntaAclaraciones,
        label: "Junta de aclaraciones",
      },
      {
        key: "preguntas",
        date: tender.limitePreguntas,
        label: "Límite de preguntas",
      },
      {
        key: "propuestas",
        date: tender.limitePropuestas,
        label: "Límite de propuestas",
      },
      { key: "fallo", date: tender.falloAt, label: "Fallo" },
      { key: "firma", date: tender.firmaAt, label: "Firma de contrato" },
    ];
    for (const milestone of milestones) {
      if (!milestone.date) continue;
      hits.push({
        id: `tender-${tender.id}-${milestone.key}`,
        tenderId: tender.id,
        date: milestone.date,
        title: milestone.label,
        subtitle: `${tender.folioInterno} · ${tender.title}`,
      });
    }
  }
  return hits;
}
