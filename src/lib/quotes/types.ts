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

export function lineAmount(line: Pick<QuoteLine, "quantity" | "unitPrice">) {
  return Number(line.quantity) * Number(line.unitPrice);
}

export function computeQuoteTotals(
  lines: QuoteLineInput[],
  discount = 0,
  taxRate = 16
) {
  const subtotal = Math.max(
    0,
    lines.reduce(
      (sum, line) => sum + Number(line.quantity) * Number(line.unitPrice),
      0
    ) - Number(discount || 0)
  );
  const taxAmount = subtotal * (Number(taxRate) / 100);
  return {
    subtotal: Number(subtotal.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    total: Number((subtotal + taxAmount).toFixed(2)),
  };
}
