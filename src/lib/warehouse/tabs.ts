export const WAREHOUSE_TABS = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Indicadores del almacén",
    href: "/dashboard/almacen?tab=dashboard",
  },
  {
    id: "productos",
    label: "Productos",
    description: "Catálogo y existencias",
    href: "/dashboard/almacen?tab=productos",
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
    label: "Equipo",
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
  {
    id: "usuarios",
    label: "Usuarios",
    description: "Usuarios con acceso al sistema",
    href: "/dashboard/almacen?tab=usuarios",
  },
] as const;

export type WarehouseTabId = (typeof WAREHOUSE_TABS)[number]["id"];

export function isWarehouseTabId(value: string | null): value is WarehouseTabId {
  return WAREHOUSE_TABS.some((tab) => tab.id === value);
}
