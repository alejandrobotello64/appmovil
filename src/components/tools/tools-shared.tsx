"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { toolRequestStatusLabel, type ToolRequestStatus } from "@/lib/tools/types";
import { cn } from "@/lib/utils";

export const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#00BFFF]/40";

export const textareaClass =
  "min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#00BFFF]/40";

export const primaryButtonClass = "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white";

const STATUS_TONES: Record<ToolRequestStatus, string> = {
  solicitada: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  entregada: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  devolucion_parcial: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  devuelta: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rechazada: "bg-destructive/10 text-destructive",
  cancelada: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status, overdue }: { status: ToolRequestStatus; overdue?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className={cn(
          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
          STATUS_TONES[status]
        )}
      >
        {toolRequestStatusLabel(status)}
      </span>
      {overdue ? (
        <span className="inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-destructive">
          Vencida
        </span>
      ) : null}
    </span>
  );
}

export function Notice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "error"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
      )}
    >
      {children}
    </p>
  );
}

export type SubTab<T extends string> = { id: T; label: string; icon: LucideIcon; count?: number };

export function SubTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: SubTab<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-sm"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              selected
                ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {tab.label}
            {tab.count ? (
              <span className="rounded-full bg-[#3B46A5] px-1.5 text-[11px] leading-5 text-white">
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "warning" | "danger";
  onClick?: () => void;
}) {
  const content = (
    <>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          tone === "danger"
            ? "bg-destructive/10 text-destructive"
            : tone === "warning"
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : "bg-[#00BFFF]/10 text-[#3B46A5] dark:text-[#7fd8ff]"
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-xl font-semibold tabular-nums">{value}</span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
        {hint ? <span className="block truncate text-[11px] text-muted-foreground">{hint}</span> : null}
      </span>
    </>
  );
  const className =
    "flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm";
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(className, "transition-colors hover:bg-muted/40")}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function formatDate(value: string, withTime = false) {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function localDateKey(date: Date, addDays = 0) {
  const d = new Date(date);
  d.setDate(d.getDate() + addDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
