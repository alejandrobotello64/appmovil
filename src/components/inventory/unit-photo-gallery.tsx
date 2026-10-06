"use client";

import { useState } from "react";
import { ImagePlus, Loader2, Star, Trash2, ZoomIn } from "lucide-react";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import {
  addUnitImages,
  removeUnitImage,
  setUnitPrimaryImage,
  type UnitImages,
  type UnitMediaTable,
} from "@/lib/inventory/unit-media";
import { cn } from "@/lib/utils";

type UnitImage = { path: string; url: string; primary: boolean };

export function unitImageList(images: UnitImages): UnitImage[] {
  const list: UnitImage[] = [];
  if (images.imageUrl) list.push({ path: images.imagePath, url: images.imageUrl, primary: true });
  for (const image of images.galleryImages) {
    list.push({ path: image.path, url: image.url, primary: false });
  }
  return list;
}

/** Estado y acciones de fotos de una serie o lote; cada cambio se guarda al momento. */
export function useUnitImages(
  table: UnitMediaTable,
  id: string,
  initial: UnitImages,
  onChanged: () => void
) {
  const [images, setImages] = useState<UnitImages>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<UnitImages>, fallback: string) {
    try {
      setError("");
      setBusy(true);
      setImages(await action());
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  return {
    images,
    busy,
    error,
    add: (files: File[]) =>
      files.length
        ? run(() => addUnitImages(table, id, files), "No se pudieron subir las imágenes.")
        : Promise.resolve(),
    remove: (path: string) =>
      window.confirm("¿Quitar esta foto?")
        ? run(() => removeUnitImage(table, id, path), "No se pudo quitar la imagen.")
        : Promise.resolve(),
    makePrimary: (path: string) =>
      run(() => setUnitPrimaryImage(table, id, path), "No se pudo cambiar la foto principal."),
  };
}

type UnitPhotoGalleryProps = {
  title: string;
  /** Texto base para el pie de foto en el visor. */
  caption: string;
  images: UnitImages;
  canEdit: boolean;
  busy: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (path: string) => void;
  onMakePrimary: (path: string) => void;
};

export function UnitPhotoGallery({
  title,
  caption,
  images,
  canEdit,
  busy,
  onAdd,
  onRemove,
  onMakePrimary,
}: UnitPhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const list = unitImageList(images);
  const viewerIndex =
    lightboxIndex == null || list.length === 0 ? null : Math.min(lightboxIndex, list.length - 1);

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {title} <span className="font-normal text-muted-foreground">({list.length})</span>
        </p>
        {canEdit ? (
          <label
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted",
              busy && "pointer-events-none opacity-60"
            )}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {busy ? "Guardando…" : "Agregar fotos"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                onAdd(files);
              }}
            />
          </label>
        ) : null}
      </div>

      {list.length === 0 ? (
        <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
          Sin fotos. Puedes subir varias a la vez.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {list.map((image, index) => (
            <div
              key={image.path}
              className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted/30"
            >
              <button
                type="button"
                className="block size-full"
                onClick={() => setLightboxIndex(index)}
                aria-label={`Ampliar foto ${index + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={`${caption} · foto ${index + 1}`}
                  className="size-full object-cover transition group-hover:scale-105"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                  <ZoomIn className="size-6" />
                </span>
              </button>
              {image.primary ? (
                <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                  Principal
                </span>
              ) : null}
              {canEdit ? (
                <div className="absolute right-1.5 top-1.5 flex gap-1 transition sm:opacity-0 sm:group-hover:opacity-100">
                  {!image.primary ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onMakePrimary(image.path)}
                      className="rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 disabled:opacity-50"
                      title="Hacer principal"
                    >
                      <Star className="size-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRemove(image.path)}
                    className="rounded-full bg-red-500/85 p-1.5 text-white hover:bg-red-500 disabled:opacity-50"
                    title="Quitar foto"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {viewerIndex != null ? (
        <ImageLightbox
          images={list.map((image, i) => ({
            src: image.url,
            alt: caption,
            caption: `${caption}${image.primary ? " · Principal" : ` · Foto ${i + 1}`}`,
          }))}
          index={viewerIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          renderActions={
            canEdit
              ? (index) => {
                  const image = list[index];
                  if (!image) return null;
                  return (
                    <>
                      {!image.primary ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            onMakePrimary(image.path);
                            setLightboxIndex(0);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25 disabled:opacity-50"
                        >
                          <Star className="size-3.5" /> Hacer principal
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onRemove(image.path)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-red-500/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" /> Quitar foto
                      </button>
                    </>
                  );
                }
              : undefined
          }
        />
      ) : null}
    </section>
  );
}
