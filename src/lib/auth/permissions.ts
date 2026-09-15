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
  | "productos"
  | "entradas"
  | "salidas"
  | "movimientos"
  | "kardex"
  | "pedidos"
  | "proveedores"
  | "equipo"
  | "mantenimientos"
  | "reporte"
  | "usuarios";

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
    "productos",
    "entradas",
    "salidas",
    "movimientos",
    "kardex",
    "pedidos",
    "proveedores",
    "equipo",
    "mantenimientos",
    "reporte",
    "usuarios",
  ],
  almacen: [
    "dashboard",
    "productos",
    "entradas",
    "salidas",
    "movimientos",
    "kardex",
    "pedidos",
    "proveedores",
    "equipo",
    "reporte",
  ],
  compras: ["dashboard", "productos", "entradas", "pedidos", "proveedores", "kardex", "reporte"],
  ventas: ["dashboard", "productos", "kardex", "reporte"],
  servicio: ["dashboard", "productos", "salidas", "equipo", "mantenimientos", "kardex"],
  direccion: ["dashboard", "productos", "kardex", "reporte", "equipo"],
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
  if (normalized === "servicio" && (module === "salidas" || module === "equipo" || module === "mantenimientos")) {
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
