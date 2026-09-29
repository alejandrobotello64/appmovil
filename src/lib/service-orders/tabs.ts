import type { WarehouseModule } from "@/lib/auth/permissions";

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
    id: "herramientas",
    label: "Solicitud de herramientas",
    description: "Pide herramientas a almacén con vale foliado, devolución e historial",
    href: "/dashboard/ordenes-servicio?tab=herramientas",
  },
  {
    id: "plantillas",
    label: "Checklist",
    description:
      "Plantillas de verificación y de pruebas de funcionamiento por tipo de equipo",
    href: "/dashboard/ordenes-servicio?tab=plantillas",
  },
  {
    id: "documentos",
    label: "Documentos técnicos",
    description:
      "Manuales de usuario y de servicio, fichas técnicas, boletines y diagramas",
    href: "/dashboard/ordenes-servicio?tab=documentos",
  },
  {
    id: "contrasenas",
    label: "Contraseñas de servicio",
    description: "Contraseñas de usuario, biomédica y servicio de los equipos",
    href: "/dashboard/ordenes-servicio?tab=contrasenas",
  },
] as const;

export type ServiceOrderTabId = (typeof SERVICE_ORDER_TABS)[number]["id"];

export const SERVICE_ORDER_TAB_MODULE: Record<ServiceOrderTabId, WarehouseModule> = {
  dashboard: "ordenes_servicio",
  ordenes: "ordenes_servicio",
  instrumentos: "instrumentos",
  solicitudes: "ordenes_servicio",
  herramientas: "solicitud_herramientas",
  plantillas: "plantillas_checklist",
  documentos: "documentos_tecnicos",
  contrasenas: "contrasenas_servicio",
};

export const BIOMEDICA_MODULES: WarehouseModule[] = [
  "ordenes_servicio",
  "instrumentos",
  "solicitud_herramientas",
  "plantillas_checklist",
  "documentos_tecnicos",
  "contrasenas_servicio",
  "educacion",
];

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
