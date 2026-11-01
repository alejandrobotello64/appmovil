import {
  EXPENSE_CATEGORIES,
  EXPENSE_KINDS,
  categoryColor,
  categoryLabel,
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

export type SpendGrain = "day" | "week" | "month";

export type SpendSegment = {
  category: string;
  label: string;
  color: string;
  total: number;
  count: number;
};

export const EXPENSE_KIND_COLORS: Record<ExpenseKind, string> = {
  viaticos: "#3B46A5",
  corriente: "#00BFFF",
  caja_chica: "#14B8A6",
  otros: "#A3A3A3",
};

export type SpendKindSlice = {
  kind: ExpenseKind;
  label: string;
  color: string;
  total: number;
  count: number;
  categories: SpendSegment[];
};

export type SpendBucket = {
  key: string;
  label: string;
  total: number;
  count: number;
  segments: SpendSegment[];
  kinds: SpendKindSlice[];
};

export type SpendInsights = {
  from: string;
  to: string;
  days: number;
  activeDays: number;
  dailyAverage: number;
  activeDayAverage: number;
  perReceipt: number;
  peak: { label: string; total: number; date: string } | null;
  grain: SpendGrain;
  buckets: SpendBucket[];
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function parseIso(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

function formatIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function inclusiveDays(from: string, to: string) {
  const diff = Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000);
  return Number.isFinite(diff) ? Math.max(diff + 1, 1) : 1;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() + (day === 0 ? -6 : 1 - day));
  return next;
}

function grainFor(days: number): SpendGrain {
  if (days <= 45) return "day";
  if (days <= 180) return "week";
  return "month";
}

function periodKey(date: string, grain: SpendGrain) {
  const parsed = parseIso(date);
  if (grain === "month") return date.slice(0, 7);
  if (grain === "week") return formatIso(startOfWeek(parsed));
  return date.slice(0, 10);
}

function periodLabel(key: string, grain: SpendGrain) {
  if (grain === "month") {
    const [year, month] = key.split("-").map(Number);
    return `${MONTHS[(month || 1) - 1]} ${year}`;
  }
  const start = parseIso(key);
  if (grain === "week") {
    const end = addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const startText = `${start.getDate()} ${sameMonth ? "" : MONTHS[start.getMonth()]}`.trim();
    return `${startText}–${end.getDate()} ${MONTHS[end.getMonth()]}`;
  }
  return `${start.getDate()} ${MONTHS[start.getMonth()]}`;
}

function enumerateKeys(from: string, to: string, grain: SpendGrain) {
  const keys: string[] = [];
  const end = parseIso(to);
  let cursor = parseIso(periodKey(from, grain));
  while (cursor <= end) {
    keys.push(grain === "month" ? formatIso(cursor).slice(0, 7) : formatIso(cursor));
    if (grain === "month") cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    else cursor = addDays(cursor, grain === "week" ? 7 : 1);
  }
  return keys;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function categoryOrder(id: string) {
  const index = EXPENSE_CATEGORIES.findIndex((item) => item.id === id);
  return index === -1 ? EXPENSE_CATEGORIES.length : index;
}

function emptySegments(): SpendSegment[] {
  return EXPENSE_CATEGORIES.map((category) => ({
    category: category.id,
    label: category.label,
    color: categoryColor(category.id),
    total: 0,
    count: 0,
  }));
}

function emptyKinds(): SpendKindSlice[] {
  return EXPENSE_KINDS.map((kind) => ({
    kind: kind.id,
    label: kind.label,
    color: EXPENSE_KIND_COLORS[kind.id],
    total: 0,
    count: 0,
    categories: [],
  }));
}

function addSegment(segments: SpendSegment[], category: string, amount: number) {
  const found = segments.find((item) => item.category === category);
  if (found) {
    found.total += amount;
    found.count += 1;
    return;
  }
  segments.push({
    category,
    label: categoryLabel(category),
    color: categoryColor(category),
    total: amount,
    count: 1,
  });
}

function finishSegments(segments: SpendSegment[]) {
  return segments
    .filter((segment) => segment.count > 0)
    .map((segment) => ({ ...segment, total: roundMoney(segment.total) }))
    .sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category));
}

export function grainPeakLabel(grain: SpendGrain) {
  if (grain === "week") return "Semana más alta";
  if (grain === "month") return "Mes más alto";
  return "Día más alto";
}

export function grainSeriesLabel(grain: SpendGrain) {
  if (grain === "week") return "Cada barra es una semana, de lunes a domingo.";
  if (grain === "month") return "Cada barra es un mes.";
  return "Cada barra es un día.";
}

/** Totales del periodo, promedio diario y serie para la gráfica y la cronología. */
export function spendInsights(entries: ExpenseEntry[], from: string, to: string): SpendInsights {
  const dated = entries.map((entry) => entry.item.expenseDate).filter(Boolean).sort();
  const rangeFrom = from || dated[0] || "";
  const rangeTo = to || dated[dated.length - 1] || rangeFrom;
  const total = entries.reduce((sum, entry) => sum + entry.item.total, 0);
  const days = rangeFrom && rangeTo ? inclusiveDays(rangeFrom, rangeTo) : 1;
  const grain = grainFor(days);
  const buckets = new Map<string, SpendBucket>();

  if (rangeFrom && rangeTo) {
    for (const key of enumerateKeys(rangeFrom, rangeTo, grain)) {
      buckets.set(key, {
        key,
        label: periodLabel(key, grain),
        total: 0,
        count: 0,
        segments: emptySegments(),
        kinds: emptyKinds(),
      });
    }
  }

  for (const entry of entries) {
    if (!entry.item.expenseDate) continue;
    const key = periodKey(entry.item.expenseDate, grain);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        label: periodLabel(key, grain),
        total: 0,
        count: 0,
        segments: emptySegments(),
        kinds: emptyKinds(),
      };
      buckets.set(key, bucket);
    }
    bucket.total += entry.item.total;
    bucket.count += 1;
    addSegment(bucket.segments, entry.item.category, entry.item.total);
    const kindSlice = bucket.kinds.find((item) => item.kind === entry.report.kind);
    if (kindSlice) {
      kindSlice.total += entry.item.total;
      kindSlice.count += 1;
      addSegment(kindSlice.categories, entry.item.category, entry.item.total);
    }
  }

  const series = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
  for (const bucket of series) {
    bucket.total = roundMoney(bucket.total);
    bucket.segments = finishSegments(bucket.segments);
    bucket.kinds = bucket.kinds
      .filter((kind) => kind.count > 0)
      .map((kind) => ({
        ...kind,
        total: roundMoney(kind.total),
        categories: finishSegments(kind.categories),
      }));
  }
  const active = series.filter((bucket) => bucket.count > 0);
  const activeDays = new Set(entries.map((entry) => entry.item.expenseDate).filter(Boolean)).size;
  const peak = active.reduce<SpendBucket | null>((best, bucket) => (!best || bucket.total > best.total ? bucket : best), null);

  return {
    from: rangeFrom,
    to: rangeTo,
    days,
    activeDays,
    dailyAverage: roundMoney(total / days),
    activeDayAverage: activeDays > 0 ? roundMoney(total / activeDays) : 0,
    perReceipt: entries.length > 0 ? roundMoney(total / entries.length) : 0,
    peak: peak ? { label: peak.label, total: peak.total, date: peak.key } : null,
    grain,
    buckets: series,
  };
}
