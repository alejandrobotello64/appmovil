import { supabase } from "@/lib/supabase/client";
import type {
  Client,
  ClientContact,
  ClientContactInput,
  ClientEquipment,
  ClientEquipmentInput,
  ClientEquipmentStatus,
  ClientInput,
  ClientService,
  ClientServiceInput,
  ClientServiceType,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function mapClient(row: Record<string, unknown>): Client {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    contactName: String(row.contact_name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    rfc: String(row.rfc ?? ""),
    address: String(row.address ?? ""),
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    notes: String(row.notes ?? ""),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapEquipment(row: Record<string, unknown>): ClientEquipment {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    name: String(row.name ?? ""),
    brand: String(row.brand ?? ""),
    model: String(row.model ?? ""),
    serialNumber: String(row.serial_number ?? ""),
    location: String(row.location ?? ""),
    status: String(row.status ?? "operativo") as ClientEquipmentStatus,
    equipmentKind: String(row.equipment_kind ?? "general"),
    installedAt: row.installed_at ? String(row.installed_at).slice(0, 10) : "",
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapService(row: Record<string, unknown>): ClientService {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    equipmentId: row.equipment_id ? String(row.equipment_id) : null,
    serviceType: String(row.service_type ?? "otro") as ClientServiceType,
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    performedAt: String(row.performed_at ?? "").slice(0, 10),
    technician: String(row.technician ?? ""),
    folio: String(row.folio ?? ""),
    notes: String(row.notes ?? ""),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at),
  };
}

function mapContact(row: Record<string, unknown>): ClientContact {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    name: String(row.name ?? ""),
    roleTitle: String(row.role_title ?? ""),
    department: String(row.department ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    extension: String(row.extension ?? ""),
    notes: String(row.notes ?? ""),
    isPrimary: Boolean(row.is_primary),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function getClients(): Promise<Client[]> {
  const { data, error } = await db
    .from("clients")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapClient);
}

export async function createClient(input: ClientInput): Promise<Client> {
  const { data, error } = await db
    .from("clients")
    .insert({
      name: input.name.trim(),
      contact_name: input.contactName.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      rfc: input.rfc.trim().toUpperCase(),
      address: input.address.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      notes: input.notes.trim(),
      is_active: input.isActive,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapClient(data);
}

export async function updateClient(
  id: string,
  input: ClientInput
): Promise<Client> {
  const { data, error } = await db
    .from("clients")
    .update({
      name: input.name.trim(),
      contact_name: input.contactName.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      rfc: input.rfc.trim().toUpperCase(),
      address: input.address.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      notes: input.notes.trim(),
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapClient(data);
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await db.from("clients").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getClientEquipment(
  clientId?: string
): Promise<ClientEquipment[]> {
  let query = db
    .from("client_equipment")
    .select("*")
    .order("created_at", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapEquipment);
}

export async function createClientEquipment(
  input: ClientEquipmentInput
): Promise<ClientEquipment> {
  const { data, error } = await db
    .from("client_equipment")
    .insert({
      client_id: input.clientId,
      name: input.name.trim(),
      brand: input.brand.trim(),
      model: input.model.trim(),
      serial_number: input.serialNumber.trim(),
      location: input.location.trim(),
      status: input.status,
      equipment_kind: (input.equipmentKind ?? "general").trim() || "general",
      installed_at: input.installedAt || null,
      notes: input.notes.trim(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapEquipment(data);
}

export async function updateClientEquipment(
  id: string,
  input: ClientEquipmentInput
): Promise<ClientEquipment> {
  const { data, error } = await db
    .from("client_equipment")
    .update({
      client_id: input.clientId,
      name: input.name.trim(),
      brand: input.brand.trim(),
      model: input.model.trim(),
      serial_number: input.serialNumber.trim(),
      location: input.location.trim(),
      status: input.status,
      equipment_kind: (input.equipmentKind ?? "general").trim() || "general",
      installed_at: input.installedAt || null,
      notes: input.notes.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapEquipment(data);
}

export async function setClientEquipmentStatus(
  id: string,
  status: ClientEquipmentStatus
): Promise<void> {
  const { error } = await db
    .from("client_equipment")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteClientEquipment(id: string): Promise<void> {
  const { error } = await db.from("client_equipment").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getClientServices(filters?: {
  clientId?: string;
  equipmentId?: string;
}): Promise<ClientService[]> {
  let query = db
    .from("client_services")
    .select("*")
    .order("performed_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (filters?.clientId) query = query.eq("client_id", filters.clientId);
  if (filters?.equipmentId) query = query.eq("equipment_id", filters.equipmentId);
  const { data, error } = await query.limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapService);
}

export async function createClientService(
  input: ClientServiceInput
): Promise<ClientService> {
  const { data, error } = await db
    .from("client_services")
    .insert({
      client_id: input.clientId,
      equipment_id: input.equipmentId || null,
      service_type: input.serviceType,
      title: input.title.trim(),
      description: input.description.trim(),
      performed_at: input.performedAt,
      technician: input.technician.trim(),
      folio: input.folio.trim(),
      notes: input.notes.trim(),
      created_by: input.createdBy.trim(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapService(data);
}

export async function deleteClientService(id: string): Promise<void> {
  const { error } = await db.from("client_services").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getClientContacts(
  clientId?: string
): Promise<ClientContact[]> {
  let query = db
    .from("client_contacts")
    .select("*")
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapContact);
}

export async function createClientContact(
  input: ClientContactInput
): Promise<ClientContact> {
  if (!input.name.trim()) throw new Error("El nombre del contacto es obligatorio.");
  if (input.isPrimary) {
    await db
      .from("client_contacts")
      .update({ is_primary: false })
      .eq("client_id", input.clientId);
  }
  const { data, error } = await db
    .from("client_contacts")
    .insert({
      client_id: input.clientId,
      name: input.name.trim(),
      role_title: input.roleTitle.trim(),
      department: input.department.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      extension: input.extension.trim(),
      notes: input.notes.trim(),
      is_primary: Boolean(input.isPrimary),
      sort_order: Number(input.sortOrder ?? 0),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapContact(data);
}

export async function updateClientContact(
  id: string,
  input: ClientContactInput
): Promise<ClientContact> {
  if (!input.name.trim()) throw new Error("El nombre del contacto es obligatorio.");
  if (input.isPrimary) {
    await db
      .from("client_contacts")
      .update({ is_primary: false })
      .eq("client_id", input.clientId)
      .neq("id", id);
  }
  const { data, error } = await db
    .from("client_contacts")
    .update({
      client_id: input.clientId,
      name: input.name.trim(),
      role_title: input.roleTitle.trim(),
      department: input.department.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      extension: input.extension.trim(),
      notes: input.notes.trim(),
      is_primary: Boolean(input.isPrimary),
      sort_order: Number(input.sortOrder ?? 0),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapContact(data);
}

export async function deleteClientContact(id: string): Promise<void> {
  const { error } = await db.from("client_contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
