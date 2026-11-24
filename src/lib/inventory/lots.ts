import { supabase } from "@/lib/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type LotUnitInput = {
  lotNumber: string;
  manufacturedAt: string;
  expiryDate: string;
  notes: string;
};

const dateOrNull = (value: string) => (value.trim() ? value.trim() : null);

/** Corrige datos de un lote (número, fechas, notas); las existencias no cambian. */
export async function updateLotUnit(lotId: string, input: LotUnitInput) {
  const lotNumber = input.lotNumber.trim();
  if (!lotNumber) throw new Error("El número de lote es obligatorio.");

  const { data: current, error: currentError } = await db
    .from("lots")
    .select("product_id, lot_number")
    .eq("id", lotId)
    .single();
  if (currentError) throw new Error(currentError.message);

  if (lotNumber !== String(current.lot_number ?? "")) {
    const { data: duplicate, error: duplicateError } = await db
      .from("lots")
      .select("id")
      .eq("product_id", current.product_id)
      .eq("lot_number", lotNumber)
      .neq("id", lotId)
      .limit(1);
    if (duplicateError) throw new Error(duplicateError.message);
    if (duplicate?.length) {
      throw new Error(`El lote ${lotNumber} ya existe en este producto.`);
    }
  }

  const { error } = await db
    .from("lots")
    .update({
      lot_number: lotNumber,
      manufactured_at: dateOrNull(input.manufacturedAt),
      expiry_date: dateOrNull(input.expiryDate),
      notes: input.notes.trim(),
    })
    .eq("id", lotId);
  if (error) throw new Error(error.message);
}

/**
 * Elimina un lote de la ficha. Si aún hay existencia, registra ajuste_faltante
 * y luego borra balances y la fila del lote.
 */
export async function deleteLotUnit(lotId: string, createdBy: string) {
  const actor = createdBy.trim();
  if (!actor) throw new Error("Se requiere un usuario responsable.");
  const { error } = await db.rpc("delete_inventory_lot", {
    p_lot_id: lotId,
    p_created_by: actor,
  });
  if (error) throw new Error(error.message);
}
