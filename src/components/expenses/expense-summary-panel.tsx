"use client";

import { useMemo, useState } from "react";
import { FileDown, FileText, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportExpenseSummaryPdf, type PdfOutput } from "@/lib/expenses/pdf";
import { filterEntries, summarize, type SummaryFilters } from "@/lib/expenses/summary";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_KINDS,
  EXPENSE_STATUSES,
  categoryColor,
  categoryLabel,
  expenseKindMeta,
  formatDate,
  formatMoney,
  itemHasInvoice,
  statusMeta,
  todayIso,
  type ExpenseKind,
  type ExpenseStatus,
} from "@/lib/expenses/types";
import { cn } from "@/lib/utils";
import { CategoryBars, CategoryDot, Field, KpiCard, inputClass } from "./expense-ui";
import { useExpenseReports, type ExpenseViewer } from "./use-expense-reports";
import { SortableTable } from "@/components/ui/sortable-table";

const KIND_COLORS: Record<ExpenseKind, string> = {
  viaticos: "#3B46A5",
  corriente: "#00BFFF",
  caja_chica: "#14B8A6",
  otros: "#A3A3A3",
};

const DETAIL_LIMIT = 300;

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function presetRange(preset: "mes" | "mes_anterior" | "trimestre" | "anio"): [string, string] {
  const [y, m] = todayIso().split("-").map(Number);
  const lastDay = (year: number, month: number) => new Date(year, month, 0).getDate();
  switch (preset) {
    case "mes":
      return [iso(y, m, 1), iso(y, m, lastDay(y, m))];
    case "mes_anterior": {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      return [iso(py, pm, 1), iso(py, pm, lastDay(py, pm))];
    }
    case "trimestre": {
      const qStart = Math.floor((m - 1) / 3) * 3 + 1;
      return [iso(y, qStart, 1), iso(y, qStart + 2, lastDay(y, qStart + 2))];
    }
    case "anio":
      return [iso(y, 1, 1), iso(y, 12, 31)];
  }
}

type Props = {
  viewer: ExpenseViewer;
  canExport: boolean;
};

