"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { homeAreaLabel, type HomeArea } from "@/lib/analytics/home-data";
import type {
  BarDatum,
  ClientActivity,
  HomeAlert,
  MonthPoint,
} from "@/lib/analytics/home-metrics";
import { cn } from "@/lib/utils";

// ---------- Formato ----------

const moneyFull = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const moneyCompact = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMoney(value: number, compact = true) {
  return compact && Math.abs(value) >= 100_000 ? moneyCompact.format(value) : moneyFull.format(value);
}

export function formatPercent(value: number | null, digits = 0) {
  return value === null ? "—" : `${(value * 100).toFixed(digits)} %`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX").format(value);
}

export function formatDays(value: number | null) {
  if (value === null) return "—";
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${value === 1 ? "día" : "días"}`;
}

export function formatShortDate(time: number | null) {
  if (!time) return "—";
  return new Date(time).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

// ---------- Contenedores ----------

export function Panel({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {Icon ? <Icon className="mt-0.5 size-5 shrink-0 text-[#3B46A5] dark:text-sky-300" /> : null}
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground">{title}</h3>
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PanelLink({ href, label = "Ver detalle" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#3B46A5] hover:underline dark:text-sky-300"
    >
      {label} <ArrowRight className="size-3.5" />
    </Link>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

// ---------- Indicadores ----------

export function DeltaChip({
  value,
  invert = false,
  label,
}: {
  value: number | null;
  /** Para métricas donde bajar es bueno (p. ej. tiempo de ciclo). */
  invert?: boolean;
  label: string;
}) {
  if (value === null || !Number.isFinite(value)) {
    return <span className="text-[11px] text-muted-foreground">Sin comparativo</span>;
  }
  const flat = Math.abs(value) < 0.005;
  const good = flat ? null : invert ? value < 0 : value > 0;
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-[11px]" title={label}>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
          good === null
            ? "bg-muted text-muted-foreground"
            : good
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-destructive/10 text-destructive"
        )}
      >
        {!flat ? <Icon className="size-3" /> : null}
        {flat ? "0 %" : `${Math.abs(value * 100).toFixed(0)} %`}
      </span>
      <span className="truncate text-muted-foreground">{label}</span>
    </span>
  );
}

export function KpiCard({
  icon: Icon,
  area,
  label,
  value,
  delta,
  invert,
  compareLabel,
  footnote,
  footnoteTone,
  href,
}: {
  icon: LucideIcon;
  area: string;
  label: string;
  value: string;
  delta?: number | null;
  invert?: boolean;
  compareLabel: string;
  footnote?: string;
  footnoteTone?: "danger" | "muted";
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {area}
        </span>
        <span className="flex size-8 items-center justify-center rounded-lg bg-[linear-gradient(135deg,rgba(0,191,255,0.15),rgba(59,70,165,0.2))] text-[#3B46A5] dark:text-sky-300">
          <Icon className="size-4" />
        </span>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
      </div>
      {delta !== undefined ? <DeltaChip value={delta} invert={invert} label={compareLabel} /> : null}
      {footnote ? (
        <p
          className={cn(
            "mt-auto text-xs",
            footnoteTone === "danger" ? "font-medium text-destructive" : "text-muted-foreground"
          )}
        >
          {footnote}
        </p>
      ) : null}
    </Link>
  );
}

// ---------- Gráfica mensual ----------

export type ChartSeries = {
  key: keyof Omit<MonthPoint, "key" | "label">;
  label: string;
  color: string;
};

export function MonthlyChart({
  months,
  series,
  format,
  axisPrefix = "",
}: {
  months: MonthPoint[];
  series: ChartSeries[];
  format: (value: number) => string;
  axisPrefix?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 720;
  const height = 230;
  const padLeft = 44;
  const padBottom = 26;
  const padTop = 10;
  const chartH = height - padBottom - padTop;
  const max = Math.max(1, ...months.flatMap((month) => series.map((s) => month[s.key])));
  const niceMax = niceCeil(max);
  const slot = (width - padLeft) / months.length;
  const groupW = slot * 0.7;
  const barW = groupW / series.length;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const active = hover !== null ? months[hover] : null;

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap gap-3">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Actividad mensual"
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((tick) => {
          const y = padTop + chartH * (1 - tick);
          return (
            <g key={tick}>
              <line x1={padLeft} x2={width} y1={y} y2={y} className="stroke-border" strokeDasharray={tick ? "3 4" : undefined} />
              <text x={padLeft - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {compactTick(niceMax * tick, axisPrefix)}
              </text>
            </g>
          );
        })}
        {months.map((month, i) => {
          const x0 = padLeft + slot * i + (slot - groupW) / 2;
          return (
            <g key={month.key} onMouseEnter={() => setHover(i)}>
              <rect x={padLeft + slot * i} y={padTop} width={slot} height={chartH} fill={hover === i ? "currentColor" : "transparent"} className="text-muted/60" />
              {series.map((s, j) => {
                const value = month[s.key];
                const h = (value / niceMax) * chartH;
                return (
                  <rect
                    key={s.key}
                    x={x0 + barW * j + 1}
                    y={padTop + chartH - h}
                    width={Math.max(barW - 2, 1)}
                    height={Math.max(h, value > 0 ? 2 : 0)}
                    rx={2}
                    fill={s.color}
                  />
                );
              })}
              <text x={padLeft + slot * i + slot / 2} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {month.label}
              </text>
            </g>
          );
        })}
      </svg>
      {active ? (
        <div className="pointer-events-none absolute top-8 right-2 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
          <p className="mb-1 font-semibold">{active.label}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ background: s.color }} />
              {s.label}: <span className="font-medium tabular-nums">{format(active[s.key])}</span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function niceCeil(value: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / exp;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : 10;
  return Math.max(nice * exp, 4);
}

function compactTick(value: number, prefix: string) {
  if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}M`;
  if (value >= 1_000) return `${prefix}${(value / 1_000).toFixed(value % 1_000 ? 1 : 0)}k`;
  return `${prefix}${Math.round(value)}`;
}

