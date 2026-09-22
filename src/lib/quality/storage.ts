import { supabase } from "@/lib/supabase/client";
import { whatsappHref } from "@/lib/calendar/storage";
import type {
  QualitySurvey,
  QualitySurveyAnswers,
  QualitySurveyInput,
  SurveyStatus,
} from "@/lib/quality/types";
import { surveyWhatsAppMessage } from "@/lib/quality/types";

const db = supabase as any;

function asScore(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapSurvey(row: Record<string, unknown>): QualitySurvey {
  return {
    id: String(row.id),
    folio: String(row.folio ?? ""),
    token: String(row.token ?? ""),
    status: String(row.status ?? "borrador") as SurveyStatus,
    clientId: row.client_id ? String(row.client_id) : null,
    clientName: String(row.client_name ?? ""),
    contactName: String(row.contact_name ?? ""),
    contactPhone: String(row.contact_phone ?? ""),
    serviceOrderId: row.service_order_id ? String(row.service_order_id) : null,
    serviceOrderFolio: String(row.service_order_folio ?? ""),
    sentAt: row.sent_at ? String(row.sent_at) : "",
    respondedAt: row.responded_at ? String(row.responded_at) : "",
    scoreOverall: asScore(row.score_overall),
    scoreResponseTime: asScore(row.score_response_time),
    scoreTechnician: asScore(row.score_technician),
    scoreWorkQuality: asScore(row.score_work_quality),
    scoreCommunication: asScore(row.score_communication),
    wouldRecommend:
      row.would_recommend === null || row.would_recommend === undefined
        ? null
        : Boolean(row.would_recommend),
    comments: String(row.comments ?? ""),
    respondentName: String(row.respondent_name ?? ""),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function newToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 18)}`;
}

async function nextFolio(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ENC-${year}-`;
  const { data, error } = await db
    .from("quality_surveys")
    .select("folio")
    .ilike("folio", `${prefix}%`)
    .order("folio", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = data?.[0]?.folio as string | undefined;
  const seq = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(4, "0")}`;
}

export async function getQualitySurveys(): Promise<QualitySurvey[]> {
  const { data, error } = await db
    .from("quality_surveys")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapSurvey);
}

export async function getQualitySurveyByToken(
  token: string
): Promise<QualitySurvey | null> {
  const clean = token.trim();
  if (!clean) return null;
  const { data, error } = await db
    .from("quality_surveys")
    .select("*")
    .eq("token", clean)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapSurvey(data as Record<string, unknown>) : null;
}

export async function createQualitySurvey(
  input: QualitySurveyInput
): Promise<QualitySurvey> {
  const clientName = input.clientName.trim();
  if (!clientName) throw new Error("Selecciona o escribe el cliente.");
  const phone = input.contactPhone.trim();
  if (!phone) throw new Error("El teléfono de WhatsApp es obligatorio.");

  const folio = await nextFolio();
  const { data, error } = await db
    .from("quality_surveys")
    .insert({
      folio,
      token: newToken(),
      status: "borrador",
      client_id: input.clientId || null,
      client_name: clientName,
      contact_name: input.contactName.trim(),
      contact_phone: phone,
      service_order_id: input.serviceOrderId || null,
      service_order_folio: (input.serviceOrderFolio ?? "").trim(),
      created_by: (input.createdBy ?? "").trim(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapSurvey(data as Record<string, unknown>);
}

export async function markSurveySent(id: string): Promise<QualitySurvey> {
  const { data, error } = await db
    .from("quality_surveys")
    .update({
      status: "enviada",
      sent_at: new Date().toISOString(),
    })
    .eq("id", id)
    .neq("status", "respondida")
    .neq("status", "cancelada")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("La encuesta ya no se puede enviar.");
  return mapSurvey(data as Record<string, unknown>);
}

export async function cancelQualitySurvey(id: string): Promise<QualitySurvey> {
  const { data, error } = await db
    .from("quality_surveys")
    .update({ status: "cancelada" })
    .eq("id", id)
    .neq("status", "respondida")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No se puede cancelar una encuesta ya respondida.");
  return mapSurvey(data as Record<string, unknown>);
}

export async function deleteQualitySurvey(id: string): Promise<void> {
  const { error } = await db.from("quality_surveys").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function submitSurveyAnswers(
  token: string,
  answers: QualitySurveyAnswers
): Promise<QualitySurvey> {
  const scores = [
    answers.scoreOverall,
    answers.scoreResponseTime,
    answers.scoreTechnician,
    answers.scoreWorkQuality,
    answers.scoreCommunication,
  ];
  if (scores.some((value) => value < 1 || value > 5)) {
    throw new Error("Califica todas las preguntas del 1 al 5.");
  }

  const { data, error } = await db
    .from("quality_surveys")
    .update({
      status: "respondida",
      responded_at: new Date().toISOString(),
      score_overall: answers.scoreOverall,
      score_response_time: answers.scoreResponseTime,
      score_technician: answers.scoreTechnician,
      score_work_quality: answers.scoreWorkQuality,
      score_communication: answers.scoreCommunication,
      would_recommend: answers.wouldRecommend,
      comments: (answers.comments ?? "").trim(),
      respondent_name: (answers.respondentName ?? "").trim(),
    })
    .eq("token", token.trim())
    .in("status", ["borrador", "enviada"])
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(
      "Esta encuesta ya fue respondida o ya no está disponible."
    );
  }
  return mapSurvey(data as Record<string, unknown>);
}

export function surveyWhatsAppHref(survey: QualitySurvey, origin?: string) {
  return whatsappHref(
    survey.contactPhone,
    surveyWhatsAppMessage(survey, origin)
  );
}
