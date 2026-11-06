import { supabase } from "@/lib/supabase/client";
import type {
  BiomedicalInstrument,
  BiomedicalInstrumentInput,
  BiomedicalInstrumentType,
  InstrumentServiceUse,
} from "./types";

const MEDIA_BUCKET = "biomedical-instruments";
const db = supabase as any;

function mapRow(row: Record<string, unknown>): BiomedicalInstrument {
  return {
    id: String(row.id),
    instrumentType: String(
      row.instrument_type ?? "simulador"
    ) as BiomedicalInstrumentType,
    name: String(row.name ?? ""),
    brand: String(row.brand ?? ""),
    model: String(row.model ?? ""),
    serialNumber: String(row.serial_number ?? ""),
    assetTag: String(row.asset_tag ?? ""),
    location: String(row.location ?? ""),
    notes: String(row.notes ?? ""),
    imagePath: String(row.image_path ?? ""),
    imageUrl: String(row.image_url ?? ""),
    certificatePath: String(row.certificate_path ?? ""),
    certificateUrl: String(row.certificate_url ?? ""),
    certificateName: String(row.certificate_name ?? ""),
    certificateNumber: String(row.certificate_number ?? ""),
    certificateExpiresAt: row.certificate_expires_at
      ? String(row.certificate_expires_at).slice(0, 10)
      : "",
    isActive: Boolean(row.is_active ?? true),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function payloadFromInput(input: BiomedicalInstrumentInput) {
  return {
    instrument_type: input.instrumentType,
    name: input.name.trim(),
    brand: (input.brand ?? "").trim(),
    model: (input.model ?? "").trim(),
    serial_number: (input.serialNumber ?? "").trim(),
    asset_tag: (input.assetTag ?? "").trim(),
    location: (input.location ?? "").trim(),
    notes: (input.notes ?? "").trim(),
    certificate_number: (input.certificateNumber ?? "").trim(),
    certificate_expires_at: input.certificateExpiresAt
      ? input.certificateExpiresAt.slice(0, 10)
      : null,
    is_active: input.isActive ?? true,
  };
}

export async function getBiomedicalInstruments(options?: {
  includeInactive?: boolean;
  type?: BiomedicalInstrumentType;
}): Promise<BiomedicalInstrument[]> {
  let query = db
    .from("biomedical_instruments")
    .select("*")
    .order("name", { ascending: true });
  if (!options?.includeInactive) {
    query = query.eq("is_active", true);
  }
  if (options?.type) {
    query = query.eq("instrument_type", options.type);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function getBiomedicalInstrument(
  id: string
): Promise<BiomedicalInstrument | null> {
  const { data, error } = await db
    .from("biomedical_instruments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}

export async function createBiomedicalInstrument(
  input: BiomedicalInstrumentInput
): Promise<BiomedicalInstrument> {
  if (!input.name.trim()) {
    throw new Error("El nombre del equipo es obligatorio.");
  }
  if (!(input.serialNumber ?? "").trim()) {
    throw new Error("El número de serie es obligatorio.");
  }
  const { data, error } = await db
    .from("biomedical_instruments")
    .insert({
      ...payloadFromInput(input),
      created_by: (input.createdBy ?? "").trim(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function updateBiomedicalInstrument(
  id: string,
  input: BiomedicalInstrumentInput
): Promise<BiomedicalInstrument> {
  if (!input.name.trim()) {
    throw new Error("El nombre del equipo es obligatorio.");
  }
  if (!(input.serialNumber ?? "").trim()) {
    throw new Error("El número de serie es obligatorio.");
  }
  const { data, error } = await db
    .from("biomedical_instruments")
    .update({
      ...payloadFromInput(input),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function deleteBiomedicalInstrument(id: string): Promise<void> {
  const current = await getBiomedicalInstrument(id);
  if (!current) throw new Error("Equipo no encontrado.");

  const paths = [current.imagePath, current.certificatePath].filter(Boolean);
  if (paths.length) {
    await supabase.storage.from(MEDIA_BUCKET).remove(paths);
  }

  const { error } = await db
    .from("biomedical_instruments")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function uploadBiomedicalInstrumentImage(
  id: string,
  file: File
): Promise<BiomedicalInstrument> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Solo se permiten archivos de imagen.");
  }
  const current = await getBiomedicalInstrument(id);
  if (!current) throw new Error("Equipo no encontrado.");

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${id}/photo/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicData } = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(path);

  if (current.imagePath) {
    await supabase.storage.from(MEDIA_BUCKET).remove([current.imagePath]);
  }

  const { data, error } = await db
    .from("biomedical_instruments")
    .update({
      image_path: path,
      image_url: publicData.publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function clearBiomedicalInstrumentImage(
  id: string
): Promise<BiomedicalInstrument> {
  const current = await getBiomedicalInstrument(id);
  if (!current) throw new Error("Equipo no encontrado.");
  if (current.imagePath) {
    await supabase.storage.from(MEDIA_BUCKET).remove([current.imagePath]);
  }
  const { data, error } = await db
    .from("biomedical_instruments")
    .update({
      image_path: "",
      image_url: "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function uploadBiomedicalInstrumentCertificate(
  id: string,
  file: File
): Promise<BiomedicalInstrument> {
  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Solo se permiten certificados en PDF.");
  }
  const current = await getBiomedicalInstrument(id);
  if (!current) throw new Error("Equipo no encontrado.");

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${id}/certificate/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: "application/pdf",
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicData } = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(path);

  if (current.certificatePath) {
    await supabase.storage
      .from(MEDIA_BUCKET)
      .remove([current.certificatePath]);
  }

  const { data, error } = await db
    .from("biomedical_instruments")
    .update({
      certificate_path: path,
      certificate_url: publicData.publicUrl,
      certificate_name: file.name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function clearBiomedicalInstrumentCertificate(
  id: string
): Promise<BiomedicalInstrument> {
  const current = await getBiomedicalInstrument(id);
  if (!current) throw new Error("Equipo no encontrado.");
  if (current.certificatePath) {
    await supabase.storage
      .from(MEDIA_BUCKET)
      .remove([current.certificatePath]);
  }
  const { data, error } = await db
    .from("biomedical_instruments")
    .update({
      certificate_path: "",
      certificate_url: "",
      certificate_name: "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

function dateOrEmpty(value: unknown) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

/** Órdenes de servicio donde se registró un simulador o analizador. */
export async function listInstrumentServiceUses(): Promise<InstrumentServiceUse[]> {
  const [linksRes, ordersRes] = await Promise.all([
    db
      .from("service_order_instruments")
      .select("id, service_order_id, instrument_id, instrument_serial, usage_notes"),
    db
      .from("service_orders")
      .select(
        "id, folio, status, service_type, order_kind, technician, client_name, equipment_name, equipment_serial, reception_at, created_at"
      ),
  ]);
  if (linksRes.error) throw new Error(linksRes.error.message);
  if (ordersRes.error) throw new Error(ordersRes.error.message);

  const orders = new Map<string, Record<string, unknown>>();
  for (const row of ordersRes.data ?? []) {
    orders.set(String(row.id), row);
  }

  const uses: InstrumentServiceUse[] = [];
  for (const row of linksRes.data ?? []) {
    const order = orders.get(String(row.service_order_id));
    if (!order) continue;
    uses.push({
      id: String(row.id),
      serviceOrderId: String(row.service_order_id),
      instrumentId: row.instrument_id ? String(row.instrument_id) : null,
      instrumentSerial: String(row.instrument_serial ?? ""),
      usageNotes: String(row.usage_notes ?? ""),
      folio: String(order.folio ?? ""),
      status: String(order.status ?? ""),
      serviceType: String(order.service_type ?? ""),
      orderKind: String(order.order_kind ?? "servicio"),
      technician: String(order.technician ?? ""),
      clientName: String(order.client_name ?? ""),
      equipmentName: String(order.equipment_name ?? ""),
      equipmentSerial: String(order.equipment_serial ?? ""),
      receptionAt: dateOrEmpty(order.reception_at) || dateOrEmpty(order.created_at),
      createdAt: String(order.created_at ?? ""),
    });
  }
  return uses.sort(
    (a, b) => b.receptionAt.localeCompare(a.receptionAt) || b.folio.localeCompare(a.folio)
  );
}
