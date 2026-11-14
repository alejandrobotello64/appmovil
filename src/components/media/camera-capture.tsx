"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Check, RefreshCcw, SwitchCamera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { useCamera } from "@/lib/media/use-camera";
import { cn } from "@/lib/utils";

type CameraCaptureDialogProps = {
  title?: string;
  /** Permite tomar varias fotos antes de confirmar. */
  multiple?: boolean;
  onCapture: (files: File[]) => void;
  onClose: () => void;
};

export function CameraCaptureDialog({
  title = "Tomar foto",
  multiple = false,
  onCapture,
  onClose,
}: CameraCaptureDialogProps) {
  const { videoRef, devices, ready, error, switchCamera, capture } = useCamera(true);
  const [shots, setShots] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const previews = useMemo(() => shots.map((file) => URL.createObjectURL(file)), [shots]);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const reviewing = !multiple && shots.length === 1;

  async function takeShot() {
    setBusy(true);
    try {
      const file = await capture();
      if (file) setShots((current) => (multiple ? [...current, file] : [file]));
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!shots.length) return;
    onCapture(shots);
    onClose();
  }

  return (
    <ModalShell
      title={title}
      description={
        multiple
          ? "Toma las fotos que necesites y confirma para agregarlas."
          : "Encuadra y presiona Capturar."
      }
      className="max-w-4xl"
      headerAction={
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
          <X />
        </Button>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={switchCamera}
            disabled={devices.length < 2 || reviewing}
            className="touch-target h-11"
          >
            <SwitchCamera className="mr-1.5 size-4" />
            Cambiar cámara
          </Button>
          <div className="flex flex-wrap gap-2">
            {reviewing ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShots([])}
                className="touch-target h-11"
              >
                <RefreshCcw className="mr-1.5 size-4" />
                Repetir
              </Button>
            ) : (
              <Button
                type="button"
                variant={shots.length ? "outline" : "default"}
                onClick={() => void takeShot()}
                disabled={!ready || busy}
                className="touch-target h-11 px-4"
              >
                <Camera className="mr-1.5 size-4" />
                Capturar
              </Button>
            )}
            <Button
              type="button"
              onClick={confirm}
              disabled={!shots.length}
              className="touch-target h-11 px-4"
            >
              <Check className="mr-1.5 size-4" />
              {multiple && shots.length > 1 ? `Usar ${shots.length} fotos` : "Usar foto"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className={cn("aspect-video w-full object-contain", reviewing && "hidden")}
          />
          {reviewing ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previews[0]} alt="Foto capturada" className="aspect-video w-full object-contain" />
          ) : null}
          {!ready && !error ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
              Abriendo cámara…
            </div>
          ) : null}
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">
              {error}
            </div>
          ) : null}
        </div>

        {multiple && shots.length ? (
          <div className="flex flex-wrap gap-2">
            {previews.map((url, index) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Foto ${index + 1}`}
                  className="size-20 rounded-lg border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => setShots((current) => current.filter((_, i) => i !== index))}
                  className="absolute -top-2 -right-2 inline-flex size-7 items-center justify-center rounded-full bg-destructive text-white shadow"
                  aria-label={`Quitar foto ${index + 1}`}
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}

type CameraButtonProps = {
  onCapture: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  label?: string;
  title?: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "xs" | "icon" | "icon-sm";
};

/** Botón "Tomar foto" que abre la cámara y entrega las fotos como archivos. */
export function CameraButton({
  onCapture,
  multiple = false,
  disabled,
  label = "Tomar foto",
  title,
  className,
  variant = "outline",
  size = "sm",
}: CameraButtonProps) {
  const [open, setOpen] = useState(false);
  const iconOnly = size === "icon" || size === "icon-sm";
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={className}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
      >
        <Camera className={iconOnly ? "size-4" : "mr-1.5 size-4"} />
        {iconOnly ? null : label}
      </Button>
      {open ? (
        <CameraCaptureDialog
          title={title ?? label}
          multiple={multiple}
          onCapture={onCapture}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
