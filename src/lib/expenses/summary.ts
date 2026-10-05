import {
  EXPENSE_KINDS,
  categoryTotals,
  itemHasInvoice,
  type CategoryTotal,
  type ExpenseItem,
  type ExpenseKind,
  type ExpenseReport,
  type ExpenseStatus,
} from "./types";

export type ExpenseEntry = { item: ExpenseItem; report: ExpenseReport };

export type SummaryFilters = {
  from: string;
  to: string;
  kind: ExpenseKind | "";
  employee: string;
  status: ExpenseStatus | "" | "vigentes";
  category: string;
};

export type KindTotal = {
  kind: ExpenseKind;
  label: string;
  reports: number;
  count: number;
  total: number;
  share: number;
};

export type EmployeeTotal = {
  name: string;
  reports: number;
  count: number;
  total: number;
};

export type ExpenseSummary = {
  total: number;
  count: number;
  reports: number;
  invoiced: number;
  withoutInvoice: number;
  byKind: KindTotal[];
  byCategory: CategoryTotal[];
  byEmployee: EmployeeTotal[];
};

/** Gastos de los registros que cumplen los filtros, acotados por fecha del gasto. */
export function filterEntries(reports: ExpenseReport[], filters: SummaryFilters): ExpenseEntry[] {
  const employee = filters.employee.trim().toLowerCase();
  const entries: ExpenseEntry[] = [];
  for (const report of reports) {
    if (filters.kind && report.kind !== filters.kind) continue;
    if (filters.status === "vigentes" && report.status === "cancelado") continue;
    if (filters.status && filters.status !== "vigentes" && report.status !== filters.status) continue;
    if (employee && report.employeeName.trim().toLowerCase() !== employee) continue;
    for (const item of report.items) {
      if (filters.from && item.expenseDate < filters.from) continue;
      if (filters.to && item.expenseDate > filters.to) continue;
      if (filters.category && item.category !== filters.category) continue;
      entries.push({ item, report });
    }
  }
  return entries.sort(
    (a, b) =>
      a.item.expenseDate.localeCompare(b.item.expenseDate) ||
      a.report.folio.localeCompare(b.report.folio)
  );
}

export function summarize(entries: ExpenseEntry[]): ExpenseSummary {
  const items = entries.map((entry) => entry.item);
  const total = items.reduce((sum, item) => sum + item.total, 0);
  const invoiced = items.filter(itemHasInvoice).reduce((sum, item) => sum + item.total, 0);

  const byKind = EXPENSE_KINDS.map((kind) => {
    const rows = entries.filter((entry) => entry.report.kind === kind.id);
    const kindTotal = rows.reduce((sum, entry) => sum + entry.item.total, 0);
    return {
      kind: kind.id,
      label: kind.label,
      reports: new Set(rows.map((entry) => entry.report.id)).size,
      count: rows.length,
      total: kindTotal,
      share: total > 0 ? kindTotal / total : 0,
    };
  }).filter((row) => row.count > 0);

  const employees = new Map<string, { name: string; reports: Set<string>; count: number; total: number }>();
  for (const entry of entries) {
    const name = entry.report.employeeName || "Sin responsable";
    const key = name.toLowerCase();
    let row = employees.get(key);
    if (!row) {
      row = { name, reports: new Set(), count: 0, total: 0 };
      employees.set(key, row);
    }
    row.reports.add(entry.report.id);
    row.count += 1;
    row.total += entry.item.total;
  }

  return {
    total,
    count: items.length,
    reports: new Set(entries.map((entry) => entry.report.id)).size,
    invoiced,
    withoutInvoice: total - invoiced,
    byKind,
    byCategory: categoryTotals(items),
    byEmployee: [...employees.values()]
      .map((row) => ({ name: row.name, reports: row.reports.size, count: row.count, total: row.total }))
      .sort((a, b) => b.total - a.total),
  };
}
