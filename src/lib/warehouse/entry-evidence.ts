import { supabase } from "@/lib/supabase/client";
import { attachInventoryItemImages } from "@/lib/inventory/storage";
import type { InventoryGalleryImage } from "@/lib/inventory/types";
import {
  attachUnitImages,
  INVENTORY_MEDIA_BUCKET,
  uploadImages,
} from "@/lib/inventory/unit-media";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type EvidenceTarget = "serie" | "lote" | "producto";

/**
 * Guarda las fotos de evidencia en el movimiento y las integra a la galería de la
 * pieza recibida: su serie, si no su lote y, si no tiene ninguno, el producto.
 */
export async function attachEntryEvidence(
  movementId: string,
  files: File[]
): Promise<{ images: InventoryGalleryImage[]; target: EvidenceTarget }> {
  const { data: movement, error: movementError } = await db
    .from("inventory_movements")
    .select("product_id, serial_id, lot_id, evidence_images")
    .eq("id", movementId)
    .single();
  if (movementError) throw new Error(movementError.message);

  const productId = String(movement.product_id ?? "");
  const images = await uploadImages(`${productId}/evidence/${movementId}`, files);

  try {
    const previous = Array.isArray(movement.evidence_images) ? movement.evidence_images : [];
    const { error } = await db
      .from("inventory_movements")
      .update({ evidence_images: [...previous, ...images] })
      .eq("id", movementId);
    if (error) throw new Error(error.message);
  } catch (err) {
    await supabase.storage
      .from(INVENTORY_MEDIA_BUCKET)
      .remove(images.map((image) => image.path));
    throw err;
  }

  if (movement.serial_id) {
    await attachUnitImages("serial_numbers", String(movement.serial_id), images);
    return { images, target: "serie" };
  }
  if (movement.lot_id) {
    await attachUnitImages("lots", String(movement.lot_id), images);
    return { images, target: "lote" };
  }
  await attachInventoryItemImages(productId, images);
  return { images, target: "producto" };
}
