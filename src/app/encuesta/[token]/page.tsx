import type { Metadata } from "next";
import { PublicSurveyPage } from "@/components/quality/public-survey-page";

export const metadata: Metadata = {
  title: "Encuesta de satisfacción",
  description:
    "Evalúe el servicio de Medical Advanced Supplies. No necesita iniciar sesión.",
};

export default async function EncuestaRoutePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicSurveyPage token={token} />;
}
