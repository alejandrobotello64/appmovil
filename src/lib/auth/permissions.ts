import type { SessionData } from "@/lib/auth";

export const APP_ROLES = [
  {
    id: "administrador",
    label: "Administrador",
    description: "Acceso total, incluida la gestión de usuarios y permisos.",
  },
  {
    id: "almacen",
    label: "Almacén",
    description: "Inventario, entradas, salidas, apartados y solicitudes de compra.",
  },
  {
    id: "compras",
    label: "Compras",
    description: "Solicitudes de almacén, pedidos, surtimiento y proveedores.",
  },
  {
    id: "ventas",
    label: "Ventas",
    description: "Clientes, licitaciones, cotizaciones y calidad.",
  },
  {
    id: "servicio",
    label: "Servicio",
    description: "Biomédica, órdenes de servicio, equipos, flotilla y educación.",
  },
  {
    id: "direccion",
    label: "Dirección",
    description: "Consulta de casi todo el sistema, sin editar.",
  },
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
  | "apartados"
  | "solicitudes"
  | "movimientos"
  | "kardex"
  | "solicitudes_compra"
  | "pedidos"
  | "proveedores"
  | "clientes"
  | "licitaciones"
  | "cotizaciones"
  | "catalogo_ventas"
  | "registros_sanitarios"
  | "herramientas"
  | "ordenes_servicio"
  | "solicitud_herramientas"
  | "plantillas_checklist"
  | "instrumentos"
  | "contrasenas_servicio"
  | "documentos_tecnicos"
  | "flotilla"
  | "educacion"
  | "calidad"
  | "equipo"
  | "mantenimientos"
  | "calendario"
  | "reporte"
  | "usuarios";

export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "export"
  | "import"
  | "approve";

export type PermissionKey = `${WarehouseModule}.${PermissionAction}`;

/** Claves ausentes heredan el valor del rol. */
export type PermissionOverrides = Partial<Record<PermissionKey, boolean>>;

export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  view: "Ver",
  create: "Crear",
  edit: "Editar",
  delete: "Eliminar",
  export: "Exportar",
  import: "Importar",
  approve: "Aprobar",
};

export type PermissionActionDef = {
  action: PermissionAction;
  label?: string;
};

export type PermissionModuleDef = {
  id: WarehouseModule;
  label: string;
  description: string;
  actions: PermissionActionDef[];
};

export type PermissionGroupDef = {
  id: string;
  label: string;
  modules: PermissionModuleDef[];
};

const CRUD: PermissionActionDef[] = [
  { action: "view" },
  { action: "create" },
  { action: "edit" },
  { action: "delete" },
];

const CATALOG_ACTIONS: PermissionActionDef[] = [
  ...CRUD,
  { action: "import", label: "Importar Excel" },
  { action: "export", label: "Exportar Excel" },
];

const DOCUMENT_LIBRARY_ACTIONS: PermissionActionDef[] = [
  { action: "view" },
  { action: "create", label: "Subir documentos" },
  { action: "edit" },
  { action: "delete" },
  { action: "export", label: "Descargar" },
];

