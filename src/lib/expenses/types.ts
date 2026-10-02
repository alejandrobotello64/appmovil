export const EXPENSE_KINDS = [
  {
    id: "viaticos",
    label: "Viáticos",
    singular: "viaje",
    description: "Viajes y comisiones de trabajo, con anticipo y comprobación.",
    advanceLabel: "Anticipo",
    isTrip: true,
  },
  {
    id: "corriente",
    label: "Gastos corrientes",
    singular: "registro",
    description: "Gastos de operación: servicios, renta, papelería, mantenimiento…",
    advanceLabel: "",
    isTrip: false,
  },
  {
    id: "caja_chica",
    label: "Caja chica",
    singular: "corte",
    description: "Fondo fijo para gastos menores; se comprueba por periodo.",
    advanceLabel: "Fondo asignado",
    isTrip: false,
  },
  {
    id: "otros",
    label: "Otros gastos",
    singular: "registro",
    description: "Gastos que no entran en las otras clasificaciones.",
    advanceLabel: "Anticipo",
    isTrip: false,
  },
] as const;

export type ExpenseKind = (typeof EXPENSE_KINDS)[number]["id"];

type CategoryDef = {
  id: string;
  label: string;
  color: string;
  /** Tipos de registro donde se ofrece; "otros" admite todas. */
  kinds: ExpenseKind[];
};

export const EXPENSE_CATEGORIES = [
  { id: "hospedaje", label: "Hospedaje", color: "#3B46A5", kinds: ["viaticos"] },
  { id: "alimentos", label: "Alimentos", color: "#00BFFF", kinds: ["viaticos", "caja_chica"] },
  { id: "transporte_aereo", label: "Vuelos", color: "#8B5CF6", kinds: ["viaticos"] },
  {
    id: "transporte_terrestre",
    label: "Autobús / taxi / app",
    color: "#14B8A6",
    kinds: ["viaticos", "caja_chica"],
  },
  { id: "renta_auto", label: "Renta de auto", color: "#F97316", kinds: ["viaticos"] },
  {
    id: "combustible",
    label: "Combustible",
    color: "#EF4444",
    kinds: ["viaticos", "corriente", "caja_chica"],
  },
  { id: "casetas", label: "Casetas y peajes", color: "#EAB308", kinds: ["viaticos", "caja_chica"] },
  {
    id: "estacionamiento",
    label: "Estacionamiento",
    color: "#64748B",
    kinds: ["viaticos", "caja_chica"],
  },
  { id: "renta", label: "Renta de inmuebles", color: "#0EA5E9", kinds: ["corriente"] },
  { id: "servicios", label: "Luz, agua y gas", color: "#22C55E", kinds: ["corriente"] },
  { id: "telefonia", label: "Teléfono e internet", color: "#6366F1", kinds: ["corriente"] },
  {
    id: "papeleria",
    label: "Papelería y oficina",
    color: "#EC4899",
    kinds: ["corriente", "caja_chica"],
  },
  {
    id: "limpieza",
    label: "Limpieza y cafetería",
    color: "#84CC16",
    kinds: ["corriente", "caja_chica"],
  },
  { id: "mantenimiento", label: "Mantenimiento de instalaciones", color: "#D97706", kinds: ["corriente"] },
  {
    id: "mensajeria",
    label: "Mensajería y paquetería",
    color: "#06B6D4",
    kinds: ["corriente", "caja_chica"],
  },
  { id: "software", label: "Software y suscripciones", color: "#A855F7", kinds: ["corriente"] },
  { id: "honorarios", label: "Honorarios profesionales", color: "#BE123C", kinds: ["corriente"] },
  { id: "comisiones_bancarias", label: "Comisiones bancarias", color: "#475569", kinds: ["corriente"] },
  { id: "publicidad", label: "Publicidad y marketing", color: "#F43F5E", kinds: ["corriente"] },
  { id: "impuestos_derechos", label: "Impuestos y derechos", color: "#78716C", kinds: ["corriente"] },
  { id: "otros", label: "Otros", color: "#A3A3A3", kinds: ["viaticos", "corriente", "caja_chica"] },
] as const satisfies readonly CategoryDef[];

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]["id"];

