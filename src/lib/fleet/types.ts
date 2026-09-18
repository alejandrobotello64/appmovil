export const VEHICLE_TYPES = [
  { id: "utilitario", label: "Utilitario" },
  { id: "pickup", label: "Pickup" },
  { id: "sedan", label: "Sedán" },
  { id: "van", label: "Van" },
  { id: "camion", label: "Camión" },
  { id: "moto", label: "Moto" },
  { id: "otro", label: "Otro" },
] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number]["id"];

export const VEHICLE_STATUSES = [
  { id: "activo", label: "Activo" },
  { id: "taller", label: "En taller" },
  { id: "baja", label: "Baja" },
] as const;

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number]["id"];

export const FUEL_TYPES = [
  { id: "gasolina", label: "Gasolina" },
  { id: "diesel", label: "Diésel" },
  { id: "hibrido", label: "Híbrido" },
  { id: "electrico", label: "Eléctrico" },
  { id: "otro", label: "Otro" },
] as const;

export type FuelType = (typeof FUEL_TYPES)[number]["id"];

export const VEHICLE_SERVICE_TYPES = [
  { id: "preventivo", label: "Preventivo" },
  { id: "correctivo", label: "Correctivo" },
  { id: "afinacion", label: "Afinación" },
  { id: "aceite", label: "Cambio de aceite" },
  { id: "llantas", label: "Llantas" },
  { id: "frenos", label: "Frenos" },
  { id: "verificacion", label: "Verificación" },
  { id: "seguro", label: "Seguro" },
  { id: "carroceria", label: "Carrocería" },
  { id: "electrico", label: "Eléctrico" },
  { id: "otro", label: "Otro" },
] as const;

export type VehicleServiceType = (typeof VEHICLE_SERVICE_TYPES)[number]["id"];

export const VEHICLE_SERVICE_STATUSES = [
  { id: "programado", label: "Programado" },
  { id: "en_proceso", label: "En proceso" },
  { id: "completado", label: "Completado" },
  { id: "cancelado", label: "Cancelado" },
] as const;

export type VehicleServiceStatus =
  (typeof VEHICLE_SERVICE_STATUSES)[number]["id"];

export type CompanyVehicle = {
  id: string;
  code: string;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  color: string;
  vin: string;
  vehicleType: VehicleType;
  status: VehicleStatus;
  odometerKm: number;
  fuelType: FuelType;
  assignedTo: string;
  insurancePolicy: string;
  insuranceExpires: string;
  verificationExpires: string;
  nextServiceKm: number | null;
  nextServiceDate: string;
  notes: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  servicesCount?: number;
  openServicesCount?: number;
};

export type VehicleServiceLine = {
  id: string;
  serviceId: string;
  description: string;
  quantity: number;
  unitCost: number;
  sortOrder: number;
};

export type VehicleServiceEvent = {
  id: string;
  serviceId: string;
  eventType: string;
  message: string;
  createdBy: string;
  createdAt: string;
};

export type VehicleService = {
  id: string;
  folio: string;
  vehicleId: string;
  vehicleCode: string;
  vehiclePlate: string;
  vehicleLabel: string;
  serviceType: VehicleServiceType;
  status: VehicleServiceStatus;
  priority: "normal" | "urgente";
  title: string;
  description: string;
  workshop: string;
  technician: string;
  requestedBy: string;
  odometerKm: number | null;
  scheduledAt: string;
  startedAt: string;
  completedAt: string;
  nextServiceKm: number | null;
  nextServiceDate: string;
  laborCost: number;
  partsCost: number;
  otherCost: number;
  totalCost: number;
  invoiceFolio: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lines: VehicleServiceLine[];
  events: VehicleServiceEvent[];
};

export type CompanyVehicleInput = {
  code?: string;
  plate: string;
  brand?: string;
  model?: string;
  year?: number | null;
  color?: string;
  vin?: string;
  vehicleType?: VehicleType;
  status?: VehicleStatus;
  odometerKm?: number;
  fuelType?: FuelType;
  assignedTo?: string;
  insurancePolicy?: string;
  insuranceExpires?: string;
  verificationExpires?: string;
  nextServiceKm?: number | null;
  nextServiceDate?: string;
  notes?: string;
  isActive?: boolean;
  createdBy?: string;
};

export type VehicleServiceLineInput = {
  description: string;
  quantity: number;
  unitCost: number;
};

