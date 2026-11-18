"use client";

import { Search, X } from "lucide-react";
import { ScanCameraButton } from "@/components/scan/scan-camera-button";
import { cn } from "@/lib/utils";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  /** `true` | `focus` | `off` — controla si el lector escribe aquí (ver scanSearchMode). */
  scanSearch?: "true" | "focus" | "off";
  /** Mostrar botón de cámara (por defecto sí si hay scanSearch activo). */
  cameraScan?: boolean;
};

export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  className,
  ariaLabel,
  scanSearch,
  cameraScan,
}: SearchInputProps) {
  const showCamera = cameraScan ?? (scanSearch === "true" || scanSearch === "focus");

  return (
    <div className={cn("relative w-full", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        data-scan-search={scanSearch}
        className={cn(
          "h-10 w-full rounded-lg border border-input bg-background pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-search-cancel-button]:hidden",
          showCamera && value ? "pr-20" : showCamera || value ? "pr-11" : "pr-3"
        )}
      />
      <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5">
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Limpiar búsqueda"
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
        {showCamera ? (
          <ScanCameraButton className="static top-auto right-auto size-8 translate-y-0" />
        ) : null}
      </div>
    </div>
  );
}