export const EXPENSE_STATUSES = [
  { id: "en_captura", label: "En captura", tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  { id: "por_revisar", label: "Por revisar", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { id: "aprobado", label: "Aprobado", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { id: "rechazado", label: "Rechazado", tone: "bg-destructive/10 text-destructive" },
  { id: "cerrado", label: "Cerrado", tone: "bg-muted text-foreground" },
  { id: "cancelado", label: "Cancelado", tone: "bg-muted text-muted-foreground line-through" },
] as const;

export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number]["id"];

export const PAYMENT_METHODS = [
  { id: "efectivo", label: "Efectivo del anticipo / fondo", short: "Efectivo / fondo", paidByEmployee: true },
  { id: "personal", label: "Pagado por el colaborador", short: "Colaborador", paidByEmployee: true },
  { id: "tarjeta_empresa", label: "Tarjeta de la empresa", short: "Tarjeta empresa", paidByEmployee: false },
  { id: "pago_empresa", label: "Pago directo de la empresa", short: "Pago empresa", paidByEmployee: false },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["id"];

export type ExpenseItem = {
  id: string;
  reportId: string;
  expenseDate: string;
  category: ExpenseCategoryId;
  concept: string;
  supplierName: string;
  supplierRfc: string;
  invoiceNumber: string;
  cfdiUuid: string;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  pdfPath: string;
  pdfUrl: string;
  xmlPath: string;
  xmlUrl: string;
  notes: string;
  createdBy: string;
  createdAt: string;
};

export type ExpenseReportEvent = {
  id: string;
  reportId: string;
  eventType: string;
  message: string;
  createdBy: string;
  createdAt: string;
};

export type ExpenseReport = {
  id: string;
  folio: string;
  kind: ExpenseKind;
  title: string;
  employeeName: string;
  employeeUsername: string;
  department: string;
  purpose: string;
  destination: string;
  clientName: string;
  startDate: string;
  endDate: string;
  advanceAmount: number;
  status: ExpenseStatus;
  reviewedBy: string;
  reviewedAt: string;
  reviewNotes: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: ExpenseItem[];
  events: ExpenseReportEvent[];
};

export type ExpenseReportInput = {
  kind: ExpenseKind;
  title: string;
  employeeName: string;
  employeeUsername: string;
  department: string;
  purpose: string;
  destination: string;
  clientName: string;
  startDate: string;
  endDate: string;
  advanceAmount: number;
  notes: string;
};

export type ExpenseItemInput = {
  expenseDate: string;
  category: ExpenseCategoryId;
  concept: string;
  supplierName: string;
  supplierRfc: string;
  invoiceNumber: string;
  cfdiUuid: string;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  notes: string;
  pdfFile?: File | null;
  xmlFile?: File | null;
};

export function expenseKindMeta(id: string) {
  return EXPENSE_KINDS.find((item) => item.id === id) ?? EXPENSE_KINDS[3];
}

export function categoriesForKind(kind: ExpenseKind) {
  if (kind === "otros") return [...EXPENSE_CATEGORIES];
  return EXPENSE_CATEGORIES.filter((item) =>
    (item.kinds as readonly ExpenseKind[]).includes(kind)
  );
}

export function categoryLabel(id: string) {
  return EXPENSE_CATEGORIES.find((item) => item.id === id)?.label ?? id;
}

export function categoryColor(id: string) {
  return EXPENSE_CATEGORIES.find((item) => item.id === id)?.color ?? "#A3A3A3";
}

export function statusMeta(id: string) {
  return EXPENSE_STATUSES.find((item) => item.id === id) ?? EXPENSE_STATUSES[0];
}

export function paymentMethodLabel(id: string, short = false) {
  const method = PAYMENT_METHODS.find((item) => item.id === id);
  if (!method) return id;
  return short ? method.short : method.label;
}

function paidByEmployee(method: string) {
  return PAYMENT_METHODS.find((item) => item.id === method)?.paidByEmployee ?? true;
}

/** Título para listas: destino en viáticos, título capturado en los demás tipos. */
export function reportTitle(report: Pick<ExpenseReport, "kind" | "title" | "destination" | "purpose">) {
  if (report.kind === "viaticos") {
    return report.destination ? `Viaje a ${report.destination}` : report.title || "Viaje";
  }
  return report.title || report.purpose || expenseKindMeta(report.kind).label;
}

/** El responsable puede capturar o corregir gastos. */
export function isReportEditable(status: ExpenseStatus) {
  return status === "en_captura" || status === "rechazado";
}

/** Factura = XML, UUID o folio capturado; un PDF/foto sin esos datos es solo ticket. */
export function itemHasInvoice(item: Pick<ExpenseItem, "xmlPath" | "cfdiUuid" | "invoiceNumber">) {
  return Boolean(item.xmlPath || item.cfdiUuid.trim() || item.invoiceNumber.trim());
}

export type CategoryTotal = {
  category: string;
  label: string;
  color: string;
  count: number;
  total: number;
  invoiced: number;
  share: number;
};

export function categoryTotals(items: ExpenseItem[]): CategoryTotal[] {
  const grand = items.reduce((sum, item) => sum + item.total, 0);
  const totals = new Map<string, CategoryTotal>();
  for (const item of items) {
    let row = totals.get(item.category);
    if (!row) {
      row = {
        category: item.category,
        label: categoryLabel(item.category),
        color: categoryColor(item.category),
        count: 0,
        total: 0,
        invoiced: 0,
        share: 0,
      };
      totals.set(item.category, row);
    }
    row.count += 1;
    row.total += item.total;
    if (itemHasInvoice(item)) row.invoiced += item.total;
  }
  return [...totals.values()]
    .map((row) => ({ ...row, share: grand > 0 ? row.total / grand : 0 }))
    .sort((a, b) => b.total - a.total);
}

export type ReportBalance = {
  spent: number;
  advance: number;
  employeePaid: number;
  companyPaid: number;
  invoiced: number;
  withoutInvoice: number;
  /** > 0: el colaborador reintegra · < 0: la empresa le reembolsa. */
  balance: number;
};

export function reportBalance(report: Pick<ExpenseReport, "advanceAmount" | "items">): ReportBalance {
  const spent = report.items.reduce((sum, item) => sum + item.total, 0);
  const employeePaid = report.items
    .filter((item) => paidByEmployee(item.paymentMethod))
    .reduce((sum, item) => sum + item.total, 0);
  const invoiced = report.items
    .filter(itemHasInvoice)
    .reduce((sum, item) => sum + item.total, 0);
  return {
    spent,
    advance: report.advanceAmount,
    employeePaid,
    companyPaid: spent - employeePaid,
    invoiced,
    withoutInvoice: spent - invoiced,
    balance: report.advanceAmount - employeePaid,
  };
}

export function balanceLabel(balance: number, short = false) {
  if (Math.abs(balance) < 0.005) return "Sin saldo pendiente";
  if (short) return balance > 0 ? "Saldo a reintegrar" : "Saldo a reembolsar";
  return balance > 0 ? "A reintegrar por el colaborador" : "A reembolsar al colaborador";
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatDate(value: string) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export function reportDays(report: Pick<ExpenseReport, "startDate" | "endDate">) {
  const start = new Date(`${report.startDate}T00:00:00`);
  const end = new Date(`${report.endDate}T00:00:00`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Number.isFinite(days) && days > 0 ? days : 1;
}

export function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
