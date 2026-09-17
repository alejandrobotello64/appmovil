export const WAREHOUSE_TABS = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Indicadores del almacén",
    href: "/dashboard/almacen?tab=dashboard",
  },
  {
    id: "insumos",
    label: "Insumos",
    description: "Material de consumo con caducidad",
    href: "/dashboard/almacen?tab=insumos",
  },
  {
    id: "medicamentos",
    label: "Medicamentos",
    description: "Fármacos con caducidad y lote",
    href: "/dashboard/almacen?tab=medicamentos",
  },
  {
    id: "refacciones",
    label: "Refacciones",
    description: "Piezas y componentes de equipos",
    href: "/dashboard/almacen?tab=refacciones",
  },
  {
    id: "accesorios",
    label: "Accesorios",
    description: "Complementos con fecha de fabricación, sin caducidad",
    href: "/dashboard/almacen?tab=accesorios",
  },
  {
    id: "reactivos",
    label: "Reactivos",
    description: "Reactivos de laboratorio con caducidad",
    href: "/dashboard/almacen?tab=reactivos",
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
    id: "movimientos",
    label: "Movimientos",
    description: "Cambios de ubicación y canjes de materiales caducados",
    href: "/dashboard/almacen?tab=movimientos",
  },
  {
    id: "kardex",
    label: "Kardex",
    description: "Historial inalterable de existencias",
    href: "/dashboard/almacen?tab=kardex",
  },
  {
    id: "pedidos",
    label: "Pedidos",
    description: "Órdenes de compra y surtido",
    href: "/dashboard/almacen?tab=pedidos",
  },
  {
    id: "proveedores",
    label: "Proveedores",
    description: "Alta y administración de proveedores",
    href: "/dashboard/almacen?tab=proveedores",
  },
  {
    id: "equipo",
    label: "Equipos",
    description: "Equipos médicos del almacén",
    href: "/dashboard/almacen?tab=equipo",
  },
  {
    id: "mantenimientos",
    label: "Mantenimientos",
    description: "Servicios y calendario de mantenimiento",
    href: "/dashboard/almacen?tab=mantenimientos",
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
  productos: "insumos",
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
