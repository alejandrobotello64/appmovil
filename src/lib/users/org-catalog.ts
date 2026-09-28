import type { AppRole } from "@/lib/auth/permissions";
import type { CompanyAreaId } from "@/lib/calendar/areas";

export type OrgPosition = {
  label: string;
  role: AppRole;
  aliases?: string[];
};

export type OrgArea = {
  id: string;
  label: string;
  description: string;
  /** Área del calendario con la que se agrupan avisos y eventos. */
  calendarArea: CompanyAreaId;
  defaultRole: AppRole;
  aliases?: string[];
  positions: OrgPosition[];
};

export const ORG_AREAS: OrgArea[] = [
  {
    id: "direccion",
    label: "Dirección General",
    description: "Dirección y gerencia de la empresa.",
    calendarArea: "direccion",
    defaultRole: "direccion",
    aliases: ["direccion", "gerencia", "direccion general"],
    positions: [
      { label: "Director General", role: "direccion" },
      { label: "Director de Operaciones", role: "direccion" },
      { label: "Director Comercial", role: "direccion" },
      { label: "Gerente General", role: "direccion" },
      { label: "Asistente de Dirección", role: "direccion" },
    ],
  },
  {
    id: "administracion",
    label: "Administración y Finanzas",
    description: "Contabilidad, tesorería, cobranza y facturación.",
    calendarArea: "administracion",
    defaultRole: "administrador",
    aliases: ["administracion", "finanzas", "contabilidad"],
    positions: [
      { label: "Gerente de Administración", role: "administrador" },
      { label: "Contador General", role: "administrador" },
      { label: "Auxiliar contable", role: "administrador" },
      { label: "Cuentas por pagar", role: "administrador" },
      { label: "Cobranza", role: "administrador" },
      { label: "Facturación", role: "administrador" },
      { label: "Auxiliar administrativo", role: "administrador" },
      { label: "Recepcionista", role: "direccion" },
    ],
  },
  {
    id: "rrhh",
    label: "Recursos Humanos",
    description: "Reclutamiento, nómina y personal.",
    calendarArea: "administracion",
    defaultRole: "administrador",
    aliases: ["rrhh", "rh", "recursos humanos", "capital humano"],
    positions: [
      { label: "Gerente de Recursos Humanos", role: "administrador" },
      { label: "Reclutamiento y selección", role: "administrador" },
      { label: "Nóminas", role: "administrador" },
      { label: "Auxiliar de Recursos Humanos", role: "administrador" },
    ],
  },
  {
    id: "sistemas",
    label: "Sistemas (TI)",
    description: "Infraestructura, soporte y desarrollo.",
    calendarArea: "administracion",
    defaultRole: "administrador",
    aliases: ["sistemas", "ti", "tecnologias de la informacion", "it"],
    positions: [
      { label: "Jefe de Sistemas", role: "administrador" },
      { label: "Soporte técnico TI", role: "administrador" },
      { label: "Desarrollador", role: "administrador" },
    ],
  },
  {
    id: "almacen",
    label: "Almacén y Logística",
    description: "Recepción, resguardo, surtido y embarque de producto.",
    calendarArea: "almacen",
    defaultRole: "almacen",
    aliases: ["almacen", "logistica", "almacen y logistica"],
    positions: [
      { label: "Gerente de Almacén", role: "almacen" },
      { label: "Jefe de Almacén", role: "almacen" },
      { label: "Almacenista", role: "almacen" },
      { label: "Auxiliar de almacén", role: "almacen" },
      { label: "Auxiliar administrativo de almacén", role: "almacen" },
      { label: "Surtidor", role: "almacen" },
      { label: "Control de inventarios", role: "almacen" },
      { label: "Recepción de mercancía", role: "almacen" },
      { label: "Embarques", role: "almacen" },
    ],
  },
  {
    id: "compras",
    label: "Compras",
    description: "Proveedores, pedidos e importaciones.",
    calendarArea: "compras",
    defaultRole: "compras",
    aliases: ["compras", "adquisiciones"],
    positions: [
      { label: "Gerente de Compras", role: "compras" },
      { label: "Comprador", role: "compras" },
      { label: "Auxiliar de compras", role: "compras" },
      { label: "Comercio exterior / Importaciones", role: "compras" },
    ],
  },
  {
    id: "ventas",
    label: "Ventas",
    description: "Atención comercial, cotizaciones y clientes.",
    calendarArea: "ventas",
    defaultRole: "ventas",
    aliases: ["ventas", "comercial"],
    positions: [
      { label: "Gerente de Ventas", role: "ventas" },
      { label: "Ejecutivo de ventas", role: "ventas" },
      { label: "Representante médico", role: "ventas" },
      { label: "Asesor comercial", role: "ventas" },
      { label: "Especialista de producto", role: "ventas" },
      { label: "Atención a clientes", role: "ventas" },
      { label: "Auxiliar de ventas", role: "ventas" },
    ],
  },
  {
    id: "licitaciones",
    label: "Licitaciones",
    description: "Concursos y contratos con instituciones.",
    calendarArea: "ventas",
    defaultRole: "ventas",
    aliases: ["licitaciones", "gobierno"],
    positions: [
      { label: "Coordinador de Licitaciones", role: "ventas" },
      { label: "Analista de licitaciones", role: "ventas" },
      { label: "Auxiliar de licitaciones", role: "ventas" },
    ],
  },
  {
    id: "biomedica",
    label: "Ingeniería Biomédica",
    description: "Servicio, mantenimiento e instalación de equipo médico.",
    calendarArea: "servicio",
    defaultRole: "servicio",
    aliases: ["biomedica", "servicio", "ingenieria biomedica", "servicio tecnico"],
    positions: [
      { label: "Gerente de Servicio", role: "servicio" },
      { label: "Jefe de Ingeniería Biomédica", role: "servicio" },
      { label: "Coordinador de servicio", role: "servicio" },
      { label: "Asesor de servicios", role: "servicio" },
      {
        label: "Ingeniero biomédico",
        role: "servicio",
        aliases: ["ingeniero biomedico"],
      },
      { label: "Ingeniero de servicio", role: "servicio" },
      { label: "Técnico biomédico", role: "servicio" },
      { label: "Técnico de campo", role: "servicio" },
      { label: "Auxiliar de servicio", role: "servicio" },
    ],
  },
  {
    id: "educacion",
    label: "Educación y Aplicaciones",
    description: "Capacitación a clientes y personal.",
    calendarArea: "servicio",
    defaultRole: "servicio",
    aliases: ["educacion", "capacitacion", "aplicaciones"],
    positions: [
      { label: "Coordinador de capacitación", role: "servicio" },
      { label: "Especialista clínico", role: "servicio" },
      { label: "Instructor", role: "servicio" },
    ],
  },
  {
    id: "calidad",
    label: "Calidad y Regulatorio",
    description: "Sistema de calidad, COFEPRIS y satisfacción del cliente.",
    calendarArea: "direccion",
    defaultRole: "ventas",
    aliases: ["calidad", "regulatorio", "asuntos regulatorios"],
    positions: [
      { label: "Gerente de Calidad", role: "ventas" },
      { label: "Responsable sanitario", role: "ventas" },
      { label: "Asuntos regulatorios", role: "ventas" },
      { label: "Auxiliar de calidad", role: "ventas" },
    ],
  },
  {
    id: "flotilla",
    label: "Flotilla y Transporte",
    description: "Vehículos, rutas y entregas.",
    calendarArea: "almacen",
    defaultRole: "servicio",
    aliases: ["flotilla", "transporte", "reparto"],
    positions: [
      { label: "Jefe de Flotilla", role: "servicio" },
      { label: "Chofer", role: "servicio" },
      { label: "Repartidor", role: "almacen" },
      { label: "Mensajero", role: "almacen" },
    ],
  },
  {
    id: "mercadotecnia",
    label: "Mercadotecnia",
    description: "Marca, contenido y campañas.",
    calendarArea: "ventas",
    defaultRole: "ventas",
    aliases: ["mercadotecnia", "marketing"],
    positions: [
      { label: "Gerente de Mercadotecnia", role: "ventas" },
      { label: "Diseñador gráfico", role: "ventas" },
      { label: "Community manager", role: "ventas" },
    ],
  },
  {
    id: "servicios-generales",
    label: "Servicios Generales",
    description: "Mantenimiento de instalaciones, limpieza y vigilancia.",
    calendarArea: "administracion",
    defaultRole: "direccion",
    aliases: ["servicios generales", "mantenimiento", "intendencia"],
    positions: [
      { label: "Encargado de mantenimiento", role: "direccion" },
      { label: "Intendencia", role: "direccion" },
      { label: "Vigilancia", role: "direccion" },
    ],
  },
];

