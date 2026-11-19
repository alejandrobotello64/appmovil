"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { chromeLabel } from "@/lib/i18n/chrome";

/** `<th>` que traduce chrome UI cuando el contenido es texto plano en español. */
export function Th({
  children,
  ...props
}: ComponentPropsWithoutRef<"th"> & { children?: ReactNode }) {
  const { locale } = useLocale();
  const content =
    typeof children === "string" ? chromeLabel(locale, children) : children;
  return <th {...props}>{content}</th>;
}
