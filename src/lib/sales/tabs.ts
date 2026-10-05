import type { WarehouseModule } from "@/lib/auth/permissions";

export const SALES_TABS = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Indicadores de cotizaciones, cierres y catálogo",
    href: "/dashboard/ventas?tab=dashboard",
  },
  {
    id: "cotizaciones",
    label: "Cotizaciones",
    description: "Cotizaciones de venta y seguimiento comercial",
    href: "/dashboard/ventas?tab=cotizaciones",
  },
  {
    id: "surtimientos",
    label: "Surtimientos",
    description: "Material pedido a almacén desde cotizaciones y su avance de entrega",
    href: "/dashboard/ventas?tab=surtimientos",
  },
  {
    id: "catalogo",
    label: "Catálogo",
    description: "Brochures, folletos y presentaciones comerciales",
    href: "/dashboard/ventas?tab=catalogo",
  },
] as const;

export type SalesTabId = (typeof SALES_TABS)[number]["id"];

export const SALES_MODULES: WarehouseModule[] = ["cotizaciones", "catalogo_ventas"];

/** Módulos que dan acceso a cada pestaña (basta con poder ver uno). */
export const SALES_TAB_MODULES: Record<SalesTabId, WarehouseModule[]> = {
  dashboard: SALES_MODULES,
  cotizaciones: ["cotizaciones"],
  surtimientos: ["cotizaciones"],
  catalogo: ["catalogo_ventas"],
};

export function isSalesTabId(value: string | null): value is SalesTabId {
  return SALES_TABS.some((tab) => tab.id === value);
}

export function normalizeSalesTab(value: string | null): SalesTabId {
  return isSalesTabId(value) ? value : "dashboard";
}
