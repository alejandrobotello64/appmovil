export const COMPANY_AREAS = [
  { id: "almacen", label: "Almacén" },
  { id: "compras", label: "Compras" },
  { id: "ventas", label: "Ventas" },
  { id: "servicio", label: "Servicio" },
  { id: "direccion", label: "Dirección" },
  { id: "administracion", label: "Administración" },
] as const;

export type CompanyAreaId = (typeof COMPANY_AREAS)[number]["id"];

const AREA_ALIASES: Record<string, CompanyAreaId> = {
  almacen: "almacen",
  almacén: "almacen",
  compras: "compras",
  ventas: "ventas",
  servicio: "servicio",
  direccion: "direccion",
  dirección: "direccion",
  administracion: "administracion",
  administración: "administracion",
  administrador: "administracion",
};

export function normalizeArea(value: string | null | undefined): string {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return "";
  const folded = raw.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return AREA_ALIASES[folded] ?? AREA_ALIASES[raw] ?? folded.replace(/\s+/g, "-");
}

export function areaLabel(id: string) {
  return COMPANY_AREAS.find((item) => item.id === id)?.label ?? id;
}

export function roleToArea(role: string | null | undefined): CompanyAreaId {
  const r = (role ?? "").trim().toLowerCase();
  if (r === "administrador" || r === "admin") return "administracion";
  if (r === "almacen" || r === "operador") return "almacen";
  if (r === "compras") return "compras";
  if (r === "ventas") return "ventas";
  if (r === "servicio") return "servicio";
  return "direccion";
}
