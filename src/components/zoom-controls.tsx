"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import { useZoom } from "@/components/zoom-provider";
import { cn } from "@/lib/utils";

type ZoomControlsProps = {
  className?: string;
  /** En el celular el % se oculta para no apretar el encabezado. */
  showPercent?: "always" | "desktop";
};

export function ZoomControls({
  className,
  showPercent = "desktop",
}: ZoomControlsProps) {
  const { percent, canZoomIn, canZoomOut, zoomIn, zoomOut, resetZoom } =
    useZoom();

  return (
    <div
      className={cn(
        "inline-flex h-11 items-center overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-sm",
        className
      )}
      role="group"
      aria-label="Zoom de la app"
    >
      <button
        type="button"
        onClick={zoomOut}
        disabled={!canZoomOut}
        className="touch-target inline-flex size-11 items-center justify-center hover:bg-muted disabled:opacity-40"
        aria-label="Alejar"
        title="Alejar"
      >
        <ZoomOut className="size-4" />
      </button>
      <button
        type="button"
        onClick={resetZoom}
        className={cn(
          "min-w-[2.75rem] px-1 text-center text-[11px] font-medium tabular-nums text-muted-foreground hover:bg-muted hover:text-foreground",
          showPercent === "desktop"
            ? "hidden sm:inline-flex sm:items-center sm:justify-center"
            : "inline-flex items-center justify-center"
        )}
        aria-label="Restablecer zoom al 100%"
        title="Restablecer al 100%"
      >
        {percent}%
      </button>
      <button
        type="button"
        onClick={zoomIn}
        disabled={!canZoomIn}
        className="touch-target inline-flex size-11 items-center justify-center hover:bg-muted disabled:opacity-40"
        aria-label="Acercar"
        title="Acercar"
      >
        <ZoomIn className="size-4" />
      </button>
    </div>
  );
}
