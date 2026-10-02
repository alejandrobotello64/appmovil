export const QUOTE_STATUSES = [
  { id: "borrador", label: "Borrador" },
  { id: "enviada", label: "Enviada" },
  { id: "en_seguimiento", label: "En seguimiento" },
  { id: "negociacion", label: "Negociación" },
  { id: "aceptada", label: "Aceptada" },
  { id: "rechazada", label: "Rechazada" },
  { id: "vencida", label: "Vencida" },
  { id: "cancelada", label: "Cancelada" },
] as const;

export const QUOTE_PIPELINE_STATUSES = [
  "borrador",
  "enviada",
  "en_seguimiento",
  "negociacion",
  "aceptada",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number]["id"];

export type QuoteLine = {
  id: string;
  quoteId: string;
  productId: string | null;
  productSku: string;
  productName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  sortOrder: number;
  notes: string;
};

export type QuoteEvent = {
  id: string;
  quoteId: string;
  eventType: string;
  message: string;
  createdBy: string;
  createdAt: string;
};

export type Quote = {
  id: string;
  folio: string;
  title: string;
  clientId: string | null;
  clientName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  city: string;
  state: string;
  status: QuoteStatus;
  quoteDate: string;
  validUntil: string;
  nextFollowUp: string;
  lastContactAt: string;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  discount: number;
  discountPercent: number;
  salesperson: string;
  probability: number;
  notes: string;
  lossReason: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lines: QuoteLine[];
  events: QuoteEvent[];
};

export type QuoteLineInput = {
  productId?: string | null;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discountPercent?: number;
  discountAmount?: number;
  notes?: string;
};

export type QuoteInput = {
  title?: string;
  clientId?: string | null;
  clientName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  city?: string;
  state?: string;
  status?: QuoteStatus;
  quoteDate?: string;
  validUntil?: string;
  nextFollowUp?: string;
  lastContactAt?: string;
  taxRate?: number;
  discount?: number;
  discountPercent?: number;
  salesperson?: string;
  probability?: number;
  notes?: string;
  lossReason?: string;
  createdBy?: string;
  lines?: QuoteLineInput[];
};

export function quoteStatusLabel(status: string) {
  return QUOTE_STATUSES.find((item) => item.id === status)?.label ?? status;
}

type LineMath = {
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  discountAmount?: number;
};

export function clampPercent(value: unknown) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

export function clampAmount(value: unknown) {
  return Math.max(0, Number(value) || 0);
}

/** Importe antes del descuento de la partida. */
export function lineGrossAmount(line: LineMath) {
  return Number(line.quantity) * Number(line.unitPrice);
}

export function lineHasDiscount(line: LineMath) {
  return clampPercent(line.discountPercent) > 0 || clampAmount(line.discountAmount) > 0;
}

/** When `discountPercent` is above 0 it takes precedence over `discountAmount`. */
export function lineDiscountAmount(line: LineMath) {
  const gross = lineGrossAmount(line);
  const percent = clampPercent(line.discountPercent);
  const raw = percent > 0 ? gross * (percent / 100) : clampAmount(line.discountAmount);
  return Number(Math.min(Math.max(gross, 0), raw).toFixed(2));
}

export function lineDiscountLabel(line: LineMath, formatMoney: (value: number) => string) {
  const percent = clampPercent(line.discountPercent);
  if (percent > 0) return `${percent}%`;
  const amount = lineDiscountAmount(line);
  return amount > 0 ? formatMoney(amount) : "";
}

/** Importe neto de la partida (ya con su descuento). */
export function lineAmount(line: LineMath) {
  return Number((lineGrossAmount(line) - lineDiscountAmount(line)).toFixed(2));
}

/**
 * Line discounts are applied first; the general discount is applied on the
 * sum of net lines. When `discountPercent` is above 0 it takes precedence
 * over the fixed `discount` amount.
 */
export function computeQuoteTotals(
  lines: QuoteLineInput[],
  discount = 0,
  taxRate = 16,
  discountPercent = 0
) {
  const listAmount = lines.reduce((sum, line) => sum + lineGrossAmount(line), 0);
  const lineDiscounts = lines.reduce((sum, line) => sum + lineDiscountAmount(line), 0);
  const gross = lines.reduce((sum, line) => sum + lineAmount(line), 0);
  const percent = Math.min(100, Math.max(0, Number(discountPercent || 0)));
  const rawDiscount =
    percent > 0 ? gross * (percent / 100) : Math.max(0, Number(discount || 0));
  const discountAmount = Number(Math.min(gross, rawDiscount).toFixed(2));
  const subtotal = Math.max(0, gross - discountAmount);
  const taxAmount = subtotal * (Number(taxRate) / 100);
  return {
    listAmount: Number(listAmount.toFixed(2)),
    lineDiscounts: Number(lineDiscounts.toFixed(2)),
    gross: Number(gross.toFixed(2)),
    discountAmount,
    discountPercent: percent,
    subtotal: Number(subtotal.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    total: Number((subtotal + taxAmount).toFixed(2)),
  };
}
