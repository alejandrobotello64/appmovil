export const SERVICE_PASSWORD_TYPES = [
  {
    id: "usuario",
    label: "Usuario",
    description: "Acceso del operador o personal clínico del hospital.",
  },
  {
    id: "biomedica",
    label: "Biomédica",
    description: "Menú técnico para el ingeniero biomédico del cliente.",
  },
  {
    id: "servicio",
    label: "Servicio",
    description: "Menú de fábrica / servicio técnico del fabricante.",
  },
] as const;

export type ServicePasswordType = (typeof SERVICE_PASSWORD_TYPES)[number]["id"];

export type ServicePassword = {
  id: string;
  passwordType: ServicePasswordType;
  title: string;
  equipmentType: string;
  brand: string;
  model: string;
  softwareVersion: string;
  clientName: string;
  accessUser: string;
  notes: string;
  createdByName: string;
  updatedByName: string;
  createdAt: string;
  updatedAt: string;
  revealCount: number;
  lastRevealedAt: string | null;
};

export type ServicePasswordInput = {
  passwordType: ServicePasswordType;
  title: string;
  equipmentType: string;
  brand: string;
  model: string;
  softwareVersion: string;
  clientName: string;
  accessUser: string;
  notes: string;
  /** Vacío al editar = conservar la contraseña actual. */
  secret: string;
};

export type ServicePasswordLogAction = "reveal" | "create" | "update" | "delete";

export type ServicePasswordLogEntry = {
  id: number;
  passwordId: string | null;
  passwordTitle: string;
  action: ServicePasswordLogAction;
  userName: string;
  createdAt: string;
};

export type VaultCredentials = {
  username: string;
  password: string;
};

export function isServicePasswordType(value: string): value is ServicePasswordType {
  return SERVICE_PASSWORD_TYPES.some((type) => type.id === value);
}

export function servicePasswordTypeLabel(value: string) {
  return SERVICE_PASSWORD_TYPES.find((type) => type.id === value)?.label ?? value;
}

export const LOG_ACTION_LABELS: Record<ServicePasswordLogAction, string> = {
  reveal: "Consultó",
  create: "Creó",
  update: "Editó",
  delete: "Eliminó",
};
