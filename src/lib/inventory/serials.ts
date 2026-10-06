import { supabase } from "@/lib/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/**
 * Estados que se pueden fijar a mano. Reservado, en tránsito, instalado y baja los
 * determinan los movimientos de almacén; cambiarlos aquí descuadraría existencias.
 */
export const EDITABLE_SERIAL_STATUSES = ["disponible", "en_servicio", "en_reparacion"] as const;

export type SerialUnitInput = {
  serialNumber: string;
  inventoryNumber: string;
  status: string;
  notes: string;
  manufacturedAt: string;
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;
  warrantyStart: string;
  warrantyEnd: string;
};

export function isEditableSerialStatus(status: string) {
  return (EDITABLE_SERIAL_STATUSES as readonly string[]).includes(status);
}

/** Una serie por línea (también acepta comas o punto y coma). */
export function parseSerialNumbers(raw: string): string[] {
  const seen = new Set<string>();
  const serials: string[] = [];
  for (const part of raw.split(/[\n,;]+/)) {
    const value = part.trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase("es");
    if (seen.has(key)) {
      throw new Error(`La serie ${value} está repetida en esta entrada.`);
    }
    seen.add(key);
    serials.push(value);
  }
  return serials;
}

const dateOrNull = (value: string) => (value.trim() ? value.trim() : null);

/** Actualiza los datos propios de una pieza serializada (no su ubicación ni existencias). */
export async function updateSerialUnit(serialId: string, input: SerialUnitInput) {
  const serialNumber = input.serialNumber.trim();
  if (!serialNumber) throw new Error("El número de serie es obligatorio.");

  const { data: current, error: currentError } = await db
    .from("serial_numbers")
    .select("serial_number, status")
    .eq("id", serialId)
    .single();
  if (currentError) throw new Error(currentError.message);

  const lockedStatus = !isEditableSerialStatus(current.status);
  if (!lockedStatus && !isEditableSerialStatus(input.status)) {
    throw new Error("Estado no permitido para edición manual.");
  }

  const previousSerial = String(current.serial_number ?? "");
  if (serialNumber !== previousSerial) {
    const { data: duplicate, error: duplicateError } = await db
      .from("serial_numbers")
      .select("id")
      .eq("serial_number", serialNumber)
      .neq("id", serialId)
      .limit(1);
    if (duplicateError) throw new Error(duplicateError.message);
    if (duplicate?.length) {
      throw new Error(`La serie ${serialNumber} ya está registrada en otra pieza.`);
    }
  }

  const { error } = await db
    .from("serial_numbers")
    .update({
      serial_number: serialNumber,
      inventory_number: input.inventoryNumber.trim(),
      ...(lockedStatus ? {} : { status: input.status }),
      notes: input.notes.trim(),
      manufactured_at: dateOrNull(input.manufacturedAt),
      last_maintenance_date: dateOrNull(input.lastMaintenanceDate),
      next_maintenance_date: dateOrNull(input.nextMaintenanceDate),
      warranty_start: dateOrNull(input.warrantyStart),
      warranty_end: dateOrNull(input.warrantyEnd),
    })
    .eq("id", serialId);
  if (error) throw new Error(error.message);

  if (serialNumber !== previousSerial && previousSerial) {
    const { error: movementsError } = await db
      .from("inventory_movements")
      .update({ related_serial: serialNumber })
      .eq("serial_id", serialId)
      .eq("related_serial", previousSerial);
    if (movementsError) throw new Error(movementsError.message);
  }
}
