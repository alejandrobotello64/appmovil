"use client";

import type { ReactNode } from "react";

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
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