export const PERMISSION_GROUPS: PermissionGroupDef[] = [
  {
    id: "general",
    label: "General",
    modules: [
      {
        id: "dashboard",
        label: "Dashboard de almacén",
        description: "Indicadores generales del almacén.",
        actions: [{ action: "view" }],
      },
      {
        id: "calendario",
        label: "Calendario",
        description: "Eventos y agenda por área.",
        actions: CRUD,
      },
      {
        id: "reporte",
        label: "Reportes",
        description: "Reportes operativos del almacén.",
        actions: [{ action: "view" }, { action: "export", label: "Descargar" }],
      },
    ],
  },
  {
    id: "inventario",
    label: "Inventario",
    modules: [
      {
        id: "insumos",
        label: "Insumos",
        description: "Material de consumo con caducidad.",
        actions: CATALOG_ACTIONS,
      },
      {
        id: "medicamentos",
        label: "Medicamentos",
        description: "Fármacos con caducidad y lote.",
        actions: CATALOG_ACTIONS,
      },
      {
        id: "refacciones",
        label: "Refacciones",
        description: "Piezas y componentes de equipos.",
        actions: CATALOG_ACTIONS,
      },
      {
        id: "accesorios",
        label: "Accesorios",
        description: "Complementos sin caducidad.",
        actions: CATALOG_ACTIONS,
      },
      {
        id: "reactivos",
        label: "Reactivos",
        description: "Reactivos de laboratorio.",
        actions: CATALOG_ACTIONS,
      },
      {
        id: "equipo",
        label: "Equipos",
        description: "Equipos médicos del almacén.",
        actions: CATALOG_ACTIONS,
      },
    ],
  },
  {
    id: "operaciones",
    label: "Operaciones de almacén",
    modules: [
      {
        id: "entradas",
        label: "Entradas",
        description: "Registrar ingreso de mercancía.",
        actions: [{ action: "view" }, { action: "create", label: "Registrar" }],
      },
      {
        id: "salidas",
        label: "Salidas",
        description: "Registrar salida o consumo.",
        actions: [{ action: "view" }, { action: "create", label: "Registrar" }],
      },
      {
        id: "apartados",
        label: "Apartados",
        description: "Reservas de mercancía para proyectos.",
        actions: [
          { action: "view" },
          { action: "create" },
          { action: "edit", label: "Surtir / liberar" },
          { action: "delete", label: "Cancelar" },
        ],
      },
      {
        id: "solicitudes",
        label: "Solicitudes de OS",
        description: "Material pedido desde órdenes de servicio.",
        actions: [
          { action: "view" },
          { action: "edit", label: "Surtir / cancelar" },
          { action: "export", label: "Descargar PDF de surtimiento" },
        ],
      },
      {
        id: "movimientos",
        label: "Movimientos",
        description: "Traspasos de ubicación y canjes.",
        actions: [{ action: "view" }, { action: "create", label: "Registrar" }],
      },
      {
        id: "kardex",
        label: "Kardex",
        description: "Historial inalterable de existencias.",
        actions: [{ action: "view" }],
      },
      {
        id: "mantenimientos",
        label: "Mantenimientos",
        description: "Servicios programados de equipos del almacén.",
        actions: CRUD,
      },
      {
        id: "registros_sanitarios",
        label: "Registros sanitarios",
        description: "Registros sanitarios, prórrogas y certificados con su vigencia.",
        actions: DOCUMENT_LIBRARY_ACTIONS,
      },
      {
        id: "herramientas",
        label: "Herramientas",
        description: "Catálogo de herramientas, entregas a biomédica y devoluciones.",
        actions: [
          { action: "view" },
          { action: "create", label: "Dar de alta herramientas" },
          { action: "edit", label: "Editar, entregar y recibir devoluciones" },
          { action: "delete" },
          { action: "export", label: "Descargar PDF" },
        ],
      },
    ],
  },
  {
    id: "compras",
    label: "Compras",
    modules: [
      {
        id: "solicitudes_compra",
        label: "Solicitudes de compra",
        description:
          "Almacén pide a compras cuando un producto no se puede surtir.",
        actions: [
          { action: "view" },
          { action: "create", label: "Solicitar a compras" },
          { action: "edit", label: "Avanzar compra y vincular pedido" },
          { action: "delete", label: "Cancelar solicitud" },
        ],
      },
      {
        id: "pedidos",
        label: "Pedidos",
        description: "Órdenes de compra y recepción de surtimiento.",
        actions: CRUD,
      },
      {
        id: "proveedores",
        label: "Proveedores",
        description: "Alta y administración de proveedores.",
        actions: CRUD,
      },
    ],
  },
  {
    id: "comercial",
    label: "Comercial",
    modules: [
      {
        id: "clientes",
        label: "Clientes",
        description: "Fichas, equipos instalados, servicios y contactos.",
        actions: CRUD,
      },
      {
        id: "licitaciones",
        label: "Licitaciones",
        description: "Seguimiento de licitaciones y documentos.",
        actions: CRUD,
      },
      {
        id: "cotizaciones",
        label: "Cotizaciones",
        description: "Cotizaciones de venta.",
        actions: [...CRUD, { action: "export", label: "Descargar PDF" }],
      },
      {
        id: "catalogo_ventas",
        label: "Catálogo de ventas",
        description: "Brochures, folletos y presentaciones comerciales.",
        actions: DOCUMENT_LIBRARY_ACTIONS,
      },
      {
        id: "calidad",
        label: "Calidad",
        description: "Encuestas de satisfacción.",
        actions: CRUD,
      },
    ],
  },
  {
    id: "biomedica",
    label: "Biomédica",
    modules: [
      {
        id: "ordenes_servicio",
        label: "Órdenes de servicio",
        description: "Órdenes, diagnósticos, entregas y pedidos a almacén.",
        actions: [
          ...CRUD,
          { action: "export", label: "Descargar PDFs" },
          { action: "approve", label: "Candar / quitar candado" },
        ],
      },
      {
        id: "plantillas_checklist",
        label: "Plantillas de checklist",
        description: "Checklists y pruebas de funcionamiento.",
        actions: [
          ...CRUD,
          { action: "approve", label: "Candar / quitar candado" },
        ],
      },
      {
        id: "instrumentos",
        label: "Simuladores y analizadores",
        description: "Instrumentos de medición y sus certificados.",
        actions: CRUD,
      },
      {
        id: "solicitud_herramientas",
        label: "Solicitud de herramientas",
        description: "Pedir herramientas a almacén, consultar el catálogo y el historial de vales.",
        actions: [
          { action: "view" },
          { action: "create", label: "Solicitar herramientas" },
          { action: "delete", label: "Cancelar solicitudes" },
          { action: "export", label: "Descargar PDF" },
        ],
      },
      {
        id: "contrasenas_servicio",
        label: "Contraseñas de servicio",
        description:
          "Contraseñas de usuario, biomédica y servicio de equipos. Se validan también en la base de datos.",
        actions: [
          { action: "view", label: "Ver listado" },
          { action: "export", label: "Revelar y copiar" },
          { action: "create" },
          { action: "edit" },
          { action: "delete" },
          { action: "approve", label: "Ver bitácora de accesos" },
        ],
      },
      {
        id: "documentos_tecnicos",
        label: "Documentos técnicos",
        description:
          "Manuales de usuario y de servicio, fichas técnicas, boletines y diagramas.",
        actions: DOCUMENT_LIBRARY_ACTIONS,
      },
      {
        id: "educacion",
        label: "Educación",
        description: "Capacitaciones, asistentes y evidencias.",
        actions: [...CRUD, { action: "export", label: "Descargar PDF" }],
      },
    ],
  },
  {
    id: "flotilla",
    label: "Flotilla",
    modules: [
      {
        id: "flotilla",
        label: "Flotilla",
        description: "Vehículos de la empresa y sus servicios.",
        actions: [...CRUD, { action: "export", label: "Descargar PDF" }],
      },
    ],
  },
  {
    id: "administracion",
    label: "Administración",
    modules: [
      {
        id: "usuarios",
        label: "Usuarios",
        description: "Colaboradores, altas, bajas y accesos.",
        actions: [
          ...CRUD,
          { action: "import", label: "Importar Excel" },
          { action: "export", label: "Exportar Excel" },
          { action: "approve", label: "Asignar roles y permisos" },
        ],
      },
    ],
  },
];

