import { supabase } from "@/lib/supabase/client";
import type { InventoryGalleryImage } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const INVENTORY_MEDIA_BUCKET = "inventory-media";

/** Tablas con foto principal (image_path / image_url) + galería (gallery_images). */
export type UnitMediaTable = "serial_numbers" | "lots";

export type UnitImages = {
  imagePath: string;
  imageUrl: string;
  galleryImages: InventoryGalleryImage[];
};

export function parseGalleryImages(value: unknown): InventoryGalleryImage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const raw = (entry ?? {}) as Record<string, unknown>;
      return {
        path: String(raw.path ?? ""),
        url: String(raw.url ?? ""),
        uploadedAt: String(raw.uploadedAt ?? ""),
      };
    })
    .filter((image) => image.path && image.url);
}

/**
 * Las fotos de evidencia de entradas se comparten entre el movimiento y la galería;
 * quitarlas de la galería no debe borrar el archivo que respalda al movimiento.
 */
export function isEvidencePath(path: string) {
  return path.includes("/evidence/");
}

export async function removeStoredImage(path: string) {
  if (!path || isEvidencePath(path)) return;
  await supabase.storage.from(INVENTORY_MEDIA_BUCKET).remove([path]);
}

/** Sube archivos de imagen; si alguno falla, borra los ya subidos. */
export async function uploadImages(folder: string, files: File[]): Promise<InventoryGalleryImage[]> {
  const images = files.filter((file) => file.type.startsWith("image/"));
  if (images.length === 0) throw new Error("Solo se permiten archivos de imagen.");

  const uploaded: InventoryGalleryImage[] = [];
  for (const [index, file] of images.entries()) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${folder}/${Date.now()}-${index}-${safeName}`;
    const { error } = await supabase.storage
      .from(INVENTORY_MEDIA_BUCKET)
      .upload(path, file, { upsert: false });
    if (error) {
      if (uploaded.length) {
        await supabase.storage
          .from(INVENTORY_MEDIA_BUCKET)
          .remove(uploaded.map((image) => image.path));
      }
      throw new Error(error.message);
    }
    const { data } = supabase.storage.from(INVENTORY_MEDIA_BUCKET).getPublicUrl(path);
    uploaded.push({ path, url: data.publicUrl, uploadedAt: new Date().toISOString() });
  }
  return uploaded;
}

async function fetchUnitImages(table: UnitMediaTable, id: string) {
  const { data, error } = await db
    .from(table)
    .select("product_id, image_path, image_url, gallery_images")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return {
    productId: String(data.product_id ?? ""),
    imagePath: String(data.image_path ?? ""),
    imageUrl: String(data.image_url ?? ""),
    galleryImages: parseGalleryImages(data.gallery_images),
  };
}

async function saveUnitImages(
  table: UnitMediaTable,
  id: string,
  primary: { path: string; url: string },
  gallery: InventoryGalleryImage[]
): Promise<UnitImages> {
  const { error } = await db
    .from(table)
    .update({ image_path: primary.path, image_url: primary.url, gallery_images: gallery })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { imagePath: primary.path, imageUrl: primary.url, galleryImages: gallery };
}

/** Agrega imágenes ya subidas; si la unidad no tenía principal, la primera ocupa ese lugar. */
export async function attachUnitImages(
  table: UnitMediaTable,
  id: string,
  images: InventoryGalleryImage[]
): Promise<UnitImages> {
  const current = await fetchUnitImages(table, id);
  if (images.length === 0) return current;
  let primary = { path: current.imagePath, url: current.imageUrl };
  let extra = images;
  if (!primary.path || !primary.url) {
    const [first, ...rest] = images;
    primary = { path: first.path, url: first.url };
    extra = rest;
  }
  return saveUnitImages(table, id, primary, [...current.galleryImages, ...extra]);
}

export async function addUnitImages(
  table: UnitMediaTable,
  id: string,
  files: File[]
): Promise<UnitImages> {
  const { productId } = await fetchUnitImages(table, id);
  const uploaded = await uploadImages(`${productId}/${table}/${id}`, files);
  try {
    return await attachUnitImages(table, id, uploaded);
  } catch (err) {
    await supabase.storage
      .from(INVENTORY_MEDIA_BUCKET)
      .remove(uploaded.map((image) => image.path));
    throw err;
  }
}

/** Quita una foto; si era la principal, la siguiente de la galería toma su lugar. */
export async function removeUnitImage(
  table: UnitMediaTable,
  id: string,
  path: string
): Promise<UnitImages> {
  const current = await fetchUnitImages(table, id);
  await removeStoredImage(path);

  if (path === current.imagePath) {
    const [next, ...rest] = current.galleryImages;
    return saveUnitImages(
      table,
      id,
      next ? { path: next.path, url: next.url } : { path: "", url: "" },
      rest
    );
  }
  return saveUnitImages(
    table,
    id,
    { path: current.imagePath, url: current.imageUrl },
    current.galleryImages.filter((image) => image.path !== path)
  );
}

export async function setUnitPrimaryImage(
  table: UnitMediaTable,
  id: string,
  path: string
): Promise<UnitImages> {
  const current = await fetchUnitImages(table, id);
  if (path === current.imagePath) return current;
  const target = current.galleryImages.find((image) => image.path === path);
  if (!target) throw new Error("La imagen ya no existe.");

  const rest = current.galleryImages.filter((image) => image.path !== path);
  const gallery = current.imagePath
    ? [
        { path: current.imagePath, url: current.imageUrl, uploadedAt: new Date().toISOString() },
        ...rest,
      ]
    : rest;
  return saveUnitImages(table, id, { path: target.path, url: target.url }, gallery);
}
