"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { chromeLabel } from "@/lib/i18n/chrome";

type ModulePlaceholderProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function ModulePlaceholder({
  title,
  description,
  children,
}: ModulePlaceholderProps) {
  const { locale } = useLocale();

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">
        {chromeLabel(locale, title)}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {chromeLabel(locale, description)}
      </p>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