export function ExpenseSummaryPanel({ viewer, canExport }: Props) {
  const { reports, loading, error } = useExpenseReports(null, viewer);
  const [filters, setFilters] = useState<SummaryFilters>(() => {
    const [from, to] = presetRange("mes");
    return { from, to, kind: "", employee: "", status: "vigentes", category: "" };
  });
  const [includeItems, setIncludeItems] = useState(true);
  const [busy, setBusy] = useState("");
  const [pdfError, setPdfError] = useState("");

  const employees = useMemo(
    () => [...new Set(reports.map((r) => r.employeeName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [reports]
  );
  const entries = useMemo(() => filterEntries(reports, filters), [reports, filters]);
  const summary = useMemo(() => summarize(entries), [entries]);

  function patch(values: Partial<SummaryFilters>) {
    setFilters((prev) => ({ ...prev, ...values }));
  }

  function filterLines() {
    const lines = [`Periodo: ${formatDate(filters.from)} al ${formatDate(filters.to)}`];
    const parts = [
      filters.kind ? `Tipo: ${expenseKindMeta(filters.kind).label}` : "Tipo: todos",
      filters.status === "vigentes"
        ? "Estatus: vigentes (sin cancelados)"
        : filters.status
          ? `Estatus: ${statusMeta(filters.status).label}`
          : "Estatus: todos",
      filters.employee ? `Colaborador: ${filters.employee}` : "",
      filters.category ? `Categoría: ${categoryLabel(filters.category)}` : "",
    ].filter(Boolean);
    lines.push(parts.join("   ·   "));
    if (!viewer.seeAll) lines.push(`Solo registros de ${viewer.fullName || viewer.username}`);
    return lines;
  }

  async function exportPdf(output: PdfOutput) {
    setBusy(output);
    setPdfError("");
    try {
      await exportExpenseSummaryPdf({
        entries,
        reports,
        periodLabel: `${formatDate(filters.from)} – ${formatDate(filters.to)}`,
        filterLines: filterLines(),
        includeItems,
        output,
      });
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "No se pudo generar el PDF.");
    } finally {
      setBusy("");
    }
  }

  const maxKind = Math.max(...summary.byKind.map((row) => row.total), 0.01);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Resumen de gastos</h2>
            <p className="text-sm text-muted-foreground">
              Totales por fecha del gasto. Filtra y descarga o imprime el reporte.
              {!viewer.seeAll ? " Solo incluye tus registros." : ""}
            </p>
          </div>
          {canExport ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={includeItems}
                  onChange={(e) => setIncludeItems(e.target.checked)}
                  className="size-4 accent-[#3B46A5]"
                />
                Incluir detalle de gastos
              </label>
              <Button variant="outline" onClick={() => void exportPdf("print")} disabled={Boolean(busy) || loading}>
                {busy === "print" ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
                Imprimir
              </Button>
              <Button onClick={() => void exportPdf("download")} disabled={Boolean(busy) || loading}>
                {busy === "download" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
                Descargar PDF
              </Button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["mes", "Este mes"],
              ["mes_anterior", "Mes anterior"],
              ["trimestre", "Trimestre"],
              ["anio", "Este año"],
            ] as const
          ).map(([preset, label]) => {
            const [from, to] = presetRange(preset);
            const active = filters.from === from && filters.to === to;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => patch({ from, to })}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  active
                    ? "border-[#3B46A5] bg-[#3B46A5]/10 font-medium text-[#3B46A5]"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Desde">
            <input type="date" className={inputClass} value={filters.from} onChange={(e) => patch({ from: e.target.value })} />
          </Field>
          <Field label="Hasta">
            <input
              type="date"
              className={inputClass}
              value={filters.to}
              min={filters.from}
              onChange={(e) => patch({ to: e.target.value })}
            />
          </Field>
          <Field label="Tipo">
            <select className={inputClass} value={filters.kind} onChange={(e) => patch({ kind: e.target.value as ExpenseKind | "" })}>
              <option value="">Todos</option>
              {EXPENSE_KINDS.map((kind) => (
                <option key={kind.id} value={kind.id}>
                  {kind.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Categoría">
            <select className={inputClass} value={filters.category} onChange={(e) => patch({ category: e.target.value })}>
              <option value="">Todas</option>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Colaborador">
            <select className={inputClass} value={filters.employee} onChange={(e) => patch({ employee: e.target.value })}>
              <option value="">Todos</option>
              {employees.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estatus">
            <select
              className={inputClass}
              value={filters.status}
              onChange={(e) => patch({ status: e.target.value as ExpenseStatus | "" | "vigentes" })}
            >
              <option value="vigentes">Vigentes</option>
              <option value="">Todos</option>
              {EXPENSE_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {pdfError ? <p className="mt-3 text-sm text-destructive">{pdfError}</p> : null}
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <KpiCard label="Total de gastos" value={formatMoney(summary.total)} />
            <KpiCard label="Registros" value={summary.reports} />
            <KpiCard label="Comprobantes" value={summary.count} />
            <KpiCard label="Con factura" value={formatMoney(summary.invoiced)} tone={summary.invoiced > 0 ? "success" : undefined} />
            <KpiCard
              label="Sin factura"
              value={formatMoney(summary.withoutInvoice)}
              tone={summary.withoutInvoice > 0 ? "warning" : undefined}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-3 font-semibold">Por tipo de gasto</h3>
              {summary.byKind.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin gastos en el periodo.</p>
              ) : (
                <ul className="space-y-2.5">
                  {summary.byKind.map((row) => (
                    <li key={row.kind} className="text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2">
                          <CategoryDot color={KIND_COLORS[row.kind]} />
                          {row.label}
                          <span className="text-xs text-muted-foreground">({row.reports})</span>
                        </span>
                        <span className="font-medium tabular-nums">
                          {formatMoney(row.total)}{" "}
                          <span className="text-xs font-normal text-muted-foreground">{(row.share * 100).toFixed(0)}%</span>
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.max((row.total / maxKind) * 100, 2)}%`, background: KIND_COLORS[row.kind] }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-3 font-semibold">Por categoría</h3>
              <CategoryBars rows={summary.byCategory} emptyMessage="Sin gastos en el periodo." />
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-3 font-semibold">Por colaborador</h3>
              {summary.byEmployee.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin gastos en el periodo.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {summary.byEmployee.map((row) => (
                    <li key={row.name} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate">{row.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {row.reports} registros · {row.count} comprobantes
                        </span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">{formatMoney(row.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-border bg-card shadow-sm">
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h3 className="font-semibold">Detalle de gastos</h3>
              <span className="text-xs text-muted-foreground">
                {entries.length > DETAIL_LIMIT
                  ? `Mostrando ${DETAIL_LIMIT} de ${entries.length}; el PDF incluye todos.`
                  : `${entries.length} gastos`}
              </span>
            </header>
            {entries.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sin gastos con estos filtros.</p>
            ) : (
              <div className="overflow-x-auto">
                <SortableTable className="w-full min-w-[720px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Fecha</th>
                      <th className="px-4 py-2.5 font-medium">Folio</th>
                      <th className="px-4 py-2.5 font-medium">Categoría</th>
                      <th className="px-4 py-2.5 font-medium">Concepto / proveedor</th>
                      <th className="px-4 py-2.5 font-medium">Responsable</th>
                      <th className="px-4 py-2.5 font-medium">Factura</th>
                      <th className="px-4 py-2.5 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {entries.slice(0, DETAIL_LIMIT).map(({ item, report }) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(item.expenseDate)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <p className="font-medium">{report.folio}</p>
                          <p className="text-xs text-muted-foreground">{expenseKindMeta(report.kind).label}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2">
                            <CategoryDot color={categoryColor(item.category)} />
                            {categoryLabel(item.category)}
                          </span>
                        </td>
                        <td className="max-w-xs px-4 py-2.5">
                          <p className="truncate">{item.concept || item.supplierName || "—"}</p>
                          {item.concept && item.supplierName ? (
                            <p className="truncate text-xs text-muted-foreground">{item.supplierName}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5">{report.employeeName}</td>
                        <td className="px-4 py-2.5">
                          {item.pdfUrl ? (
                            <a
                              href={item.pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#3B46A5] hover:underline"
                            >
                              <FileText className="size-3.5" />
                              Ver
                            </a>
                          ) : itemHasInvoice(item) ? (
                            <span className="text-muted-foreground">XML</span>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-300">Sin factura</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap tabular-nums">
                          {formatMoney(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/40 font-semibold">
                      <td className="px-4 py-2.5" colSpan={6}>
                        Total
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(summary.total)}</td>
                    </tr>
                  </tfoot>
                </SortableTable>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
