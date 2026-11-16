"use client";

import { useEffect } from "react";
import {
  SCAN_RESOLVED_EVENT,
  type ScanResolvedDetail,
} from "@/lib/scan/search-fields";
import type { ScanMatch, ScanResult } from "@/lib/scan/lookup";

export type ScanResolvedHandler = (detail: {
  raw: string;
  result: ScanResult;
  match: ScanMatch | null;
  input: HTMLInputElement | null;
}) => void;

/**
 * Escucha lecturas ya resueltas (producto + GS1) en toda la app.
 * Úsalo en paneles de Almacén para auto-seleccionar artículos.
 */
export function useScanResolved(
  onResolved: ScanResolvedHandler,
  options: { enabled?: boolean } = {}
) {
  const enabled = options.enabled ?? true;
  useEffect(() => {
    if (!enabled) return;
    function handle(event: Event) {
      const detail = (event as CustomEvent<ScanResolvedDetail>).detail;
      if (!detail?.result) return;
      onResolved({
        raw: detail.raw,
        result: detail.result,
        match: detail.result.matches[0] ?? null,
        input: detail.input,
      });
    }
    window.addEventListener(SCAN_RESOLVED_EVENT, handle);
    return () => window.removeEventListener(SCAN_RESOLVED_EVENT, handle);
  }, [enabled, onResolved]);
}