export const PERMISSION_MODULES: PermissionModuleDef[] = PERMISSION_GROUPS.flatMap(
  (group) => group.modules
);

const MODULE_BY_ID = new Map(PERMISSION_MODULES.map((item) => [item.id, item]));

export function permissionModuleDef(module: WarehouseModule) {
  return MODULE_BY_ID.get(module);
}

export function permissionKey(
  module: WarehouseModule,
  action: PermissionAction
): PermissionKey {
  return `${module}.${action}`;
}

export function moduleHasAction(module: WarehouseModule, action: PermissionAction) {
  return Boolean(MODULE_BY_ID.get(module)?.actions.some((item) => item.action === action));
}

export function actionLabel(module: WarehouseModule, action: PermissionAction) {
  const def = MODULE_BY_ID.get(module)?.actions.find((item) => item.action === action);
  return def?.label ?? PERMISSION_ACTION_LABELS[action];
}

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_MODULES.flatMap(
  (module) => module.actions.map((item) => permissionKey(module.id, item.action))
);

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

const ROLE_VIEW_MODULES: Record<AppRole, WarehouseModule[]> = {
  administrador: PERMISSION_MODULES.map((item) => item.id),
  almacen: [
    "dashboard",
    ...CATALOG_MODULES,
    "entradas",
    "salidas",
    "apartados",
    "solicitudes",
    "movimientos",
    "kardex",
    "solicitudes_compra",
    "pedidos",
    "proveedores",
    "clientes",
    "equipo",
    "calendario",
    "reporte",
    "registros_sanitarios",
    "herramientas",
    "flotilla",
    "educacion",
  ],
  compras: [
    "dashboard",
    ...CATALOG_MODULES,
    "entradas",
    "solicitudes_compra",
    "pedidos",
    "proveedores",
    "kardex",
    "calendario",
    "reporte",
    "registros_sanitarios",
    "herramientas",
    "licitaciones",
  ],
  ventas: [
    "dashboard",
    ...CATALOG_MODULES,
    "kardex",
    "reporte",
    "calendario",
    "clientes",
    "licitaciones",
    "cotizaciones",
    "catalogo_ventas",
    "registros_sanitarios",
    "documentos_tecnicos",
    "calidad",
  ],
  servicio: [
    "dashboard",
    ...CATALOG_MODULES,
    "salidas",
    "apartados",
    "equipo",
    "mantenimientos",
    "clientes",
    "calendario",
    "catalogo_ventas",
    "registros_sanitarios",
    "herramientas",
    "kardex",
    "ordenes_servicio",
    "solicitud_herramientas",
    "plantillas_checklist",
    "instrumentos",
    "contrasenas_servicio",
    "documentos_tecnicos",
    "flotilla",
    "educacion",
    "calidad",
  ],
  direccion: [
    "dashboard",
    ...CATALOG_MODULES,
    "kardex",
    "reporte",
    "equipo",
    "clientes",
    "calendario",
    "solicitudes_compra",
    "pedidos",
    "proveedores",
    "licitaciones",
    "cotizaciones",
    "catalogo_ventas",
    "registros_sanitarios",
    "herramientas",
    "ordenes_servicio",
    "solicitud_herramientas",
    "plantillas_checklist",
    "instrumentos",
    "documentos_tecnicos",
    "flotilla",
    "educacion",
    "calidad",
  ],
};

