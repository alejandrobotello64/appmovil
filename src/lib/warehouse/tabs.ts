import {
  INVENTORY_TAB_MODULES,
  type WarehouseModule,
} from "@/lib/auth/permissions";

export const WAREHOUSE_TABS = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Indicadores del almacén",
    href: "/dashboard/almacen?tab=dashboard",
  },
  {
    id: "inventario",
    label: "Inventario",
    description:
      "Catálogo unificado: insumos, medicamentos, refacciones, accesorios, reactivos y equipos",
    href: "/dashboard/almacen?tab=inventario",
  },
  {
    id: "kits",
    label: "Kits",
    description:
      "Listas típicas de insumos para no armar cada orden de servicio desde cero",
    href: "/dashboard/almacen?tab=kits",
  },
  {
    id: "entradas",
    label: "Entradas",
    description: "Registrar ingreso de mercancía",
    href: "/dashboard/almacen?tab=entradas",
  },
  {
    id: "salidas",
    label: "Salidas",
    description: "Registrar salida o consumo",
    href: "/dashboard/almacen?tab=salidas",
  },
  {
    id: "apartados",
    label: "Apartados",
    description: "Reservar mercancía para proyectos en puerta",
    href: "/dashboard/almacen?tab=apartados",
  },
  {
    id: "solicitudes",
    label: "Surtimientos",
    description: "Surte una o varias solicitudes de la misma persona, aunque sean de distintas órdenes",
    href: "/dashboard/almacen?tab=solicitudes",
  },
  {
    id: "solicitudes_compra",
    label: "Solicitar compra",
    description: "Cuando no se puede surtir, envía la orden a Compras",
    href: "/dashboard/almacen?tab=solicitudes_compra",
  },
  {
    id: "movimientos",
    label: "Movimientos",
    description: "Traspasos entre almacenes, cambios de ubicación, canjes de caducados e historial",
    href: "/dashboard/almacen?tab=movimientos",
  },
  {
    id: "kardex",
    label: "Kardex",
    description: "Historial inalterable de existencias",
    href: "/dashboard/almacen?tab=kardex",
  },
  {
    id: "mantenimientos",
    label: "Mantenimientos",
    description: "Servicios y calendario de mantenimiento",
    href: "/dashboard/almacen?tab=mantenimientos",
  },
  {
    id: "registros_sanitarios",
    label: "Registros sanitarios",
    description: "Registros sanitarios, prórrogas y certificados con su vigencia",
    href: "/dashboard/almacen?tab=registros_sanitarios",
  },
  {
    id: "herramientas",
    label: "Herramientas",
    description: "Catálogo de herramientas, entregas a biomédica y devoluciones",
    href: "/dashboard/almacen?tab=herramientas",
  },
  {
    id: "reporte",
    label: "Reporte",
    description: "Reportes operativos del almacén",
    href: "/dashboard/almacen?tab=reporte",
  },
] as const;

export type WarehouseTabId = (typeof WAREHOUSE_TABS)[number]["id"];

const LEGACY_TAB_ALIASES: Record<string, WarehouseTabId> = {
  productos: "inventario",
  insumos: "inventario",
  medicamentos: "inventario",
  refacciones: "inventario",
  accesorios: "inventario",
  reactivos: "inventario",
  equipo: "inventario",
  registros: "registros_sanitarios",
};

export function normalizeWarehouseTab(
  value: string | null
): WarehouseTabId | null {
  if (!value) return null;
  if (value in LEGACY_TAB_ALIASES) {
    return LEGACY_TAB_ALIASES[value];
  }
  return isWarehouseTabId(value) ? value : null;
}

export function isWarehouseTabId(value: string | null): value is WarehouseTabId {
  return WAREHOUSE_TABS.some((tab) => tab.id === value);
}

export function warehouseTabIsVisible(
  tabId: WarehouseTabId,
  canView: (module: WarehouseModule) => boolean
) {
  if (tabId === "inventario") {
    return INVENTORY_TAB_MODULES.some((module) => canView(module));
  }
  if (tabId === "kits") {
    return (
      INVENTORY_TAB_MODULES.some((module) => canView(module)) ||
      canView("ordenes_servicio")
    );
  }
  return canView(tabId as WarehouseModule);
}
