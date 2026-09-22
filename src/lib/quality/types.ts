export const SURVEY_STATUSES = [
  { id: "borrador", label: "Borrador" },
  { id: "enviada", label: "Enviada" },
  { id: "respondida", label: "Respondida" },
  { id: "cancelada", label: "Cancelada" },
] as const;

export type SurveyStatus = (typeof SURVEY_STATUSES)[number]["id"];

export const CSAT_QUESTIONS = [
  {
    id: "overall",
    field: "scoreOverall",
    dbField: "score_overall",
    label: "Satisfacción general con el servicio",
    helper: "Pensando en la atención recibida en conjunto.",
  },
  {
    id: "responseTime",
    field: "scoreResponseTime",
    dbField: "score_response_time",
    label: "Tiempo de respuesta",
    helper: "Qué tan oportunos fuimos al atender su solicitud.",
  },
  {
    id: "technician",
    field: "scoreTechnician",
    dbField: "score_technician",
    label: "Atención del técnico o especialista",
    helper: "Amabilidad, claridad y profesionalismo del personal.",
  },
  {
    id: "workQuality",
    field: "scoreWorkQuality",
    dbField: "score_work_quality",
    label: "Calidad del trabajo realizado",
    helper: "Resultado técnico e instalación o reparación.",
  },
  {
    id: "communication",
    field: "scoreCommunication",
    dbField: "score_communication",
    label: "Comunicación y seguimiento",
    helper: "Información durante el servicio y al entregar.",
  },
] as const;

export const CSAT_SCALE = [
  { value: 1, label: "Muy insatisfecho" },
  { value: 2, label: "Insatisfecho" },
  { value: 3, label: "Regular" },
  { value: 4, label: "Satisfecho" },
  { value: 5, label: "Muy satisfecho" },
] as const;

export type CsatScore = 1 | 2 | 3 | 4 | 5;

export type QualitySurvey = {
  id: string;
  folio: string;
  token: string;
  status: SurveyStatus;
  clientId: string | null;
  clientName: string;
  contactName: string;
  contactPhone: string;
  serviceOrderId: string | null;
  serviceOrderFolio: string;
  sentAt: string;
  respondedAt: string;
  scoreOverall: number | null;
  scoreResponseTime: number | null;
  scoreTechnician: number | null;
  scoreWorkQuality: number | null;
  scoreCommunication: number | null;
  wouldRecommend: boolean | null;
  comments: string;
  respondentName: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type QualitySurveyInput = {
  clientId?: string | null;
  clientName: string;
  contactName: string;
  contactPhone: string;
  serviceOrderId?: string | null;
  serviceOrderFolio?: string;
  createdBy?: string;
};

export type QualitySurveyAnswers = {
  scoreOverall: CsatScore;
  scoreResponseTime: CsatScore;
  scoreTechnician: CsatScore;
  scoreWorkQuality: CsatScore;
  scoreCommunication: CsatScore;
  wouldRecommend: boolean;
  comments?: string;
  respondentName?: string;
};

export function surveyStatusLabel(status: string) {
  return SURVEY_STATUSES.find((item) => item.id === status)?.label ?? status;
}

export function csatScoreLabel(value: number | null | undefined) {
  if (!value) return "—";
  return CSAT_SCALE.find((item) => item.value === value)?.label ?? String(value);
}

export function surveyAverage(survey: QualitySurvey): number | null {
  const scores = [
    survey.scoreOverall,
    survey.scoreResponseTime,
    survey.scoreTechnician,
    survey.scoreWorkQuality,
    survey.scoreCommunication,
  ].filter((value): value is number => typeof value === "number");
  if (scores.length === 0) return null;
  return Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(2));
}

export function publicSurveyUrl(token: string, origin?: string) {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/$/, "")}/encuesta/${token}`;
}

export function surveyWhatsAppMessage(survey: QualitySurvey, origin?: string) {
  const url = publicSurveyUrl(survey.token, origin);
  const greeting = survey.contactName.trim()
    ? `Hola ${survey.contactName.trim()},`
    : "Hola,";
  const osLine = survey.serviceOrderFolio.trim()
    ? ` sobre la orden ${survey.serviceOrderFolio.trim()}`
    : "";
  return [
    greeting,
    "",
    `En Medical Advanced Supplies queremos conocer su opinión${osLine}.`,
    "",
    "La encuesta toma menos de un minuto y nos ayuda a mejorar el servicio:",
    url,
    "",
    "Gracias por su confianza.",
    "MAS · Medical Advanced Supplies",
  ].join("\n");
}