export type VehicleServiceInput = {
  vehicleId: string;
  serviceType?: VehicleServiceType;
  status?: VehicleServiceStatus;
  priority?: "normal" | "urgente";
  title?: string;
  description?: string;
  workshop?: string;
  technician?: string;
  requestedBy?: string;
  odometerKm?: number | null;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  nextServiceKm?: number | null;
  nextServiceDate?: string;
  laborCost?: number;
  partsCost?: number;
  otherCost?: number;
  invoiceFolio?: string;
  notes?: string;
  createdBy?: string;
  lines?: VehicleServiceLineInput[];
};

export function vehicleTypeLabel(type: string) {
  return VEHICLE_TYPES.find((t) => t.id === type)?.label ?? type;
}

export function vehicleStatusLabel(status: string) {
  return VEHICLE_STATUSES.find((s) => s.id === status)?.label ?? status;
}

export function vehicleServiceTypeLabel(type: string) {
  return VEHICLE_SERVICE_TYPES.find((t) => t.id === type)?.label ?? type;
}

export function vehicleServiceStatusLabel(status: string) {
  return VEHICLE_SERVICE_STATUSES.find((s) => s.id === status)?.label ?? status;
}

export function computeServiceTotal(
  labor = 0,
  parts = 0,
  other = 0,
  lines: VehicleServiceLineInput[] = []
) {
  const linesTotal = lines.reduce(
    (sum, line) => sum + Number(line.quantity) * Number(line.unitCost),
    0
  );
  return Number(
    (Number(labor) + Number(parts) + Number(other) + linesTotal).toFixed(2)
  );
}

/** Días hasta una fecha YYYY-MM-DD; null si vacía. */
export function daysUntil(date: string) {
  if (!date) return null;
  const target = new Date(`${date.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export type FleetAlertKind = "servicio_km" | "servicio_fecha" | "seguro" | "verificacion";

export type FleetAlert = {
  kind: FleetAlertKind;
  vehicleId: string;
  label: string;
  detail: string;
  severity: "overdue" | "soon" | "ok";
};

export function buildVehicleAlerts(vehicle: CompanyVehicle): FleetAlert[] {
  const alerts: FleetAlert[] = [];
  const label = `${vehicle.plate} · ${vehicle.brand} ${vehicle.model}`.trim();

  if (vehicle.nextServiceKm != null) {
    const remaining = vehicle.nextServiceKm - vehicle.odometerKm;
    alerts.push({
      kind: "servicio_km",
      vehicleId: vehicle.id,
      label,
      detail:
        remaining <= 0
          ? `Servicio vencido por km (odómetro ${vehicle.odometerKm} / meta ${vehicle.nextServiceKm})`
          : `Faltan ${Math.round(remaining)} km para el próximo servicio`,
      severity: remaining <= 0 ? "overdue" : remaining <= 500 ? "soon" : "ok",
    });
  }

  const serviceDays = daysUntil(vehicle.nextServiceDate);
  if (serviceDays !== null) {
    alerts.push({
      kind: "servicio_fecha",
      vehicleId: vehicle.id,
      label,
      detail:
        serviceDays < 0
          ? `Servicio vencido hace ${Math.abs(serviceDays)} días`
          : `Próximo servicio en ${serviceDays} días`,
      severity: serviceDays < 0 ? "overdue" : serviceDays <= 14 ? "soon" : "ok",
    });
  }

  const insuranceDays = daysUntil(vehicle.insuranceExpires);
  if (insuranceDays !== null) {
    alerts.push({
      kind: "seguro",
      vehicleId: vehicle.id,
      label,
      detail:
        insuranceDays < 0
          ? `Seguro vencido hace ${Math.abs(insuranceDays)} días`
          : `Seguro vence en ${insuranceDays} días`,
      severity:
        insuranceDays < 0 ? "overdue" : insuranceDays <= 30 ? "soon" : "ok",
    });
  }

  const verificationDays = daysUntil(vehicle.verificationExpires);
  if (verificationDays !== null) {
    alerts.push({
      kind: "verificacion",
      vehicleId: vehicle.id,
      label,
      detail:
        verificationDays < 0
          ? `Verificación vencida hace ${Math.abs(verificationDays)} días`
          : `Verificación en ${verificationDays} días`,
      severity:
        verificationDays < 0
          ? "overdue"
          : verificationDays <= 30
            ? "soon"
            : "ok",
    });
  }

  return alerts.filter((a) => a.severity !== "ok");
}
