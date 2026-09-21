import { supabase } from "@/lib/supabase/client";
import type {
  EducationAttendee,
  EducationAttendeeInput,
  EducationTraining,
  EducationTrainingInput,
  EducationTrainingPhoto,
} from "@/lib/education/types";

const db = supabase as any;
const MEDIA_BUCKET = "education-media";

function mapPhoto(row: Record<string, unknown>): EducationTrainingPhoto {
  return {
    id: String(row.id),
    trainingId: String(row.training_id),
    caption: String(row.caption ?? ""),
    filePath: String(row.file_path ?? ""),
    fileUrl: String(row.file_url ?? ""),
    uploadedBy: String(row.uploaded_by ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

function mapAttendee(row: Record<string, unknown>): EducationAttendee {
  return {
    id: String(row.id),
    trainingId: String(row.training_id),
    fullName: String(row.full_name ?? ""),
    shift: String(row.shift ?? ""),
    phone: String(row.phone ?? ""),
    jobTitle: String(row.job_title ?? ""),
    employeeNumber: String(row.employee_number ?? ""),
    signaturePath: String(row.signature_path ?? ""),
    signatureUrl: String(row.signature_url ?? ""),
    notes: String(row.notes ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapTraining(
  row: Record<string, unknown>,
  attendees: EducationAttendee[] = [],
  photos: EducationTrainingPhoto[] = []
): EducationTraining {
  const durationRaw = row.duration_hours;
  return {
    id: String(row.id),
    folio: String(row.folio ?? ""),
    name: String(row.name ?? ""),
    trainingDate: row.training_date
      ? String(row.training_date).slice(0, 10)
      : "",
    location: String(row.location ?? ""),
    instructor: String(row.instructor ?? ""),
    clientName: String(row.client_name ?? ""),
    durationHours:
      durationRaw === null || durationRaw === undefined || durationRaw === ""
        ? null
        : Number(durationRaw),
    notes: String(row.notes ?? ""),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    attendees,
    photos,
  };
}

async function nextFolio(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EDU-${year}-`;
  const { data, error } = await db
    .from("education_trainings")
    .select("folio")
    .ilike("folio", `${prefix}%`)
    .order("folio", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = data?.[0]?.folio as string | undefined;
  const seq = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(4, "0")}`;
}

async function loadChildren(trainingIds: string[]) {
  const attendeesByTraining = new Map<string, EducationAttendee[]>();
  const photosByTraining = new Map<string, EducationTrainingPhoto[]>();
  if (trainingIds.length === 0) {
    return { attendeesByTraining, photosByTraining };
  }

  const [{ data: attendeeRows, error: attendeeError }, { data: photoRows, error: photoError }] =
    await Promise.all([
      db
        .from("education_training_attendees")
        .select("*")
        .in("training_id", trainingIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      db
        .from("education_training_photos")
        .select("*")
        .in("training_id", trainingIds)
        .order("created_at", { ascending: false }),
    ]);
  if (attendeeError) throw new Error(attendeeError.message);
  if (photoError) throw new Error(photoError.message);

  for (const row of (attendeeRows ?? []) as Record<string, unknown>[]) {
    const mapped = mapAttendee(row);
    const list = attendeesByTraining.get(mapped.trainingId) ?? [];
    list.push(mapped);
    attendeesByTraining.set(mapped.trainingId, list);
  }
  for (const row of (photoRows ?? []) as Record<string, unknown>[]) {
    const mapped = mapPhoto(row);
    const list = photosByTraining.get(mapped.trainingId) ?? [];
    list.push(mapped);
    photosByTraining.set(mapped.trainingId, list);
  }

  return { attendeesByTraining, photosByTraining };
}

export async function getEducationTrainings(): Promise<EducationTraining[]> {
  const { data, error } = await db
    .from("education_trainings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  const ids = rows.map((row) => String(row.id));
  const { attendeesByTraining, photosByTraining } = await loadChildren(ids);

  return rows.map((row) =>
    mapTraining(
      row,
      attendeesByTraining.get(String(row.id)) ?? [],
      photosByTraining.get(String(row.id)) ?? []
    )
  );
}

export async function getEducationTraining(
  id: string
): Promise<EducationTraining | null> {
  const { data, error } = await db
    .from("education_trainings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { attendeesByTraining, photosByTraining } = await loadChildren([id]);
  return mapTraining(
    data as Record<string, unknown>,
    attendeesByTraining.get(id) ?? [],
    photosByTraining.get(id) ?? []
  );
}

export async function createEducationTraining(
  input: EducationTrainingInput
): Promise<EducationTraining> {
  const name = input.name.trim();
  if (!name) throw new Error("El nombre de la capacitación es obligatorio.");

  const folio = await nextFolio();
  const { data, error } = await db
    .from("education_trainings")
    .insert({
      folio,
      name,
      training_date: input.trainingDate?.trim() || null,
      location: (input.location ?? "").trim(),
      instructor: (input.instructor ?? "").trim(),
      client_name: (input.clientName ?? "").trim(),
      duration_hours:
        input.durationHours === null || input.durationHours === undefined
          ? null
          : Number(input.durationHours),
      notes: (input.notes ?? "").trim(),
      created_by: (input.createdBy ?? "").trim(),
      personnel_name: "",
      shift: "",
      phone: "",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapTraining(data as Record<string, unknown>, [], []);
}

export async function updateEducationTraining(
  id: string,
  input: EducationTrainingInput
): Promise<EducationTraining> {
  const name = input.name.trim();
  if (!name) throw new Error("El nombre de la capacitación es obligatorio.");

  const { data, error } = await db
    .from("education_trainings")
    .update({
      name,
      training_date: input.trainingDate?.trim() || null,
      location: (input.location ?? "").trim(),
      instructor: (input.instructor ?? "").trim(),
      client_name: (input.clientName ?? "").trim(),
      duration_hours:
        input.durationHours === null || input.durationHours === undefined
          ? null
          : Number(input.durationHours),
      notes: (input.notes ?? "").trim(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const current = await getEducationTraining(id);
  return mapTraining(
    data as Record<string, unknown>,
    current?.attendees ?? [],
    current?.photos ?? []
  );
}

export async function deleteEducationTraining(id: string): Promise<void> {
  const current = await getEducationTraining(id);
  if (current) {
    const paths = [
      ...current.attendees
        .map((attendee) => attendee.signaturePath)
        .filter(Boolean),
      ...current.photos.map((photo) => photo.filePath).filter(Boolean),
    ];
    if (paths.length > 0) {
      await supabase.storage.from(MEDIA_BUCKET).remove(paths);
    }
  }
  const { error } = await db.from("education_trainings").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function addTrainingAttendee(
  trainingId: string,
  input: EducationAttendeeInput
): Promise<EducationAttendee> {
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("El nombre del asistente es obligatorio.");

  const { data: existing } = await db
    .from("education_training_attendees")
    .select("sort_order")
    .eq("training_id", trainingId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder =
    input.sortOrder ??
    (existing?.[0]?.sort_order != null ? Number(existing[0].sort_order) + 1 : 0);

  const { data, error } = await db
    .from("education_training_attendees")
    .insert({
      training_id: trainingId,
      full_name: fullName,
      shift: (input.shift ?? "").trim(),
      phone: (input.phone ?? "").trim(),
      job_title: (input.jobTitle ?? "").trim(),
      employee_number: (input.employeeNumber ?? "").trim(),
      notes: (input.notes ?? "").trim(),
      sort_order: nextOrder,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapAttendee(data as Record<string, unknown>);
}

export async function updateTrainingAttendee(
  attendeeId: string,
  input: EducationAttendeeInput
): Promise<EducationAttendee> {
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("El nombre del asistente es obligatorio.");

  const { data, error } = await db
    .from("education_training_attendees")
    .update({
      full_name: fullName,
      shift: (input.shift ?? "").trim(),
      phone: (input.phone ?? "").trim(),
      job_title: (input.jobTitle ?? "").trim(),
      employee_number: (input.employeeNumber ?? "").trim(),
      notes: (input.notes ?? "").trim(),
    })
    .eq("id", attendeeId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapAttendee(data as Record<string, unknown>);
}

export async function deleteTrainingAttendee(
  attendee: EducationAttendee
): Promise<void> {
  if (attendee.signaturePath) {
    await supabase.storage.from(MEDIA_BUCKET).remove([attendee.signaturePath]);
  }
  const { error } = await db
    .from("education_training_attendees")
    .delete()
    .eq("id", attendee.id);
  if (error) throw new Error(error.message);
}

export async function uploadAttendeeSignature(
  attendeeId: string,
  trainingId: string,
  blob: Blob
): Promise<EducationAttendee> {
  const path = `${trainingId}/signatures/${attendeeId}-${Date.now()}.png`;
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, { upsert: true, contentType: "image/png" });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicData } = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(path);

  const { data: current } = await db
    .from("education_training_attendees")
    .select("signature_path")
    .eq("id", attendeeId)
    .maybeSingle();
  const previousPath = String(current?.signature_path ?? "");
  if (previousPath && previousPath !== path) {
    await supabase.storage.from(MEDIA_BUCKET).remove([previousPath]);
  }

  const { data, error } = await db
    .from("education_training_attendees")
    .update({
      signature_path: path,
      signature_url: `${publicData.publicUrl}?t=${Date.now()}`,
    })
    .eq("id", attendeeId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapAttendee(data as Record<string, unknown>);
}

export async function clearAttendeeSignature(
  attendee: EducationAttendee
): Promise<void> {
  if (attendee.signaturePath) {
    await supabase.storage.from(MEDIA_BUCKET).remove([attendee.signaturePath]);
  }
  const { error } = await db
    .from("education_training_attendees")
    .update({ signature_path: "", signature_url: "" })
    .eq("id", attendee.id);
  if (error) throw new Error(error.message);
}

export async function uploadTrainingPhoto(input: {
  trainingId: string;
  file: File;
  caption?: string;
  uploadedBy?: string;
}): Promise<EducationTrainingPhoto> {
  if (!input.file.type.startsWith("image/")) {
    throw new Error("Solo se permiten imágenes.");
  }
  const safeName = input.file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${input.trainingId}/photos/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, input.file, { upsert: false, contentType: input.file.type });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicData } = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(path);

  const { data, error } = await db
    .from("education_training_photos")
    .insert({
      training_id: input.trainingId,
      caption: (input.caption ?? "").trim(),
      file_path: path,
      file_url: publicData.publicUrl,
      uploaded_by: (input.uploadedBy ?? "").trim(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapPhoto(data as Record<string, unknown>);
}

export async function deleteTrainingPhoto(
  photo: EducationTrainingPhoto
): Promise<void> {
  if (photo.filePath) {
    await supabase.storage.from(MEDIA_BUCKET).remove([photo.filePath]);
  }
  const { error } = await db
    .from("education_training_photos")
    .delete()
    .eq("id", photo.id);
  if (error) throw new Error(error.message);
}