// ---------- Barras horizontales ----------

export function HorizontalBars({
  data,
  color = "#3B46A5",
  formatAmount,
  emptyText,
  href,
}: {
  data: BarDatum[];
  color?: string;
  formatAmount?: (value: number) => string;
  emptyText: string;
  href?: (datum: BarDatum) => string;
}) {
  const total = data.reduce((acc, row) => acc + row.value, 0);
  const max = Math.max(1, ...data.map((row) => row.value));
  if (!total) return <EmptyState>{emptyText}</EmptyState>;
  return (
    <ul className="space-y-2.5">
      {data.map((row) => {
        const content = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-foreground">{row.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                <span className="font-semibold text-foreground">{row.value}</span>
                {" · "}
                {formatPercent(row.value / total)}
                {formatAmount && row.amount ? ` · ${formatAmount(row.amount)}` : ""}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(row.value / max) * 100}%`, background: color }}
              />
            </div>
          </>
        );
        return (
          <li key={row.id}>
            {href ? (
              <Link href={href(row)} className="block rounded-lg hover:opacity-80">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------- Clientes ----------

export function ClientActivityTable({
  rows,
  show,
}: {
  rows: ClientActivity[];
  show: { service: boolean; sales: boolean; clients: boolean; quality: boolean };
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, 8);
  if (!rows.length) {
    return <EmptyState>Sin actividad de clientes en el periodo.</EmptyState>;
  }
  const th = "px-3 py-2 text-right text-[11px] font-semibold tracking-wide text-muted-foreground uppercase";
  const td = "px-3 py-2.5 text-right tabular-nums";
  return (
    <div>
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-y border-border bg-muted/40">
            <tr>
              <th className={cn(th, "text-left")}>Cliente</th>
              {show.service ? (
                <>
                  <th className={th}>OS periodo</th>
                  <th className={th}>OS abiertas</th>
                  <th className={th}>Servicio entregado</th>
                </>
              ) : null}
              {show.sales ? (
                <>
                  <th className={th}>Cotizaciones</th>
                  <th className={th}>Cotizado</th>
                  <th className={th}>Ganado</th>
                </>
              ) : null}
              {show.clients ? <th className={th}>Equipos</th> : null}
              {show.quality ? <th className={th}>CSAT</th> : null}
              <th className={th}>Última actividad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((row) => (
              <tr key={row.key} className="hover:bg-muted/30">
                <td className="px-3 py-2.5 text-left font-medium text-foreground">
                  <span className="block max-w-[240px] truncate" title={row.name}>
                    {row.name}
                  </span>
                </td>
                {show.service ? (
                  <>
                    <td className={td}>{row.orders || "—"}</td>
                    <td className={cn(td, row.openOrders ? "font-semibold text-[#3B46A5] dark:text-sky-300" : "")}>
                      {row.openOrders || "—"}
                    </td>
                    <td className={td}>{row.serviceRevenue ? formatMoney(row.serviceRevenue) : "—"}</td>
                  </>
                ) : null}
                {show.sales ? (
                  <>
                    <td className={td}>{row.quotes || "—"}</td>
                    <td className={td}>{row.quoted ? formatMoney(row.quoted) : "—"}</td>
                    <td className={cn(td, row.won ? "font-semibold text-emerald-700 dark:text-emerald-300" : "")}>
                      {row.won ? formatMoney(row.won) : "—"}
                    </td>
                  </>
                ) : null}
                {show.clients ? <td className={td}>{row.equipment || "—"}</td> : null}
                {show.quality ? <td className={td}>{row.csat !== null ? row.csat.toFixed(1) : "—"}</td> : null}
                <td className={cn(td, "text-muted-foreground")}>{formatShortDate(row.lastActivity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 8 ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 text-xs font-medium text-[#3B46A5] hover:underline dark:text-sky-300"
        >
          {expanded ? "Ver menos" : `Ver los ${rows.length} clientes`}
        </button>
      ) : null}
    </div>
  );
}

// ---------- Alertas ----------

export function AlertsPanel({ alerts }: { alerts: HomeAlert[] }) {
  const [area, setArea] = useState<HomeArea | "all">("all");
  const [expanded, setExpanded] = useState(false);
  const counts = new Map<HomeArea, number>();
  for (const alert of alerts) counts.set(alert.area, (counts.get(alert.area) ?? 0) + 1);
  const filtered = area === "all" ? alerts : alerts.filter((alert) => alert.area === area);
  const visible = expanded ? filtered : filtered.slice(0, 8);
  const critical = alerts.filter((alert) => alert.severity === "critical").length;

  return (
    <Panel
      title="Alertas y vencimientos"
      description={
        alerts.length
          ? `${alerts.length} pendientes · ${critical} ${critical === 1 ? "crítica" : "críticas"}`
          : "Todo en orden"
      }
      icon={AlertTriangle}
      className="flex flex-col"
    >
      {alerts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <CheckCircle2 className="size-8 text-emerald-600" />
          <p className="text-sm text-muted-foreground">No hay alertas en las áreas que puedes ver.</p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <AreaChip active={area === "all"} onClick={() => setArea("all")} label="Todas" count={alerts.length} />
            {Array.from(counts.entries()).map(([id, count]) => (
              <AreaChip
                key={id}
                active={area === id}
                onClick={() => setArea(id)}
                label={homeAreaLabel(id)}
                count={count}
              />
            ))}
          </div>
          <ul className="space-y-2">
            {visible.map((alert) => {
              const Icon = alert.severity === "critical" ? AlertOctagon : AlertTriangle;
              return (
                <li key={alert.id}>
                  <Link
                    href={alert.href}
                    className="flex items-start gap-2.5 rounded-xl border border-border/70 px-3 py-2 transition-colors hover:bg-muted/50"
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        alert.severity === "critical" ? "text-destructive" : "text-amber-600"
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{alert.title}</span>
                      {alert.detail ? (
                        <span className="block truncate text-xs text-muted-foreground">{alert.detail}</span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          alert.severity === "critical" ? "text-destructive" : "text-amber-700 dark:text-amber-300"
                        )}
                      >
                        {alert.due}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{homeAreaLabel(alert.area)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {filtered.length > 8 ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-3 self-start text-xs font-medium text-[#3B46A5] hover:underline dark:text-sky-300"
            >
              {expanded ? "Ver menos" : `Ver las ${filtered.length} alertas`}
            </button>
          ) : null}
        </>
      )}
    </Panel>
  );
}

function AreaChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {label} <span className="tabular-nums opacity-75">{count}</span>
    </button>
  );
}
