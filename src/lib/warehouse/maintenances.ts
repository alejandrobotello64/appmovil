import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { updateInventoryItem, getInventoryItems } from "@/lib/inventory/storage";

type MaintenanceRow =
  Database["public"]["Tables"]["equipment_maintenances"]["Row"];

export type MaintenanceType = "preventivo" | "correctivo" | "calibracion";
export type MaintenanceStatus =
  | "programado"
  | "en_proceso"
  | "completado"
  | "cancelado";

export type EquipmentMaintenance = {
  id: string;
  equipmentId: string;
  maintenanceType: MaintenanceType;
  status: MaintenanceStatus;
  scheduledDate: string;
  completedDate: string;
  technician: string;
  cost: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type EquipmentMaintenanceInput = {
  equipmentId: string;
  maintenanceType: MaintenanceType;
  status: MaintenanceStatus;
  scheduledDate: string;
  completedDate?: string;
  technician: string;
  cost: number;
  notes: string;
  createdBy?: string;
};

function mapRow(row: MaintenanceRow): EquipmentMaintenance {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    maintenanceType: row.maintenance_type as MaintenanceType,
    status: row.status as MaintenanceStatus,
    scheduledDate: row.scheduled_date,
    completedDate: row.completed_date ?? "",
    technician: row.technician ?? "",
    cost: Number(row.cost ?? 0),
    notes: row.notes ?? "",
    createdBy: row.created_by ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getMaintenances(): Promise<EquipmentMaintenance[]> {
  const { data, error } = await supabase
    .from("equipment_maintenances")
    .select("*")
    .order("scheduled_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function createMaintenance(
  input: EquipmentMaintenanceInput
): Promise<EquipmentMaintenance> {
  const { data, error } = await supabase
    .from("equipment_maintenances")
    .insert({
      equipment_id: input.equipmentId,
      maintenance_type: input.maintenanceType,
      status: input.status,
      scheduled_date: input.scheduledDate,
      completed_date: input.completedDate || null,
      technician: input.technician,
      cost: input.cost,
      notes: input.notes,
      created_by: input.createdBy ?? "",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  if (input.status === "programado" || input.status === "en_proceso") {
    const equipment = (await getInventoryItems({ kind: "equipo" })).find(
      (item) => item.id === input.equipmentId
    );
    if (equipment) {
      await updateInventoryItem(equipment.id, {
        ...equipment,
        assetStatus: "mantenimiento",
        nextMaintenanceDate: input.scheduledDate,
      });
    }
  }

  return mapRow(data);
}

export async function completeMaintenance(
  id: string
): Promise<EquipmentMaintenance> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("equipment_maintenances")
    .update({
      status: "completado",
      completed_date: today,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const equipment = (await getInventoryItems({ kind: "equipo" })).find(
    (item) => item.id === data.equipment_id
  );

  if (equipment) {
    await updateInventoryItem(equipment.id, {
      ...equipment,
      assetStatus: "operativo",
      lastMaintenanceDate: today,
    });
  }

  return mapRow(data);
}
