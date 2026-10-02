"use client";

import type { ReactNode } from "react";
import { formatMoney, statusMeta, type CategoryTotal } from "@/lib/expenses/types";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20 disabled:opacity-60";

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("grid gap-1.5 text-sm", className)}>
      <span className="font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        meta.tone
      )}
    >
      {meta.label}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "warning" | "success" | "danger";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold text-foreground tabular-nums",
          tone === "warning" && "text-amber-600 dark:text-amber-400",
          tone === "success" && "text-emerald-600 dark:text-emerald-400",
          tone === "danger" && "text-destructive"
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function CategoryDot({ color }: { color: string }) {
  return <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: color }} />;
}

export function CategoryBars({ rows, emptyMessage }: { rows: CategoryTotal[]; emptyMessage?: string }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {emptyMessage ?? "Sin gastos capturados."}
      </p>
    );
  }
  const max = Math.max(...rows.map((row) => row.total), 0.01);
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.category} className="text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <CategoryDot color={row.color} />
              <span className="truncate">{row.label}</span>
              <span className="text-xs text-muted-foreground">({row.count})</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {formatMoney(row.total)}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {(row.share * 100).toFixed(0)}%
              </span>
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max((row.total / max) * 100, 2)}%`, background: row.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
