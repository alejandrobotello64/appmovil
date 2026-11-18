"use client";

import { Camera } from "lucide-react";
import { useScanner } from "@/components/scan/scan-provider";
import { cn } from "@/lib/utils";

type ScanCameraButtonProps = {
  className?: string;
  /** Tamaño táctil compacto junto a un buscador. */
  size?: "input" | "icon" | "fab";
  title?: string;
  disabled?: boolean;
};

/** Abre el escáner con la cámara del celular (útil en módulos con buscador/HID). */
export function ScanCameraButton({
  className,
  size = "input",
  title = "Escanear con la cámara",
  disabled,
}: ScanCameraButtonProps) {
  const scanner = useScanner();
  if (!scanner?.allowed) return null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => scanner.openScanner({ camera: true })}
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
        size === "input" && "touch-target absolute top-1/2 right-2 z-10 size-8 -translate-y-1/2 rounded-md",
        size === "icon" && "touch-target size-11 rounded-xl",
        size === "fab" &&
          "touch-target size-14 rounded-full border-[#00BFFF]/40 bg-[#00BFFF] text-white shadow-lg hover:bg-[#00a6dd]",
        className
      )}
    >
      <Camera className={size === "fab" ? "size-6" : "size-4"} />
    </button>
  );
}