export function foldText(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

export function findOrgArea(value: string | null | undefined): OrgArea | null {
  const folded = foldText(value);
  if (!folded) return null;
  return (
    ORG_AREAS.find(
      (area) =>
        foldText(area.label) === folded ||
        area.id === folded ||
        area.aliases?.some((alias) => foldText(alias) === folded)
    ) ?? null
  );
}

function matchesPosition(position: OrgPosition, folded: string) {
  return (
    foldText(position.label) === folded ||
    position.aliases?.some((alias) => foldText(alias) === folded)
  );
}

export function findOrgPosition(
  value: string | null | undefined,
  areaValue?: string | null
): { area: OrgArea; position: OrgPosition } | null {
  const folded = foldText(value);
  if (!folded) return null;
  const preferred = findOrgArea(areaValue);
  const areas = preferred
    ? [preferred, ...ORG_AREAS.filter((area) => area.id !== preferred.id)]
    : ORG_AREAS;
  for (const area of areas) {
    const position = area.positions.find((item) => matchesPosition(item, folded));
    if (position) return { area, position };
  }
  return null;
}

/** Rol del sistema recomendado según puesto (o, si no hay, según área). */
export function suggestedRoleFor(
  jobTitle: string | null | undefined,
  department: string | null | undefined
): AppRole | null {
  const match = findOrgPosition(jobTitle, department);
  if (match) return match.position.role;
  return findOrgArea(department)?.defaultRole ?? null;
}
