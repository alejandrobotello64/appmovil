import type { WarehouseModule } from "@/lib/auth/permissions";

export const PURCHASING_TABS = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Compras pendientes, urgentes y material en camino",
    href: "/dashboard/compras?tab=dashboard",
  },
  {
    id: "solicitudes",
    label: "Solicitudes de compra",
    description: "Faltantes de surtimiento y compras directas",
    href: "/dashboard/compras?tab=solicitudes",
  },
  {
    id: "ordenes",
    label: "Órdenes de compra",
    description: "Pedidos a proveedor y su recepción en almacén",
    href: "/dashboard/compras?tab=ordenes",
  },
  {
    id: "proveedores",
    label: "Proveedores",
    description: "Alta y administración de proveedores",
    href: "/dashboard/compras?tab=proveedores",
  },
] as const;

export type PurchasingTabId = (typeof PURCHASING_TABS)[number]["id"];

export const PURCHASING_MODULES: WarehouseModule[] = ["solicitudes_compra", "pedidos", "proveedores"];

/** Módulos que dan acceso a cada pestaña (basta con poder ver uno). */
export const PURCHASING_TAB_MODULES: Record<PurchasingTabId, WarehouseModule[]> = {
  dashboard: ["solicitudes_compra"],
  solicitudes: ["solicitudes_compra"],
  ordenes: ["pedidos"],
  proveedores: ["proveedores"],
};

export function normalizePurchasingTab(value: string | null): PurchasingTabId {
  return PURCHASING_TABS.some((tab) => tab.id === value) ? (value as PurchasingTabId) : "dashboard";
}
