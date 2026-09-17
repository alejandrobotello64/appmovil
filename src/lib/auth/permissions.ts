import type { SessionData } from "@/lib/auth";

export const APP_ROLES = [
  { id: "administrador", label: "Administrador" },
  { id: "almacen", label: "Almacén" },
  { id: "compras", label: "Compras" },
  { id: "ventas", label: "Ventas" },
  { id: "servicio", label: "Servicio" },
  { id: "direccion", label: "Dirección" },
] as const;

export type AppRole = (typeof APP_ROLES)[number]["id"];
export type WarehouseModule =
  | "dashboard"
  | "insumos"
  | "medicamentos"
  | "refacciones"
  | "accesorios"
  | "reactivos"
  | "entradas"
  | "salidas"
  | "movimientos"
  | "kardex"
  | "pedidos"
  | "proveedores"
  | "equipo"
  | "mantenimientos"
  | "calendario"
  | "reporte"
  | "usuarios";

const CATALOG_MODULES: WarehouseModule[] = [
  "insumos",
  "medicamentos",
  "refacciones",
  "accesorios",
  "reactivos",
];

const ROLE_ALIASES: Record<string, AppRole> = {
  admin: "administrador",
  administrador: "administrador",
  operador: "almacen",
  almacen: "almacen",
  compras: "compras",
  ventas: "ventas",
  servicio: "servicio",
  direccion: "direccion",
  lectura: "direccion",
};

const WRITE_MODULES: Record<AppRole, WarehouseModule[]> = {
  administrador: [
    "dashboard",
    ...CATALOG_MODULES,
    "entradas",
    "salidas",
    "movimientos",
    "kardex",
    "pedidos",
    "proveedores",
    "equipo",
    "mantenimientos",
    "calendario",
    "reporte",
    "usuarios",
  ],
  almacen: [
    "dashboard",
    ...CATALOG_MODULES,
    "entradas",
    "salidas",
    "movimientos",
    "kardex",
    "pedidos",
    "proveedores",
    "equipo",
    "calendario",
    "reporte",
  ],
  compras: [
    "dashboard",
    ...CATALOG_MODULES,
    "entradas",
    "pedidos",
    "proveedores",
    "kardex",
    "calendario",
    "reporte",
  ],
  ventas: ["dashboard", ...CATALOG_MODULES, "kardex", "reporte", "calendario"],
  servicio: [
    "dashboard",
    ...CATALOG_MODULES,
    "salidas",
    "equipo",
    "mantenimientos",
    "calendario",
    "kardex",
  ],
  direccion: [
    "dashboard",
    ...CATALOG_MODULES,
    "kardex",
    "reporte",
    "equipo",
    "calendario",
  ],
};

export function normalizeRole(role: string | null | undefined): AppRole {
  if (!role) return "direccion";
  return ROLE_ALIASES[role.trim().toLowerCase()] ?? "direccion";
}

export function canViewModule(role: string | null | undefined, module: WarehouseModule) {
  return WRITE_MODULES[normalizeRole(role)].includes(module);
}

export function canWriteModule(role: string | null | undefined, module: WarehouseModule) {
  const normalized = normalizeRole(role);
  if (normalized === "direccion" || normalized === "ventas") {
    return false;
  }
  if (
    normalized === "servicio" &&
    (module === "salidas" ||
      module === "equipo" ||
      module === "mantenimientos" ||
      module === "calendario")
  ) {
    return true;
  }
  if (normalized === "compras") {
    return module === "pedidos" || module === "proveedores" || module === "entradas";
  }
  return WRITE_MODULES[normalized].includes(module) && module !== "kardex" && module !== "reporte";
}

export function roleFromSession(session: SessionData | null) {
  return normalizeRole(session?.role);
}

export function roleLabel(role: string | null | undefined) {
  const normalized = normalizeRole(role);
  return APP_ROLES.find((item) => item.id === normalized)?.label ?? role ?? "Dirección";
}

export function modulesForRole(role: string | null | undefined): WarehouseModule[] {
  return [...WRITE_MODULES[normalizeRole(role)]];
}

export function roleCanWrite(
  role: string | null | undefined,
  module: WarehouseModule
): boolean {
  return canWriteModule(role, module);
}
