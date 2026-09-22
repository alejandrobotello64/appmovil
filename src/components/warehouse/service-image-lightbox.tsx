"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { IMAGE_STAGES, type ServiceOrderImage } from "@/lib/service-orders/types";

type ServiceImageLightboxProps = {
  images: ServiceOrderImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

export function ServiceImageLightbox({
  images,
  index,
  onClose,
  onIndexChange,
}: ServiceImageLightboxProps) {
  const image = images[index];

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") {
        onIndexChange((index - 1 + images.length) % images.length);
      }
      if (event.key === "ArrowRight") {
        onIndexChange((index + 1) % images.length);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [images.length, index, onClose, onIndexChange]);

  if (!image || typeof document === "undefined") return null;

  const stage =
    IMAGE_STAGES.find((item) => item.id === image.stage)?.label ?? image.stage;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-3 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Vista de foto de servicio"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-3 top-3 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
        onClick={onClose}
        aria-label="Cerrar"
      >
        <X className="size-5" />
      </button>
      {images.length > 1 ? (
        <>
          <button
            type="button"
            className="absolute left-2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25 sm:left-4"
            onClick={(event) => {
              event.stopPropagation();
              onIndexChange((index - 1 + images.length) % images.length);
            }}
            aria-label="Foto anterior"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            className="absolute right-12 rounded-full bg-white/15 p-2 text-white hover:bg-white/25 sm:right-16"
            onClick={(event) => {
              event.stopPropagation();
              onIndexChange((index + 1) % images.length);
            }}
            aria-label="Foto siguiente"
          >
            <ChevronRight className="size-6" />
          </button>
        </>
      ) : null}
      <figure
        className="flex max-h-full max-w-full flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.fileUrl}
          alt={image.caption || stage}
          className="max-h-[min(82vh,920px)] max-w-[min(96vw,1200px)] rounded-lg object-contain shadow-2xl"
        />
        <figcaption className="max-w-[min(96vw,720px)] text-center text-sm text-white/90">
          {stage}
          {image.caption ? ` · ${image.caption}` : ""}
          {images.length > 1 ? ` · ${index + 1} de ${images.length}` : ""}
        </figcaption>
      </figure>
    </div>,
    document.body
  );
}