const ROLE_WRITE_MODULES: Record<AppRole, WarehouseModule[]> = {
  administrador: PERMISSION_MODULES.map((item) => item.id).filter(
    (id) => id !== "kardex" && id !== "reporte"
  ),
  almacen: [
    "dashboard",
    ...CATALOG_MODULES,
    "entradas",
    "salidas",
    "apartados",
    "solicitudes",
    "movimientos",
    "solicitudes_compra",
    "pedidos",
    "proveedores",
    "clientes",
    "equipo",
    "calendario",
    "registros_sanitarios",
    "herramientas",
    "flotilla",
    "educacion",
  ],
  compras: [
    "solicitudes_compra",
    "pedidos",
    "proveedores",
    "entradas",
    "registros_sanitarios",
    "licitaciones",
  ],
  ventas: ["clientes", "licitaciones", "cotizaciones", "catalogo_ventas", "calidad"],
  servicio: [
    "dashboard",
    ...CATALOG_MODULES,
    "salidas",
    "apartados",
    "equipo",
    "mantenimientos",
    "calendario",
    "clientes",
    "ordenes_servicio",
    "solicitud_herramientas",
    "plantillas_checklist",
    "instrumentos",
    "contrasenas_servicio",
    "documentos_tecnicos",
    "flotilla",
    "educacion",
    "calidad",
  ],
  direccion: [],
};

