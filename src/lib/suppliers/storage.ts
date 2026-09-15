import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { Supplier, SupplierInput } from "./types";

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];
type SupplierInsert = Database["public"]["Tables"]["suppliers"]["Insert"];

function mapRowToSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    rfc: row.rfc ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    notes: row.notes ?? "",
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInputToRow(input: SupplierInput): SupplierInsert {
  return {
    name: input.name.trim(),
    contact_name: input.contactName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    rfc: input.rfc.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    notes: input.notes.trim(),
    is_active: input.isActive,
  };
}

export async function getSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading suppliers:", error.message);
    throw new Error(error.message);
  }

  return (data ?? []).map(mapRowToSupplier);
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  const { data, error } = await supabase
    .from("suppliers")
    .insert(mapInputToRow(input))
    .select("*")
    .single();

  if (error) {
    console.error("Error creating supplier:", error.message);
    throw new Error(error.message);
  }

  return mapRowToSupplier(data);
}

export async function updateSupplier(
  id: string,
  input: SupplierInput
): Promise<Supplier> {
  const { data, error } = await supabase
    .from("suppliers")
    .update(mapInputToRow(input))
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating supplier:", error.message);
    throw new Error(error.message);
  }

  return mapRowToSupplier(data);
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from("suppliers").delete().eq("id", id);

  if (error) {
    console.error("Error deleting supplier:", error.message);
    throw new Error(error.message);
  }
}
