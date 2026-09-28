"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlarmClock,
  BadgeDollarSign,
  BookOpenText,
  FileText,
  Gauge,
  Target,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useSessionAccess } from "@/lib/auth/use-permissions";
import { daysUntilExpiry } from "@/lib/inventory/expiry";
import { getQuotes } from "@/lib/quotes/storage";
import {
  QUOTE_PIPELINE_STATUSES,
  quoteStatusLabel,
  type Quote,
} from "@/lib/quotes/types";
import { getCatalogDocuments } from "@/lib/sales-catalog/storage";
import {
  CATALOG_DOC_TYPES,
  catalogDocTypeLabel,
  type CatalogDocument,
} from "@/lib/sales-catalog/types";
import { cn } from "@/lib/utils";

const CLOSED_STATUSES = ["aceptada", "rechazada", "vencida", "cancelada"];
const LOST_STATUSES = ["rechazada", "vencida"];

const PERIODS = [
  { id: "mes", label: "Este mes" },
  { id: "trimestre", label: "Últimos 3 meses" },
  { id: "anio", label: "Este año" },
  { id: "todo", label: "Todo" },
] as const;

type PeriodId = (typeof PERIODS)[number]["id"];

const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const COTIZACIONES_HREF = "/dashboard/ventas?tab=cotizaciones";
const CATALOGO_HREF = "/dashboard/ventas?tab=catalogo";

function money(value: number, compact = false) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value || 0);
}

function periodStart(period: PeriodId): string | null {
  const now = new Date();
  if (period === "mes") {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  }
  if (period === "trimestre") {
    return new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10);
  }
  if (period === "anio") return `${now.getFullYear()}-01-01`;
  return null;
}

function quoteDay(quote: Quote) {
  return (quote.quoteDate || quote.createdAt).slice(0, 10);
}

