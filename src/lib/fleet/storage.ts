import { supabase } from "@/lib/supabase/client";
import {
  computeServiceTotal,
  vehicleServiceStatusLabel,
  type CompanyVehicle,
  type CompanyVehicleInput,
  type FuelType,
  type VehicleService,
  type VehicleServiceEvent,
  type VehicleServiceInput,
  type VehicleServiceLine,
  type VehicleServiceLineInput,
  type VehicleServiceStatus,
  type VehicleServiceType,
  type VehicleStatus,
  type VehicleType,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function dateOrEmpty(value: unknown) {
  return value ? String(value).slice(0, 10) : "";
}

function mapVehicle(row: Record<string, unknown>): CompanyVehicle {
  return {
    id: String(row.id),
    code: String(row.code ?? ""),
    plate: String(row.plate ?? ""),
    brand: String(row.brand ?? ""),
    model: String(row.model ?? ""),
    year: row.year == null ? null : Number(row.year),
    color: String(row.color ?? ""),
    vin: String(row.vin ?? ""),
    vehicleType: String(row.vehicle_type ?? "utilitario") as VehicleType,
    status: String(row.status ?? "activo") as VehicleStatus,
    odometerKm: Number(row.odometer_km ?? 0),
    fuelType: String(row.fuel_type ?? "gasolina") as FuelType,
    assignedTo: String(row.assigned_to ?? ""),
    insurancePolicy: String(row.insurance_policy ?? ""),
    insuranceExpires: dateOrEmpty(row.insurance_expires),
    verificationExpires: dateOrEmpty(row.verification_expires),
    nextServiceKm:
      row.next_service_km == null ? null : Number(row.next_service_km),
    nextServiceDate: dateOrEmpty(row.next_service_date),
    notes: String(row.notes ?? ""),
    isActive: Boolean(row.is_active ?? true),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapLine(row: Record<string, unknown>): VehicleServiceLine {
  return {
    id: String(row.id),
    serviceId: String(row.service_id),
    description: String(row.description ?? ""),
    quantity: Number(row.quantity ?? 0),
    unitCost: Number(row.unit_cost ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapEvent(row: Record<string, unknown>): VehicleServiceEvent {
  return {
    id: String(row.id),
    serviceId: String(row.service_id),
    eventType: String(row.event_type ?? "nota"),
    message: String(row.message ?? ""),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at),
  };
}

function mapService(
  row: Record<string, unknown>,
  vehicle?: CompanyVehicle,
  lines: VehicleServiceLine[] = [],
  events: VehicleServiceEvent[] = []
): VehicleService {
  const brand = vehicle?.brand ?? "";
  const model = vehicle?.model ?? "";
  return {
    id: String(row.id),
    folio: String(row.folio),
    vehicleId: String(row.vehicle_id),
    vehicleCode: vehicle?.code ?? "",
    vehiclePlate: vehicle?.plate ?? "",
    vehicleLabel: [brand, model].filter(Boolean).join(" ") || vehicle?.plate || "",
    serviceType: String(row.service_type ?? "preventivo") as VehicleServiceType,
    status: String(row.status ?? "programado") as VehicleServiceStatus,
    priority: (String(row.priority ?? "normal") === "urgente"
      ? "urgente"
      : "normal") as "normal" | "urgente",
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    workshop: String(row.workshop ?? ""),
    technician: String(row.technician ?? ""),
    requestedBy: String(row.requested_by ?? ""),
    odometerKm: row.odometer_km == null ? null : Number(row.odometer_km),
    scheduledAt: dateOrEmpty(row.scheduled_at),
    startedAt: dateOrEmpty(row.started_at),
    completedAt: dateOrEmpty(row.completed_at),
    nextServiceKm:
      row.next_service_km == null ? null : Number(row.next_service_km),
    nextServiceDate: dateOrEmpty(row.next_service_date),
    laborCost: Number(row.labor_cost ?? 0),
    partsCost: Number(row.parts_cost ?? 0),
    otherCost: Number(row.other_cost ?? 0),
    totalCost: Number(row.total_cost ?? 0),
    invoiceFolio: String(row.invoice_folio ?? ""),
    notes: String(row.notes ?? ""),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lines,
    events,
  };
}

async function nextVehicleCode() {
  const { data, error } = await db
    .from("company_vehicles")
    .select("code")
    .like("code", "VEH-%")
    .order("code", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = data?.[0]?.code as string | undefined;
  const seq = last ? Number(last.replace("VEH-", "")) + 1 : 1;
  return `VEH-${String(Number.isFinite(seq) ? seq : 1).padStart(3, "0")}`;
}

async function nextServiceFolio() {
  const year = new Date().getFullYear();
  const prefix = `VS-${year}-`;
  const { data, error } = await db
    .from("vehicle_services")
    .select("folio")
    .like("folio", `${prefix}%`)
    .order("folio", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = data?.[0]?.folio as string | undefined;
  const seq = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(4, "0")}`;
}

async function addEvent(
  serviceId: string,
  message: string,
  createdBy: string,
  eventType = "nota"
) {
  const { error } = await db.from("vehicle_service_events").insert({
    service_id: serviceId,
    event_type: eventType,
    message,
    created_by: createdBy,
  });
  if (error) throw new Error(error.message);
}

function vehiclePayload(input: CompanyVehicleInput) {
  return {
    plate: input.plate.trim().toUpperCase(),
    brand: (input.brand ?? "").trim(),
    model: (input.model ?? "").trim(),
    year: input.year ?? null,
    color: (input.color ?? "").trim(),
    vin: (input.vin ?? "").trim().toUpperCase(),
    vehicle_type: input.vehicleType ?? "utilitario",
    status: input.status ?? "activo",
    odometer_km: Number(input.odometerKm ?? 0),
    fuel_type: input.fuelType ?? "gasolina",
    assigned_to: (input.assignedTo ?? "").trim(),
    insurance_policy: (input.insurancePolicy ?? "").trim(),
    insurance_expires: input.insuranceExpires || null,
    verification_expires: input.verificationExpires || null,
    next_service_km:
      input.nextServiceKm == null || input.nextServiceKm === ("" as never)
        ? null
        : Number(input.nextServiceKm),
    next_service_date: input.nextServiceDate || null,
    notes: (input.notes ?? "").trim(),
    is_active: input.isActive ?? true,
  };
}

function servicePayload(input: VehicleServiceInput, lines: VehicleServiceLineInput[]) {
  const labor = Number(input.laborCost ?? 0);
  const parts = Number(input.partsCost ?? 0);
  const other = Number(input.otherCost ?? 0);
  return {
    vehicle_id: input.vehicleId,
    service_type: input.serviceType ?? "preventivo",
    status: input.status ?? "programado",
    priority: input.priority ?? "normal",
    title: (input.title ?? "").trim(),
    description: (input.description ?? "").trim(),
    workshop: (input.workshop ?? "").trim(),
    technician: (input.technician ?? "").trim(),
    requested_by: (input.requestedBy ?? "").trim(),
    odometer_km: input.odometerKm == null ? null : Number(input.odometerKm),
    scheduled_at: input.scheduledAt || null,
    started_at: input.startedAt || null,
    completed_at: input.completedAt || null,
    next_service_km:
      input.nextServiceKm == null ? null : Number(input.nextServiceKm),
    next_service_date: input.nextServiceDate || null,
    labor_cost: labor,
    parts_cost: parts,
    other_cost: other,
    total_cost: computeServiceTotal(labor, parts, other, lines),
    invoice_folio: (input.invoiceFolio ?? "").trim(),
    notes: (input.notes ?? "").trim(),
  };
}

export async function getCompanyVehicles(): Promise<CompanyVehicle[]> {
  const { data, error } = await db
    .from("company_vehicles")
    .select("*")
    .order("plate", { ascending: true });
  if (error) throw new Error(error.message);

  const vehicles = (data ?? []).map(mapVehicle);
  if (!vehicles.length) return [];

  const ids = vehicles.map((v: CompanyVehicle) => v.id);
  const { data: services, error: svcError } = await db
    .from("vehicle_services")
    .select("id, vehicle_id, status")
    .in("vehicle_id", ids);
  if (svcError) throw new Error(svcError.message);

  const countBy = new Map<string, { total: number; open: number }>();
  for (const row of services ?? []) {
    const vid = String(row.vehicle_id);
    const cur = countBy.get(vid) ?? { total: 0, open: 0 };
    cur.total += 1;
    if (row.status === "programado" || row.status === "en_proceso") cur.open += 1;
    countBy.set(vid, cur);
  }

  return vehicles.map((v: CompanyVehicle) => ({
    ...v,
    servicesCount: countBy.get(v.id)?.total ?? 0,
    openServicesCount: countBy.get(v.id)?.open ?? 0,
  }));
}

export async function createCompanyVehicle(
  input: CompanyVehicleInput
): Promise<CompanyVehicle> {
  if (!input.plate.trim()) throw new Error("La placa es obligatoria.");
  const code = input.code?.trim() || (await nextVehicleCode());
  const { data, error } = await db
    .from("company_vehicles")
    .insert({
      code,
      ...vehiclePayload(input),
      created_by: (input.createdBy ?? "").trim(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapVehicle(data);
}

export async function updateCompanyVehicle(
  id: string,
  input: CompanyVehicleInput
): Promise<CompanyVehicle> {
  const { data, error } = await db
    .from("company_vehicles")
    .update({
      ...vehiclePayload(input),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapVehicle(data);
}

export async function deleteCompanyVehicle(id: string): Promise<void> {
  const { error } = await db.from("company_vehicles").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

async function hydrateServices(
  rows: Record<string, unknown>[],
  vehiclesById: Map<string, CompanyVehicle>
): Promise<VehicleService[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);

  const [linesRes, eventsRes] = await Promise.all([
    db
      .from("vehicle_service_lines")
      .select("*")
      .in("service_id", ids)
      .order("sort_order", { ascending: true }),
    db
      .from("vehicle_service_events")
      .select("*")
      .in("service_id", ids)
      .order("created_at", { ascending: false }),
  ]);
  if (linesRes.error) throw new Error(linesRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  const linesBy = new Map<string, VehicleServiceLine[]>();
  for (const row of linesRes.data ?? []) {
    const sid = String(row.service_id);
    const list = linesBy.get(sid) ?? [];
    list.push(mapLine(row));
    linesBy.set(sid, list);
  }

  const eventsBy = new Map<string, VehicleServiceEvent[]>();
  for (const row of eventsRes.data ?? []) {
    const sid = String(row.service_id);
    const list = eventsBy.get(sid) ?? [];
    list.push(mapEvent(row));
    eventsBy.set(sid, list);
  }

  return rows.map((row) => {
    const id = String(row.id);
    const vehicle = vehiclesById.get(String(row.vehicle_id));
    return mapService(row, vehicle, linesBy.get(id) ?? [], eventsBy.get(id) ?? []);
  });
}

export async function getVehicleServices(options?: {
  vehicleId?: string;
}): Promise<VehicleService[]> {
  let query = db
    .from("vehicle_services")
    .select("*")
    .order("updated_at", { ascending: false });
  if (options?.vehicleId) query = query.eq("vehicle_id", options.vehicleId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (!rows.length) return [];

  const vehicleIds = [...new Set(rows.map((r: Record<string, unknown>) => String(r.vehicle_id)))];
  const { data: vehicles, error: vError } = await db
    .from("company_vehicles")
    .select("*")
    .in("id", vehicleIds);
  if (vError) throw new Error(vError.message);

  const vehiclesById = new Map<string, CompanyVehicle>();
  for (const row of vehicles ?? []) {
    vehiclesById.set(String(row.id), mapVehicle(row));
  }

  return hydrateServices(rows, vehiclesById);
}

export async function getVehicleService(id: string): Promise<VehicleService | null> {
  const { data, error } = await db
    .from("vehicle_services")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: vehicle, error: vError } = await db
    .from("company_vehicles")
    .select("*")
    .eq("id", data.vehicle_id)
    .maybeSingle();
  if (vError) throw new Error(vError.message);

  const vehiclesById = new Map<string, CompanyVehicle>();
  if (vehicle) vehiclesById.set(String(vehicle.id), mapVehicle(vehicle));
  const [svc] = await hydrateServices([data], vehiclesById);
  return svc ?? null;
}

async function replaceLines(serviceId: string, lines: VehicleServiceLineInput[]) {
  const { error: delError } = await db
    .from("vehicle_service_lines")
    .delete()
    .eq("service_id", serviceId);
  if (delError) throw new Error(delError.message);
  if (!lines.length) return;
  const { error } = await db.from("vehicle_service_lines").insert(
    lines.map((line, index) => ({
      service_id: serviceId,
      description: line.description.trim(),
      quantity: Number(line.quantity),
      unit_cost: Number(line.unitCost),
      sort_order: index,
    }))
  );
  if (error) throw new Error(error.message);
}

async function syncVehicleAfterService(
  vehicleId: string,
  input: VehicleServiceInput
) {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.odometerKm != null) patch.odometer_km = Number(input.odometerKm);
  if (input.nextServiceKm != null) patch.next_service_km = Number(input.nextServiceKm);
  if (input.nextServiceDate) patch.next_service_date = input.nextServiceDate;
  if (input.status === "en_proceso") patch.status = "taller";
  if (input.status === "completado") patch.status = "activo";

  if (Object.keys(patch).length <= 1) return;
  await db.from("company_vehicles").update(patch).eq("id", vehicleId);
}

export async function createVehicleService(
  input: VehicleServiceInput
): Promise<VehicleService> {
  if (!input.vehicleId) throw new Error("Selecciona un vehículo.");
  const createdBy = (input.createdBy ?? "").trim();
  const folio = await nextServiceFolio();
  const lines = input.lines ?? [];

  const { data, error } = await db
    .from("vehicle_services")
    .insert({
      folio,
      ...servicePayload(input, lines),
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (lines.length) await replaceLines(data.id, lines);
  await addEvent(data.id, `Servicio creado · ${folio}`, createdBy, "creacion");
  await syncVehicleAfterService(input.vehicleId, input);

  const created = await getVehicleService(data.id);
  if (!created) throw new Error("No se pudo recargar el servicio.");
  return created;
}

export async function updateVehicleService(
  id: string,
  input: VehicleServiceInput
): Promise<VehicleService> {
  const current = await getVehicleService(id);
  if (!current) throw new Error("Servicio no encontrado.");

  const lines = input.lines ?? current.lines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unitCost: l.unitCost,
  }));

  const { error } = await db
    .from("vehicle_services")
    .update({
      ...servicePayload({ ...input, vehicleId: input.vehicleId || current.vehicleId }, lines),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (input.lines) await replaceLines(id, input.lines);

  if (input.status && input.status !== current.status) {
    await addEvent(
      id,
      `Estatus: ${vehicleServiceStatusLabel(current.status)} → ${vehicleServiceStatusLabel(input.status)}`,
      input.createdBy ?? "",
      "estatus"
    );
  }

  await syncVehicleAfterService(input.vehicleId || current.vehicleId, {
    ...input,
    vehicleId: input.vehicleId || current.vehicleId,
  });

  const updated = await getVehicleService(id);
  if (!updated) throw new Error("No se pudo recargar el servicio.");
  return updated;
}

export async function setVehicleServiceStatus(
  id: string,
  status: VehicleServiceStatus,
  createdBy: string
): Promise<void> {
  const current = await getVehicleService(id);
  if (!current) throw new Error("Servicio no encontrado.");

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "en_proceso" && !current.startedAt) {
    patch.started_at = new Date().toISOString().slice(0, 10);
  }
  if (status === "completado") {
    patch.completed_at = new Date().toISOString().slice(0, 10);
  }

  const { error } = await db.from("vehicle_services").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  await addEvent(
    id,
    `Estatus: ${vehicleServiceStatusLabel(current.status)} → ${vehicleServiceStatusLabel(status)}`,
    createdBy,
    "estatus"
  );

  await syncVehicleAfterService(current.vehicleId, {
    vehicleId: current.vehicleId,
    status,
    odometerKm: current.odometerKm,
    nextServiceKm: current.nextServiceKm,
    nextServiceDate: current.nextServiceDate,
  });
}

export async function deleteVehicleService(id: string): Promise<void> {
  const { error } = await db.from("vehicle_services").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function addVehicleServiceNote(
  serviceId: string,
  message: string,
  createdBy: string
): Promise<void> {
  if (!message.trim()) throw new Error("Escribe una nota.");
  await addEvent(serviceId, message.trim(), createdBy, "nota");
}
