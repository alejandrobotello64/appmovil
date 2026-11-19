"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { chromeLabel } from "@/lib/i18n/chrome";

/** Traduce etiquetas de chrome (texto ES del código → locale activo). */
export function Ui({ children }: { children: string }) {
  const { locale } = useLocale();
  // Devuelve string (válido en <option>, botones, etc.)
  return chromeLabel(locale, children);
}

export function useChrome() {
  const { locale, t, setLocale } = useLocale();
  return {
    locale,
    t,
    setLocale,
    c: (text: string) => chromeLabel(locale, text),
  };
}

export function chromeChildren(locale: "es" | "en", children: ReactNode): ReactNode {
  if (typeof children === "string") return chromeLabel(locale, children);
  return children;
}
