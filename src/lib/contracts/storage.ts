import { supabase } from "@/lib/supabase/client";
import type { ServiceContract, ServiceContractInput } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function dateOrEmpty(value: unknown) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function mapContract(row: Record<string, unknown>): ServiceContract {
  return {
    id: String(row.id),
    contractNumber: String(row.contract_number ?? ""),
    title: String(row.title ?? ""),
    clientId: row.client_id ? String(row.client_id) : null,
    tenderId: row.tender_id ? String(row.tender_id) : null,
    startsOn: dateOrEmpty(row.starts_on),
    endsOn: dateOrEmpty(row.ends_on),
    notes: String(row.notes ?? ""),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function payload(input: ServiceContractInput) {
  const contractNumber = input.contractNumber.trim();
  if (!contractNumber) {
    throw new Error("El número de contrato es obligatorio.");
  }
  return {
    contract_number: contractNumber,
    title: input.title.trim(),
    client_id: input.clientId || null,
    tender_id: input.tenderId || null,
    starts_on: input.startsOn || null,
    ends_on: input.endsOn || null,
    notes: input.notes.trim(),
    is_active: input.isActive,
  };
}

function throwContractError(error: { code?: string; message?: string }) {
  if (error.code === "23505") {
    throw new Error("Ya existe un contrato con ese número.");
  }
  throw new Error(error.message || "No se pudo guardar el contrato.");
}

export async function getServiceContracts(): Promise<ServiceContract[]> {
  const { data, error } = await db
    .from("service_contracts")
    .select("*")
    .order("contract_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapContract);
}

export async function createServiceContract(
  input: ServiceContractInput
): Promise<ServiceContract> {
  const { data, error } = await db
    .from("service_contracts")
    .insert(payload(input))
    .select("*")
    .single();
  if (error) throwContractError(error);
  return mapContract(data);
}

export async function updateServiceContract(
  id: string,
  input: ServiceContractInput
): Promise<ServiceContract> {
  const { data, error } = await db
    .from("service_contracts")
    .update(payload(input))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throwContractError(error);
  return mapContract(data);
}

export async function deleteServiceContract(id: string): Promise<void> {
  const { error } = await db.from("service_contracts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** El contrato vigente de un equipo es uno solo y puede quedar vacío. */
export async function setContractEquipment(
  contractId: string,
  equipmentIds: string[]
): Promise<void> {
  const { data: current, error: readError } = await db
    .from("client_equipment")
    .select("id")
    .eq("contract_id", contractId);
  if (readError) throw new Error(readError.message);

  const currentIds = new Set<string>(
    ((current ?? []) as Array<{ id: string }>).map((row) => String(row.id))
  );
  const nextIds = new Set<string>(equipmentIds.filter(Boolean));
  const toClear = [...currentIds].filter((id) => !nextIds.has(id));
  const toAssign = [...nextIds].filter((id) => !currentIds.has(id));

  if (toClear.length > 0) {
    const { error } = await db
      .from("client_equipment")
      .update({ contract_id: null, updated_at: new Date().toISOString() })
      .in("id", toClear);
    if (error) throw new Error(error.message);
  }
  if (toAssign.length > 0) {
    const { error } = await db
      .from("client_equipment")
      .update({ contract_id: contractId, updated_at: new Date().toISOString() })
      .in("id", toAssign);
    if (error) throw new Error(error.message);
  }
}
