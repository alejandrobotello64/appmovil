export const CLIENT_EQUIPMENT_STATUSES = [
  { id: "operativo", label: "Operativo" },
  { id: "fuera_servicio", label: "Fuera de servicio" },
  { id: "en_reparacion", label: "En reparación" },
  { id: "baja", label: "Baja" },
] as const;

export type ClientEquipmentStatus =
  (typeof CLIENT_EQUIPMENT_STATUSES)[number]["id"];

export const CLIENT_SERVICE_TYPES = [
  { id: "levantamiento", label: "Levantamiento" },
  { id: "instalacion", label: "Instalación" },
  { id: "mantenimiento", label: "Mantenimiento" },
  { id: "reparacion", label: "Reparación" },
  { id: "capacitacion", label: "Capacitación" },
  { id: "otro", label: "Otro" },
] as const;

export type ClientServiceType = (typeof CLIENT_SERVICE_TYPES)[number]["id"];

export type Client = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  rfc: string;
  address: string;
  city: string;
  state: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClientInput = Omit<Client, "id" | "createdAt" | "updatedAt">;

export type ClientEquipment = {
  id: string;
  clientId: string;
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  location: string;
  status: ClientEquipmentStatus;
  installedAt: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ClientEquipmentInput = Omit<
  ClientEquipment,
  "id" | "createdAt" | "updatedAt"
>;

export type ClientService = {
  id: string;
  clientId: string;
  equipmentId: string | null;
  serviceType: ClientServiceType;
  title: string;
  description: string;
  performedAt: string;
  technician: string;
  folio: string;
  notes: string;
  createdBy: string;
  createdAt: string;
};

export type ClientServiceInput = Omit<ClientService, "id" | "createdAt">;

export const CLIENT_CONTACT_ROLES = [
  { id: "contacto_general", label: "Contacto general" },
  { id: "compras", label: "Compras" },
  { id: "almacen", label: "Almacén" },
  { id: "biomedica", label: "Biomédica / Ingeniería" },
  { id: "direccion", label: "Dirección" },
  { id: "finanzas", label: "Finanzas / Facturación" },
  { id: "servicio", label: "Servicio / Mantenimiento" },
  { id: "otro", label: "Otro" },
] as const;

export type ClientContact = {
  id: string;
  clientId: string;
  name: string;
  roleTitle: string;
  department: string;
  phone: string;
  email: string;
  extension: string;
  notes: string;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ClientContactInput = Omit<
  ClientContact,
  "id" | "createdAt" | "updatedAt"
>;

export function clientEquipmentStatusLabel(status: string) {
  return (
    CLIENT_EQUIPMENT_STATUSES.find((item) => item.id === status)?.label ??
    status
  );
}

export function clientServiceTypeLabel(type: string) {
  return (
    CLIENT_SERVICE_TYPES.find((item) => item.id === type)?.label ?? type
  );
}
