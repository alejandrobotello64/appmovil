import type { WarehouseModule } from "@/lib/auth/permissions";

export const COMPRAS_TABS = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Seguimiento de solicitudes, pedidos y surtimiento",
    href: "/dashboard/compras?tab=dashboard",
  },
  {
    id: "solicitudes",
    label: "Solicitudes",
    description: "Pedidos de almacén cuando no se pudo surtir",
    href: "/dashboard/compras?tab=solicitudes",
  },
  {
    id: "pedidos",
    label: "Pedidos",
    description: "Órdenes de compra y recepción",
    href: "/dashboard/compras?tab=pedidos",
  },
  {
    id: "proveedores",
    label: "Proveedores",
    description: "Alta y administración de proveedores",
    href: "/dashboard/compras?tab=proveedores",
  },
] as const;

export type ComprasTabId = (typeof COMPRAS_TABS)[number]["id"];

export const COMPRAS_MODULES: WarehouseModule[] = [
  "solicitudes_compra",
  "pedidos",
  "proveedores",
];

export const COMPRAS_TAB_MODULES: Record<ComprasTabId, WarehouseModule[]> = {
  dashboard: COMPRAS_MODULES,
  solicitudes: ["solicitudes_compra"],
  pedidos: ["pedidos"],
  proveedores: ["proveedores"],
};

export function isComprasTabId(value: string | null): value is ComprasTabId {
  return COMPRAS_TABS.some((tab) => tab.id === value);
}

export function normalizeComprasTab(value: string | null): ComprasTabId {
  return isComprasTabId(value) ? value : "dashboard";
}
