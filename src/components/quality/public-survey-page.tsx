"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BadgeCheck } from "lucide-react";
import { COMPANY_BRAND } from "@/lib/brand/company";
import {
  getQualitySurveyByToken,
  submitSurveyAnswers,
} from "@/lib/quality/storage";
import {
  CSAT_QUESTIONS,
  CSAT_SCALE,
  type CsatScore,
  type QualitySurvey,
} from "@/lib/quality/types";
import { cn } from "@/lib/utils";

const EMPTY_SCORES = {
  scoreOverall: 0,
  scoreResponseTime: 0,
  scoreTechnician: 0,
  scoreWorkQuality: 0,
  scoreCommunication: 0,
};

export function PublicSurveyPage({ token }: { token: string }) {
  const [survey, setSurvey] = useState<QualitySurvey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [scores, setScores] = useState(EMPTY_SCORES);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [comments, setComments] = useState("");
  const [respondentName, setRespondentName] = useState("");

  useEffect(() => {
    void getQualitySurveyByToken(token)
      .then((row) => {
        setSurvey(row);
        if (row?.status === "respondida") setDone(true);
      })
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo abrir la encuesta."
        )
      )
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!survey) return;
    const values = Object.values(scores);
    if (values.some((value) => value < 1)) {
      setError("Califica las cinco preguntas del 1 al 5.");
      return;
    }
    if (wouldRecommend === null) {
      setError("Indica si recomendaría Medical Advanced Supplies.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const updated = await submitSurveyAnswers(survey.token, {
        scoreOverall: scores.scoreOverall as CsatScore,
        scoreResponseTime: scores.scoreResponseTime as CsatScore,
        scoreTechnician: scores.scoreTechnician as CsatScore,
        scoreWorkQuality: scores.scoreWorkQuality as CsatScore,
        scoreCommunication: scores.scoreCommunication as CsatScore,
        wouldRecommend,
        comments,
        respondentName,
      });
      setSurvey(updated);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo enviar la encuesta. Intente de nuevo."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#f4f7ff_0%,#eef6fb_100%)] text-slate-900 dark:bg-background dark:text-foreground">
      <header className="border-b border-black/5 bg-white/80 px-4 py-4 backdrop-blur dark:border-border dark:bg-card/80">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <img
            src={COMPANY_BRAND.logoPath}
            alt={COMPANY_BRAND.legalName}
            className="h-10 w-auto"
          />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#00BFFF] uppercase">
              {COMPANY_BRAND.shortName}
            </p>
            <p className="text-sm font-semibold">{COMPANY_BRAND.legalName}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-6 pb-16">
        {loading ? (
          <p className="text-sm text-slate-600">Cargando encuesta…</p>
        ) : !survey ? (
          <section className="rounded-2xl border border-border bg-white p-6 shadow-sm dark:bg-card">
            <h1 className="text-xl font-semibold">Enlace no válido</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta encuesta no existe o el enlace está incompleto. Pida a su
              contacto de MAS que se la reenvíe.
            </p>
          </section>
        ) : survey.status === "cancelada" ? (
          <section className="rounded-2xl border border-border bg-white p-6 shadow-sm dark:bg-card">
            <h1 className="text-xl font-semibold">Encuesta no disponible</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta encuesta ya no está activa. Si necesita apoyo, escriba a{" "}
              {COMPANY_BRAND.email}.
            </p>
          </section>
        ) : done ? (
          <section className="rounded-2xl border border-border bg-white p-6 shadow-sm dark:bg-card">
            <div className="flex items-center gap-2 text-[#3B46A5]">
              <BadgeCheck className="size-6" />
              <h1 className="text-xl font-semibold">Gracias por su opinión</h1>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Recibimos su evaluación
              {survey.serviceOrderFolio
                ? ` de la orden ${survey.serviceOrderFolio}`
                : ""}
              . El equipo de Medical Advanced Supplies la usará para mejorar el
              servicio.
            </p>
          </section>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-2xl border border-border bg-white p-5 shadow-sm dark:bg-card sm:p-6"
          >
            <div>
              <p className="text-xs font-semibold tracking-wide text-[#3B46A5] uppercase">
                Encuesta de satisfacción
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                ¿Cómo fue su experiencia con MAS?
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {survey.clientName}
                {survey.serviceOrderFolio
                  ? ` · Orden ${survey.serviceOrderFolio}`
                  : ""}
                . Califique del 1 al 5; 5 es excelente.
              </p>
            </div>

            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            {CSAT_QUESTIONS.map((question) => {
              const field = question.field as keyof typeof scores;
              const current = scores[field];
              return (
                <fieldset key={question.id} className="space-y-2">
                  <legend className="text-sm font-medium">{question.label}</legend>
                  <p className="text-xs text-muted-foreground">{question.helper}</p>
                  <div className="grid grid-cols-5 gap-2">
                    {CSAT_SCALE.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={current === option.value}
                        onClick={() =>
                          setScores((prev) => ({
                            ...prev,
                            [field]: option.value,
                          }))
                        }
                        className={cn(
                          "flex min-h-12 flex-col items-center justify-center rounded-xl border px-1 py-2 text-center text-sm font-semibold transition-colors",
                          current === option.value
                            ? "border-[#3B46A5] bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                            : "border-border bg-background hover:border-[#3B46A5]/50"
                        )}
                      >
                        {option.value}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    1 {CSAT_SCALE[0].label} · 5 {CSAT_SCALE[4].label}
                  </p>
                </fieldset>
              );
            })}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                ¿Recomendaría Medical Advanced Supplies?
              </legend>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={wouldRecommend === true}
                  onClick={() => setWouldRecommend(true)}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-medium",
                    wouldRecommend === true
                      ? "border-emerald-600 bg-emerald-500/15 text-emerald-800"
                      : "border-border"
                  )}
                >
                  Sí
                </button>
                <button
                  type="button"
                  aria-pressed={wouldRecommend === false}
                  onClick={() => setWouldRecommend(false)}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-medium",
                    wouldRecommend === false
                      ? "border-amber-600 bg-amber-500/15 text-amber-900"
                      : "border-border"
                  )}
                >
                  No
                </button>
              </div>
            </fieldset>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Su nombre (opcional)</span>
              <input
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                value={respondentName}
                onChange={(event) => setRespondentName(event.target.value)}
                placeholder="Nombre de quien responde"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Comentarios (opcional)</span>
              <textarea
                className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                value={comments}
                onChange={(event) => setComments(event.target.value)}
                placeholder="Qué podemos mejorar o qué le gustó del servicio"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Enviando…" : "Enviar encuesta"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
