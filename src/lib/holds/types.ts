export const HOLD_STATUSES = [
  { id: "activo", label: "Activo" },
  { id: "liberado", label: "Liberado" },
  { id: "entregado", label: "Entregado" },
  { id: "cancelado", label: "Cancelado" },
] as const;

export type HoldStatus = (typeof HOLD_STATUSES)[number]["id"];

export type InventoryHoldLine = {
  id: string;
  holdId: string;
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  notes: string;
};

export type InventoryHold = {
  id: string;
  folio: string;
  projectName: string;
  clientName: string;
  clientCity: string;
  clientState: string;
  neededBy: string;
  status: HoldStatus;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lines: InventoryHoldLine[];
};

export type InventoryHoldLineInput = {
  productId: string;
  quantity: number;
  notes?: string;
};

export type InventoryHoldInput = {
  projectName: string;
  clientName?: string;
  clientCity?: string;
  clientState?: string;
  neededBy?: string;
  notes?: string;
  createdBy?: string;
  lines: InventoryHoldLineInput[];
};

export function holdStatusLabel(status: string) {
  return HOLD_STATUSES.find((item) => item.id === status)?.label ?? status;
}