export function normalizeRole(role: string | null | undefined): AppRole {
  if (!role) return "direccion";
  return ROLE_ALIASES[role.trim().toLowerCase()] ?? "direccion";
}

/** Valor que da la plantilla del rol, sin ajustes individuales. */
export function roleDefaultPermission(
  role: string | null | undefined,
  key: PermissionKey
): boolean {
  const normalized = normalizeRole(role);
  const [module, action] = key.split(".") as [WarehouseModule, PermissionAction];
  if (!moduleHasAction(module, action)) return false;
  if (!ROLE_VIEW_MODULES[normalized].includes(module)) return false;

  switch (action) {
    case "view":
    case "export":
      return true;
    case "approve":
      return normalized === "administrador";
    default:
      return ROLE_WRITE_MODULES[normalized].includes(module);
  }
}

export function roleDefaultPermissions(role: string | null | undefined) {
  const result = {} as Record<PermissionKey, boolean>;
  for (const key of ALL_PERMISSION_KEYS) {
    result[key] = roleDefaultPermission(role, key);
  }
  return result;
}

export type AccessSubject =
  | string
  | null
  | undefined
  | {
      role?: string | null;
      permissionOverrides?: PermissionOverrides | null;
    };

function resolveSubject(subject: AccessSubject) {
  if (subject === null || subject === undefined || typeof subject === "string") {
    return { role: subject ?? null, overrides: {} as PermissionOverrides };
  }
  return {
    role: subject.role ?? null,
    overrides: subject.permissionOverrides ?? {},
  };
}

function rawPermission(
  role: string | null,
  overrides: PermissionOverrides,
  key: PermissionKey
) {
  const override = overrides[key];
  return typeof override === "boolean" ? override : roleDefaultPermission(role, key);
}

export function hasPermission(subject: AccessSubject, key: PermissionKey): boolean {
  const { role, overrides } = resolveSubject(subject);
  const [module, action] = key.split(".") as [WarehouseModule, PermissionAction];
  if (!moduleHasAction(module, action)) return false;
  if (action !== "view" && !rawPermission(role, overrides, permissionKey(module, "view"))) {
    return false;
  }
  return rawPermission(role, overrides, key);
}

export function effectivePermissions(subject: AccessSubject) {
  const result = {} as Record<PermissionKey, boolean>;
  for (const key of ALL_PERMISSION_KEYS) {
    result[key] = hasPermission(subject, key);
  }
  return result;
}

/** Quita claves que ya coinciden con el rol o que no existen en el catálogo. */
export function cleanOverrides(
  role: string | null | undefined,
  overrides: PermissionOverrides
): PermissionOverrides {
  const known = new Set<string>(ALL_PERMISSION_KEYS);
  const result: PermissionOverrides = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (!known.has(key) || typeof value !== "boolean") continue;
    if (roleDefaultPermission(role, key as PermissionKey) === value) continue;
    result[key as PermissionKey] = value;
  }
  return result;
}

export function parsePermissionOverrides(value: unknown): PermissionOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const known = new Set<string>(ALL_PERMISSION_KEYS);
  const result: PermissionOverrides = {};
  for (const [key, flag] of Object.entries(value as Record<string, unknown>)) {
    if (known.has(key) && typeof flag === "boolean") {
      result[key as PermissionKey] = flag;
    }
  }
  return result;
}

export function canViewModule(subject: AccessSubject, module: WarehouseModule) {
  return hasPermission(subject, permissionKey(module, "view"));
}

export function canWriteModule(subject: AccessSubject, module: WarehouseModule) {
  return (["create", "edit", "delete"] as const).some((action) =>
    hasPermission(subject, permissionKey(module, action))
  );
}

export function roleFromSession(session: SessionData | null) {
  return normalizeRole(session?.role);
}

export function roleLabel(role: string | null | undefined) {
  const normalized = normalizeRole(role);
  return APP_ROLES.find((item) => item.id === normalized)?.label ?? role ?? "Dirección";
}

export function modulesForRole(role: string | null | undefined): WarehouseModule[] {
  return [...ROLE_VIEW_MODULES[normalizeRole(role)]];
}
