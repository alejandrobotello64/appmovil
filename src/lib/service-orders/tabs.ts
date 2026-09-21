export const SERVICE_ORDER_TABS = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Resumen de biomédica y órdenes abiertas",
    href: "/dashboard/ordenes-servicio?tab=dashboard",
  },
  {
    id: "ordenes",
    label: "Órdenes de servicio",
    description: "Recepción y seguimiento de equipos",
    href: "/dashboard/ordenes-servicio?tab=ordenes",
  },
  {
    id: "instrumentos",
    label: "Simuladores y analizadores",
    description: "Alta de equipos de prueba con foto y PDF de certificación",
    href: "/dashboard/ordenes-servicio?tab=instrumentos",
  },
  {
    id: "solicitudes",
    label: "Pedidos a almacén",
    description: "Insumos y refacciones solicitados desde OS",
    href: "/dashboard/ordenes-servicio?tab=solicitudes",
  },
  {
    id: "plantillas",
    label: "Checklist",
    description: "Plantillas de revisión por tipo de equipo",
    href: "/dashboard/ordenes-servicio?tab=plantillas",
  },
] as const;

export type ServiceOrderTabId = (typeof SERVICE_ORDER_TABS)[number]["id"];

export function isServiceOrderTabId(
  value: string | null
): value is ServiceOrderTabId {
  return SERVICE_ORDER_TABS.some((tab) => tab.id === value);
}

export function normalizeServiceOrderTab(
  value: string | null
): ServiceOrderTabId {
  return isServiceOrderTabId(value) ? value : "dashboard";
}