export function SalesDashboard() {
  const { canView } = useSessionAccess();
  const showQuotes = canView("cotizaciones");
  const showCatalog = canView("catalogo_ventas");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [documents, setDocuments] = useState<CatalogDocument[]>([]);
  const [period, setPeriod] = useState<PeriodId>("anio");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      showQuotes ? getQuotes() : Promise.resolve([]),
      showCatalog ? getCatalogDocuments("ventas") : Promise.resolve([]),
    ])
      .then(([quoteRows, docRows]) => {
        setQuotes(quoteRows);
        setDocuments(docRows);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "No se pudo cargar el dashboard de ventas."
        );
      })
      .finally(() => setLoading(false));
  }, [showQuotes, showCatalog]);

  const stats = useMemo(() => {
    const start = periodStart(period);
    const inPeriod = start ? quotes.filter((q) => quoteDay(q) >= start) : quotes;
    const won = inPeriod.filter((q) => q.status === "aceptada");
    const lost = inPeriod.filter((q) => LOST_STATUSES.includes(q.status));
    const open = quotes.filter((q) => !CLOSED_STATUSES.includes(q.status));

    const wonAmount = won.reduce((sum, q) => sum + q.total, 0);
    const openAmount = open.reduce((sum, q) => sum + q.total, 0);
    const forecast = open.reduce((sum, q) => sum + q.total * (q.probability / 100), 0);
    const decided = won.length + lost.length;
    const winRate = decided ? Math.round((won.length / decided) * 100) : null;

    const followUps = open
      .map((q) => ({ quote: q, days: daysUntilExpiry(q.nextFollowUp) }))
      .filter((row): row is { quote: Quote; days: number } => row.days !== null && row.days <= 7)
      .sort((a, b) => a.days - b.days);
    const expiring = open
      .map((q) => ({ quote: q, days: daysUntilExpiry(q.validUntil) }))
      .filter((row): row is { quote: Quote; days: number } => row.days !== null && row.days <= 7)
      .sort((a, b) => a.days - b.days);

    const funnel = QUOTE_PIPELINE_STATUSES.map((status) => {
      const rows = (status === "aceptada" ? won : open).filter((q) => q.status === status);
      return {
        status,
        count: rows.length,
        amount: rows.reduce((sum, q) => sum + q.total, 0),
      };
    });

    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const rows = quotes.filter((q) => quoteDay(q).startsWith(key));
      return {
        key,
        label: MONTH_LABELS[date.getMonth()],
        quoted: rows
          .filter((q) => q.status !== "cancelada")
          .reduce((sum, q) => sum + q.total, 0),
        won: rows
          .filter((q) => q.status === "aceptada")
          .reduce((sum, q) => sum + q.total, 0),
      };
    });

    function ranking(keyOf: (q: Quote) => string) {
      const map = new Map<string, { name: string; amount: number; won: number; total: number }>();
      for (const q of inPeriod) {
        if (q.status === "cancelada") continue;
        const name = keyOf(q).trim() || "Sin asignar";
        const entry = map.get(name) ?? { name, amount: 0, won: 0, total: 0 };
        entry.total += 1;
        if (q.status === "aceptada") {
          entry.won += 1;
          entry.amount += q.total;
        }
        map.set(name, entry);
      }
      return [...map.values()]
        .sort((a, b) => b.amount - a.amount || b.won - a.won || b.total - a.total)
        .slice(0, 5);
    }

    const lossReasons = new Map<string, number>();
    for (const q of lost) {
      const reason = q.lossReason.trim();
      if (reason) lossReasons.set(reason, (lossReasons.get(reason) ?? 0) + 1);
    }

    return {
      wonCount: won.length,
      wonAmount,
      avgTicket: won.length ? wonAmount / won.length : 0,
      openCount: open.length,
      openAmount,
      forecast,
      winRate,
      decided,
      followUps,
      overdueFollowUps: followUps.filter((row) => row.days < 0).length,
      expiring,
      funnel,
      months,
      topClients: ranking((q) => q.clientName),
      topSellers: ranking((q) => q.salesperson),
      lossReasons: [...lossReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
      quotedInPeriod: inPeriod.length,
    };
  }, [quotes, period]);

  const catalogStats = useMemo(() => {
    const byType = CATALOG_DOC_TYPES.map((type) => ({
      ...type,
      count: documents.filter((doc) => doc.docType === type.id).length,
    })).filter((type) => type.count > 0);
    const expiring = documents
      .map((doc) => ({ doc, days: daysUntilExpiry(doc.validUntil) }))
      .filter((row): row is { doc: CatalogDocument; days: number } => row.days !== null && row.days <= 30)
      .sort((a, b) => a.days - b.days);
    const brands = new Set(documents.map((doc) => doc.brand.trim()).filter(Boolean));
    return {
      total: documents.length,
      byType,
      expiring,
      brands: brands.size,
      recent: documents.slice(0, 5),
    };
  }, [documents]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando dashboard de ventas…</p>;
  }

  if (error) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    );
  }

  const maxMonth = Math.max(1, ...stats.months.map((m) => Math.max(m.quoted, m.won)));
  const maxFunnel = Math.max(1, ...stats.funnel.map((f) => f.amount));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#3B46A5]">Dashboard de ventas</h2>
          <p className="text-sm text-muted-foreground">
            Cotizaciones, cierres, seguimientos y catálogo comercial.
          </p>
        </div>
        {showQuotes ? (
          <div
            role="group"
            aria-label="Periodo"
            className="inline-flex rounded-xl border border-border bg-card p-1 shadow-sm"
          >
            {PERIODS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                aria-pressed={period === item.id}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  period === item.id
                    ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {showQuotes ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Ventas cerradas"
              value={money(stats.wonAmount, true)}
              hint={`${stats.wonCount} cotizaciones aceptadas · ticket ${money(stats.avgTicket, true)}`}
              icon={BadgeDollarSign}
              href={COTIZACIONES_HREF}
            />
            <KpiCard
              label="Pipeline abierto"
              value={money(stats.openAmount, true)}
              hint={`${stats.openCount} cotizaciones en curso`}
              icon={TrendingUp}
              href={COTIZACIONES_HREF}
            />
            <KpiCard
              label="Pronóstico ponderado"
              value={money(stats.forecast, true)}
              hint="Monto abierto × probabilidad de cierre"
              icon={Gauge}
              href={COTIZACIONES_HREF}
            />
            <KpiCard
              label="Tasa de cierre"
              value={stats.winRate === null ? "—" : `${stats.winRate}%`}
              hint={
                stats.decided
                  ? `${stats.wonCount} ganadas de ${stats.decided} decididas`
                  : "Aún no hay cotizaciones decididas en el periodo"
              }
              icon={Target}
              href={COTIZACIONES_HREF}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-5">
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm xl:col-span-3">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Cotizado vs. cerrado · últimos 6 meses</h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-[#00BFFF]/45" /> Cotizado
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-[#3B46A5]" /> Cerrado
                  </span>
                </div>
              </div>
              <div className="flex h-52 items-end gap-2 sm:gap-4">
                {stats.months.map((month) => (
                  <div key={month.key} className="flex h-full flex-1 flex-col items-center gap-2">
                    <div className="flex w-full flex-1 items-end justify-center gap-1">
                      <div
                        className="w-1/2 max-w-7 rounded-t-md bg-[#00BFFF]/45 transition-all"
                        style={{ height: `${(month.quoted / maxMonth) * 100}%` }}
                        title={`Cotizado ${month.label}: ${money(month.quoted)}`}
                      />
                      <div
                        className="w-1/2 max-w-7 rounded-t-md bg-[#3B46A5] transition-all"
                        style={{ height: `${(month.won / maxMonth) * 100}%` }}
                        title={`Cerrado ${month.label}: ${money(month.won)}`}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium">{month.label}</p>
                      <p className="text-[10px] tabular-nums text-muted-foreground">
                        {month.won ? money(month.won, true) : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm xl:col-span-2">
              <h3 className="mb-4 text-sm font-semibold">Embudo de ventas</h3>
              <ul className="space-y-3">
                {stats.funnel.map((row) => (
                  <li key={row.status}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium">{quoteStatusLabel(row.status)}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {row.count} · {money(row.amount, true)}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          row.status === "aceptada"
                            ? "bg-emerald-500"
                            : "bg-[linear-gradient(90deg,#00BFFF,#3B46A5)]"
                        )}
                        style={{ width: `${Math.max(row.count ? 4 : 0, (row.amount / maxFunnel) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11px] text-muted-foreground">
                Etapas abiertas con su estado actual; aceptadas dentro del periodo elegido.
              </p>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <RankingCard title="Mejores clientes" icon={Trophy} rows={stats.topClients} />
            <RankingCard title="Vendedores" icon={Target} rows={stats.topSellers} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <AlarmClock className="size-4 text-[#3B46A5]" /> Seguimientos próximos
                </h3>
                {stats.overdueFollowUps ? (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    {stats.overdueFollowUps} vencidos
                  </span>
                ) : null}
              </div>
              <DueList
                empty="Sin seguimientos en los próximos 7 días."
                rows={stats.followUps.slice(0, 6).map(({ quote, days }) => ({
                  id: quote.id,
                  title: `${quote.folio} · ${quote.clientName || "Sin cliente"}`,
                  subtitle: `${quote.salesperson || "Sin vendedor"} · ${money(quote.total)}`,
                  days,
                }))}
              />
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <FileText className="size-4 text-[#3B46A5]" /> Cotizaciones por vencer
              </h3>
              <DueList
                empty="Ninguna cotización abierta vence en los próximos 7 días."
                rows={stats.expiring.slice(0, 6).map(({ quote, days }) => ({
                  id: quote.id,
                  title: `${quote.folio} · ${quote.clientName || "Sin cliente"}`,
                  subtitle: `${quoteStatusLabel(quote.status)} · ${money(quote.total)}`,
                  days,
                }))}
              />
              {stats.lossReasons.length ? (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Motivos de pérdida en el periodo
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {stats.lossReasons.map(([reason, count]) => (
                      <span
                        key={reason}
                        className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                      >
                        {reason} · {count}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </>
      ) : null}

      {showCatalog ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <BookOpenText className="size-4 text-[#3B46A5]" /> Catálogo comercial
            </h3>
            <Link href={CATALOGO_HREF} className="text-xs text-[#3B46A5] hover:underline">
              Abrir catálogo
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Documentos</p>
                  <p className="text-2xl font-semibold tabular-nums">{catalogStats.total}</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Marcas</p>
                  <p className="text-2xl font-semibold tabular-nums">{catalogStats.brands}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {catalogStats.byType.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aún no hay documentos.</p>
                ) : (
                  catalogStats.byType.map((type) => (
                    <span
                      key={type.id}
                      className="rounded-full bg-[#3B46A5]/10 px-2.5 py-0.5 text-xs font-medium text-[#3B46A5] dark:text-sky-300"
                    >
                      {type.label} · {type.count}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Recientes</p>
              {catalogStats.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin documentos recientes.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {catalogStats.recent.map((doc) => (
                    <li key={doc.id} className="py-2 text-sm">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium hover:text-[#3B46A5] hover:underline"
                      >
                        {doc.title}
                      </a>
                      <p className="truncate text-xs text-muted-foreground">
                        {catalogDocTypeLabel(doc.docType)}
                        {doc.brand ? ` · ${doc.brand}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Vigencias por vencer (30 días)
              </p>
              <DueList
                empty="Sin certificados ni listas por vencer."
                rows={catalogStats.expiring.slice(0, 5).map(({ doc, days }) => ({
                  id: doc.id,
                  title: doc.title,
                  subtitle: catalogDocTypeLabel(doc.docType),
                  days,
                }))}
              />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        <Icon className="size-4 text-[#3B46A5]" />
      </div>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Link>
  );
}

function RankingCard({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: LucideIcon;
  rows: { name: string; amount: number; won: number; total: number }[];
}) {
  const max = Math.max(1, ...rows.map((row) => row.amount));
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-[#3B46A5]" /> {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin cotizaciones en el periodo.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li key={row.name}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  <span className="mr-2 text-xs text-muted-foreground tabular-nums">
                    {index + 1}.
                  </span>
                  {row.name}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {money(row.amount, true)} · {row.won}/{row.total} ganadas
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#00BFFF,#3B46A5)]"
                  style={{ width: `${(row.amount / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DueList({
  rows,
  empty,
}: {
  rows: { id: string; title: string; subtitle: string; days: number }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between gap-2 py-2 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">{row.title}</p>
            <p className="truncate text-xs text-muted-foreground">{row.subtitle}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
              row.days < 0
                ? "bg-destructive/10 text-destructive"
                : row.days <= 3
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {row.days < 0
              ? `Venció hace ${Math.abs(row.days)} d`
              : row.days === 0
                ? "Hoy"
                : `En ${row.days} d`}
          </span>
        </li>
      ))}
    </ul>
  );
}
