export const USERS_TABS = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Colaboradores activos y distribución de roles",
    href: "/dashboard/usuarios?tab=dashboard",
  },
  {
    id: "alta",
    label: "Alta de colaborador",
    description: "Registra datos personales y acceso de un empleado nuevo",
    href: "/dashboard/usuarios?tab=alta",
  },
  {
    id: "baja",
    label: "Baja de colaborador",
    description: "Desactiva o reactiva accesos de colaboradores",
    href: "/dashboard/usuarios?tab=baja",
  },
  {
    id: "permisos",
    label: "Permisos de usuarios",
    description: "Asigna roles y revisa módulos por colaborador",
    href: "/dashboard/usuarios?tab=permisos",
  },
] as const;

export type UsersTabId = (typeof USERS_TABS)[number]["id"];

export function isUsersTabId(value: string | null): value is UsersTabId {
  return USERS_TABS.some((tab) => tab.id === value);
}

export function normalizeUsersTab(value: string | null): UsersTabId {
  return isUsersTabId(value) ? value : "dashboard";
}
