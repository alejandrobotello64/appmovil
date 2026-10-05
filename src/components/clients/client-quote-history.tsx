"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileDown,
  FileText,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/auth/use-permissions";
import { getClientQuotes } from "@/lib/quotes/storage";
import {
  lineAmount,
  quoteStatusLabel,
  type Quote,
  type QuoteStatus,
} from "@/lib/quotes/types";
import { cn } from "@/lib/utils";

const CLOSED_LOST: QuoteStatus[] = ["rechazada", "vencida", "cancelada"];

const FILTERS = [
  { id: "todas", label: "Todas" },
  { id: "abiertas", label: "En proceso" },
  { id: "aceptadas", label: "Aceptadas" },
  { id: "perdidas", label: "Perdidas" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const STATUS_TONE: Record<QuoteStatus, string> = {
  borrador: "bg-muted text-muted-foreground",
  enviada: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  en_seguimiento: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-200",
  negociacion: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  aceptada: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  rechazada: "bg-rose-500/15 text-rose-800 dark:text-rose-200",
  vencida: "bg-orange-500/15 text-orange-800 dark:text-orange-200",
  cancelada: "bg-muted text-muted-foreground line-through",
};

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function formatDateTime(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function isOpen(quote: Quote) {
  return quote.status !== "aceptada" && !CLOSED_LOST.includes(quote.status);
}

function matchesFilter(quote: Quote, filter: FilterId) {
  if (filter === "abiertas") return isOpen(quote);
  if (filter === "aceptadas") return quote.status === "aceptada";
  if (filter === "perdidas") return CLOSED_LOST.includes(quote.status);
  return true;
}

type LoadedState = {
  key: string;
  quotes: Quote[];
  error: string;
};

export function ClientQuoteHistory({
  client,
}: {
  client: { id: string; name: string };
}) {
  const { canView, canExport } = usePermissions("cotizaciones");
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<LoadedState | null>(null);
  const [filter, setFilter] = useState<FilterId>("todas");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState("");

  const key = `${client.id}:${client.name}:${reloadKey}`;
  useEffect(() => {
    if (!canView) return;
    let active = true;
    getClientQuotes({ id: client.id, name: client.name })
      .then((quotes) => {
        if (active) setState({ key, quotes, error: "" });
      })
      .catch((err) => {
        if (active)
          setState({
            key,
            quotes: [],
            error:
              err instanceof Error
                ? err.message
                : "No se pudo cargar el historial de cotizaciones.",
          });
      });
    return () => {
      active = false;
    };
  }, [canView, client.id, client.name, key]);

  const loading = state?.key !== key;
  const quotes = useMemo(
    () => (state?.key.startsWith(`${client.id}:`) ? state.quotes : []),
    [state, client.id]
  );

  const stats = useMemo(() => {
    const accepted = quotes.filter((quote) => quote.status === "aceptada");
    const lost = quotes.filter((quote) => CLOSED_LOST.includes(quote.status));
    const open = quotes.filter(isOpen);
    const decided = accepted.length + lost.length;
    return {
      total: quotes.length,
      accepted: accepted.length,
      winRate: decided ? Math.round((accepted.length / decided) * 100) : null,
      wonAmount: accepted.reduce((sum, quote) => sum + quote.total, 0),
      openCount: open.length,
      openAmount: open.reduce((sum, quote) => sum + quote.total, 0),
      lastQuoteDate: quotes[0]?.quoteDate || quotes[0]?.createdAt || "",
    };
  }, [quotes]);

  const visible = useMemo(
    () => quotes.filter((quote) => matchesFilter(quote, filter)),
    [quotes, filter]
  );

  async function handlePdf(quote: Quote) {
    setPdfBusyId(quote.id);
    setPdfError("");
    try {
      const { downloadQuotePdf } = await import("@/lib/quotes/pdf");
      await downloadQuotePdf(quote);
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : "No se pudo generar el PDF."
      );
    } finally {
      setPdfBusyId(null);
    }
  }

  if (!canView) return null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4" />
          Historial de cotizaciones ({stats.total})
        </h4>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-xs text-muted-foreground hover:bg-muted/50"
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          Actualizar
        </button>
      </div>

      {state?.error && !loading ? (
        <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {pdfError ? (
        <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {pdfError}
        </p>
      ) : null}

      {loading && !quotes.length ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Cargando cotizaciones…
        </p>
      ) : quotes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Este cliente aún no tiene cotizaciones registradas.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Cotizaciones</p>
              <p className="font-semibold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">
                Última: {formatDate(stats.lastQuoteDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aceptadas</p>
              <p className="font-semibold">{stats.accepted}</p>
              <p className="text-xs text-muted-foreground">
                Cierre:{" "}
                {stats.winRate === null ? "sin decisiones" : `${stats.winRate}%`}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monto ganado</p>
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                {money(stats.wonAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">En proceso</p>
              <p className="font-semibold">{money(stats.openAmount)}</p>
              <p className="text-xs text-muted-foreground">
                {stats.openCount} abierta{stats.openCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => {
              const count = quotes.filter((quote) =>
                matchesFilter(quote, item.id)
              ).length;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition",
                    filter === item.id
                      ? "border-[#3B46A5] bg-[#3B46A5] text-white"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {item.label}
                  <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No hay cotizaciones con este filtro.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
              {visible.map((quote) => {
                const expanded = expandedId === quote.id;
                return (
                  <li key={quote.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId((current) =>
                          current === quote.id ? null : quote.id
                        )
                      }
                      aria-expanded={expanded}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/40"
                    >
                      {expanded ? (
                        <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{quote.folio}</span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              STATUS_TONE[quote.status] ??
                                "bg-muted text-muted-foreground"
                            )}
                          >
                            {quoteStatusLabel(quote.status)}
                          </span>
                          {!quote.clientId ? (
                            <span
                              className="rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                              title="Capturada con el nombre del cliente, sin ligarla al catálogo de clientes"
                            >
                              Por nombre
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {quote.title || "Sin título"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(quote.quoteDate)}
                          {quote.salesperson ? ` · ${quote.salesperson}` : ""}
                          {` · ${quote.lines.length} partida${quote.lines.length === 1 ? "" : "s"}`}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold">
                        {money(quote.total)}
                      </span>
                    </button>

                    {expanded ? (
                      <div className="space-y-3 border-t border-border bg-muted/20 px-4 py-3 text-sm">
                        <div className="grid gap-2 sm:grid-cols-3">
                          <p>
                            <span className="text-xs text-muted-foreground">
                              Contacto:{" "}
                            </span>
                            {quote.contactName || "—"}
                          </p>
                          <p>
                            <span className="text-xs text-muted-foreground">
                              Vigencia:{" "}
                            </span>
                            {formatDate(quote.validUntil)}
                          </p>
                          <p>
                            <span className="text-xs text-muted-foreground">
                              Probabilidad:{" "}
                            </span>
                            {quote.probability}%
                          </p>
                        </div>
                        {quote.lossReason ? (
                          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-800 dark:text-rose-200">
                            Motivo de pérdida: {quote.lossReason}
                          </p>
                        ) : null}

                        {quote.lines.length ? (
                          <div className="overflow-x-auto rounded-lg border border-border bg-background">
                            <table className="min-w-full text-xs">
                              <thead className="bg-muted/50 text-left text-muted-foreground">
                                <tr>
                                  <th className="px-3 py-2 font-medium">Partida</th>
                                  <th className="px-3 py-2 text-right font-medium">Cant.</th>
                                  <th className="px-3 py-2 text-right font-medium">P. unit.</th>
                                  <th className="px-3 py-2 text-right font-medium">Importe</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {quote.lines.map((line) => (
                                  <tr key={line.id}>
                                    <td className="px-3 py-2">
                                      <p>{line.description || line.productName}</p>
                                      {line.productSku ? (
                                        <p className="text-muted-foreground">
                                          {line.productSku}
                                        </p>
                                      ) : null}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      {line.quantity} {line.unit}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      {money(line.unitPrice)}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      {money(lineAmount(line))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Sin partidas capturadas.
                          </p>
                        )}

                        {quote.events.length ? (
                          <div>
                            <p className="mb-1 text-xs font-medium text-muted-foreground">
                              Bitácora reciente
                            </p>
                            <ul className="space-y-1">
                              {quote.events.slice(0, 5).map((event) => (
                                <li key={event.id} className="text-xs">
                                  <span className="text-muted-foreground">
                                    {formatDateTime(event.createdAt)}
                                    {event.createdBy ? ` · ${event.createdBy}` : ""}
                                    {" — "}
                                  </span>
                                  {event.message}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                          {canExport ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={pdfBusyId === quote.id}
                              onClick={() => void handlePdf(quote)}
                            >
                              <FileDown className="size-4" />
                              {pdfBusyId === quote.id ? "Generando…" : "PDF"}
                            </Button>
                          ) : null}
                          <Link
                            href={`/dashboard/ventas?tab=cotizaciones&quote=${quote.id}`}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-3 text-xs font-medium hover:bg-muted/50"
                          >
                            <ExternalLink className="size-3.5" />
                            Abrir en Ventas
                          </Link>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
