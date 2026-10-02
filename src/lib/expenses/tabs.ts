import type { ExpenseKind } from "./types";

export const EXPENSE_TABS = [
  {
    id: "resumen",
    label: "Resumen y reportes",
    description: "Totales por tipo, categoría y colaborador; impresión de reportes",
    href: "/dashboard/gastos?tab=resumen",
  },
  {
    id: "viaticos",
    label: "Viáticos",
    description: "Viajes de trabajo con anticipo y comprobación",
    href: "/dashboard/gastos?tab=viaticos",
  },
  {
    id: "corriente",
    label: "Gastos corrientes",
    description: "Servicios, renta, papelería, mantenimiento y operación",
    href: "/dashboard/gastos?tab=corriente",
  },
  {
    id: "caja_chica",
    label: "Caja chica",
    description: "Fondo fijo para gastos menores, comprobado por periodo",
    href: "/dashboard/gastos?tab=caja_chica",
  },
  {
    id: "otros",
    label: "Otros gastos",
    description: "Gastos fuera de las otras clasificaciones",
    href: "/dashboard/gastos?tab=otros",
  },
] as const;

export type ExpenseTabId = (typeof EXPENSE_TABS)[number]["id"];

export function normalizeExpenseTab(value: string | null): ExpenseTabId {
  return EXPENSE_TABS.some((tab) => tab.id === value) ? (value as ExpenseTabId) : "resumen";
}

export function tabKind(tab: ExpenseTabId): ExpenseKind | null {
  return tab === "resumen" ? null : tab;
}
