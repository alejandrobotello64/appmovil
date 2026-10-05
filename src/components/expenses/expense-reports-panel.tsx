"use client";

import { useMemo, useState } from "react";
import { Eye, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DesktopTable, ResponsiveDataList, type DataListItem } from "@/components/ui/responsive-data-list";
import { SearchInput } from "@/components/ui/search-input";
import { deleteExpenseReport } from "@/lib/expenses/storage";
import {
  EXPENSE_STATUSES,
  balanceLabel,
  expenseKindMeta,
  formatDate,
  formatMoney,
  itemHasInvoice,
  reportBalance,
  reportTitle,
  todayIso,
  type ExpenseKind,
  type ExpenseReport,
} from "@/lib/expenses/types";
import { matchesSearch } from "@/lib/search";
import { ExpenseReportDetail, type ExpenseAccess } from "./expense-report-detail";
import { ExpenseReportForm } from "./expense-report-form";
import { KpiCard, StatusBadge, inputClass } from "./expense-ui";
import { useExpenseReports, type ExpenseViewer } from "./use-expense-reports";
import { SortableTable } from "@/components/ui/sortable-table";

type PeriodFilter = "todos" | "mes" | "mes_anterior" | "anio";

function periodRange(period: PeriodFilter): [string, string] | null {
  const today = todayIso();
  const [y, m] = today.split("-").map(Number);
  const iso = (year: number, month: number, day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  switch (period) {
    case "mes":
      return [iso(y, m, 1), iso(y, m, new Date(y, m, 0).getDate())];
    case "mes_anterior": {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      return [iso(py, pm, 1), iso(py, pm, new Date(py, pm, 0).getDate())];
    }
    case "anio":
      return [iso(y, 1, 1), iso(y, 12, 31)];
    default:
      return null;
  }
}

type Props = {
  kind: ExpenseKind;
  access: ExpenseAccess;
  viewer: ExpenseViewer;
  actor: string;
};

export function ExpenseReportsPanel({ kind, access, viewer, actor }: Props) {
  const meta = expenseKindMeta(kind);
  const { reports, loading, error, reload } = useExpenseReports(kind, viewer);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("vigentes");
  const [period, setPeriod] = useState<PeriodFilter>("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<{ report: ExpenseReport | null } | null>(null);
  const [notice, setNotice] = useState("");

  const selected = reports.find((report) => report.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const range = periodRange(period);
    return reports.filter((report) => {
      if (status === "vigentes" && report.status === "cancelado") return false;
      if (status !== "vigentes" && status !== "todos" && report.status !== status) return false;
      if (range && (report.endDate < range[0] || report.startDate > range[1])) return false;
      return matchesSearch(query, [
        report.folio,
        report.title,
        report.destination,
        report.clientName,
        report.employeeName,
        report.department,
        report.purpose,
        ...report.items.flatMap((item) => [item.concept, item.supplierName, item.invoiceNumber]),
      ]);
    });
  }, [reports, query, status, period]);

  const kpis = useMemo(() => {
    const [monthStart, monthEnd] = periodRange("mes")!;
    const active = reports.filter((report) => report.status !== "cancelado");
    const monthItems = active.flatMap((report) =>
      report.items.filter((item) => item.expenseDate >= monthStart && item.expenseDate <= monthEnd)
    );
    return {
      capturing: reports.filter((r) => r.status === "en_captura" || r.status === "rechazado").length,
      reviewing: reports.filter((r) => r.status === "por_revisar").length,
      monthTotal: monthItems.reduce((sum, item) => sum + item.total, 0),
      monthWithoutInvoice: monthItems.filter((item) => !itemHasInvoice(item)).reduce((sum, item) => sum + item.total, 0),
      pendingBalance: active
        .filter((r) => r.status === "aprobado")
        .reduce((sum, r) => sum + reportBalance(r).balance, 0),
    };
  }, [reports]);

  async function removeReport(report: ExpenseReport) {
    if (!confirm(`¿Eliminar definitivamente ${report.folio} con sus ${report.items.length} gastos y comprobantes?`)) return;
    try {
      await deleteExpenseReport(report);
      setSelectedId(null);
      setNotice(`${report.folio} eliminado.`);
      await reload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  const rows: DataListItem[] = filtered.map((report) => {
    const balance = reportBalance(report);
    return {
      key: report.id,
      title: `${report.folio} · ${reportTitle(report)}`,
      subtitle: `${report.employeeName} · ${formatDate(report.startDate)} – ${formatDate(report.endDate)}`,
      badge: <StatusBadge status={report.status} />,
      onSelect: () => setSelectedId(report.id),
      fields: [
        { label: "Gastos", value: `${report.items.length} · ${formatMoney(balance.spent)}` },
        ...(meta.advanceLabel
          ? [
              { label: meta.advanceLabel, value: formatMoney(balance.advance) },
              { label: balanceLabel(balance.balance), value: formatMoney(Math.abs(balance.balance)) },
            ]
          : []),
      ],
    };
  });

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div>
          <h2 className="text-lg font-semibold">{meta.label}</h2>
          <p className="text-sm text-muted-foreground">
            {meta.description}
            {!viewer.seeAll ? " Solo ves los registros a tu nombre." : ""}
          </p>
        </div>
        {access.canCreate ? (
          <Button onClick={() => setForm({ report: null })}>
            <Plus className="size-4" />
            Nuevo {meta.singular}
          </Button>
        ) : null}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="En captura" value={kpis.capturing} hint="Incluye rechazados por corregir" />
        <KpiCard label="Por revisar" value={kpis.reviewing} tone={kpis.reviewing ? "warning" : undefined} />
        <KpiCard
          label="Gastado este mes"
          value={formatMoney(kpis.monthTotal)}
          hint={kpis.monthWithoutInvoice > 0 ? `${formatMoney(kpis.monthWithoutInvoice)} sin factura` : undefined}
        />
        {meta.advanceLabel ? (
          <KpiCard
            label="Saldo de aprobados"
            value={formatMoney(Math.abs(kpis.pendingBalance))}
            hint={
              Math.abs(kpis.pendingBalance) < 0.005
                ? "Sin saldos por liquidar"
                : kpis.pendingBalance > 0
                  ? "A reintegrar por colaboradores"
                  : "A reembolsar a colaboradores"
            }
          />
        ) : (
          <KpiCard label="Registros" value={reports.filter((r) => r.status !== "cancelado").length} hint="Vigentes" />
        )}
      </div>

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Buscar por folio, responsable, concepto, proveedor…"
            className="lg:max-w-md"
          />
          <div className="flex gap-2">
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estatus">
              <option value="vigentes">Vigentes</option>
              <option value="todos">Todos</option>
              {EXPENSE_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
              aria-label="Periodo"
            >
              <option value="todos">Cualquier fecha</option>
              <option value="mes">Este mes</option>
              <option value="mes_anterior">Mes anterior</option>
              <option value="anio">Este año</option>
            </select>
          </div>
        </div>

        {notice ? <p className="border-b border-border px-4 py-2 text-sm text-muted-foreground">{notice}</p> : null}
        {error ? <p className="px-4 py-3 text-sm text-destructive">{error}</p> : null}

        {loading ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando…
          </p>
        ) : (
          <>
            <ResponsiveDataList items={rows} emptyMessage="Sin registros con estos filtros." />
            <DesktopTable>
              {filtered.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Sin registros con estos filtros.</p>
              ) : (
                <SortableTable className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Folio</th>
                      <th className="px-4 py-2.5 font-medium">{meta.isTrip ? "Viaje" : "Descripción"}</th>
                      <th className="px-4 py-2.5 font-medium">Responsable</th>
                      <th className="px-4 py-2.5 font-medium">{meta.isTrip ? "Fechas" : "Periodo"}</th>
                      <th className="px-4 py-2.5 text-right font-medium">Gastos</th>
                      {meta.advanceLabel ? <th className="px-4 py-2.5 text-right font-medium">Saldo</th> : null}
                      <th className="px-4 py-2.5 font-medium">Estatus</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((report) => {
                      const balance = reportBalance(report);
                      return (
                        <tr
                          key={report.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => setSelectedId(report.id)}
                        >
                          <td className="px-4 py-3 font-medium whitespace-nowrap">{report.folio}</td>
                          <td className="max-w-xs px-4 py-3">
                            <p className="truncate font-medium">{reportTitle(report)}</p>
                            {report.clientName || report.purpose ? (
                              <p className="truncate text-xs text-muted-foreground">{report.clientName || report.purpose}</p>
                            ) : null}
                          </td>
                          <td className="min-w-48 px-4 py-3">
                            <p>{report.employeeName}</p>
                            {report.department ? <p className="text-xs text-muted-foreground">{report.department}</p> : null}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {formatDate(report.startDate)}
                            {report.endDate !== report.startDate ? ` – ${formatDate(report.endDate)}` : ""}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                            <p className="font-medium">{formatMoney(balance.spent)}</p>
                            <p className="text-xs text-muted-foreground">{report.items.length} comprobantes</p>
                          </td>
                          {meta.advanceLabel ? (
                            <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                              <p className="font-medium">{formatMoney(Math.abs(balance.balance))}</p>
                              <p className="text-xs text-muted-foreground">
                                {Math.abs(balance.balance) < 0.005
                                  ? "Sin saldo"
                                  : balance.balance > 0
                                    ? "A reintegrar"
                                    : "A reembolsar"}
                              </p>
                            </td>
                          ) : null}
                          <td className="px-4 py-3">
                            <StatusBadge status={report.status} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" variant="outline" aria-label={`Ver ${report.folio}`}>
                              <Eye className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </SortableTable>
              )}
            </DesktopTable>
          </>
        )}
      </section>

      {selected ? (
        <ExpenseReportDetail
          report={selected}
          access={access}
          actor={actor}
          onClose={() => setSelectedId(null)}
          onChanged={reload}
          onEditReport={() => setForm({ report: selected })}
          onDeleteReport={() => void removeReport(selected)}
        />
      ) : null}

      {form ? (
        <ExpenseReportForm
          kind={kind}
          report={form.report}
          actor={actor}
          currentUser={{ name: viewer.fullName || viewer.username, username: viewer.username }}
          canChooseEmployee={viewer.seeAll}
          onClose={() => setForm(null)}
          onSaved={async (created) => {
            setForm(null);
            await reload();
            if (created) setSelectedId(created.id);
          }}
        />
      ) : null}
    </div>
  );
}
