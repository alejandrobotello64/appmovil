import type { ScanResult } from "@/lib/scan/lookup";
import { parseToolQrPayload } from "@/lib/tools/labels";

/** Normaliza códigos leídos (sin espacios extremos, mayúsculas). */
export function normalizeScanToken(value: string) {
  return value.trim().toUpperCase();
}

/** Tokens útiles de una lectura: crudo, código parseado, GTIN, serie GS1, QR de herramienta. */
export function scanTokens(raw: string, result?: ScanResult | null): string[] {
  const tokens = new Set<string>();
  const push = (value: string | null | undefined) => {
    const normalized = normalizeScanToken(value ?? "");
    if (normalized) tokens.add(normalized);
  };
  push(raw);
  push(result?.scan.code);
  push(result?.scan.gs1?.gtin);
  push(result?.scan.gs1?.serial);
  push(result?.scan.gs1?.lot);
  // QR de herramienta: MAS-TOOL:HER-0001 → también busca por HER-0001
  push(parseToolQrPayload(raw));
  push(parseToolQrPayload(result?.scan.code ?? ""));
  return [...tokens];
}

export function matchByScanFields<T>(
  items: T[],
  raw: string,
  fields: (item: T) => Array<string | null | undefined>,
  result?: ScanResult | null
): T | null {
  const tokens = scanTokens(raw, result);
  if (tokens.length === 0) return null;
  return (
    items.find((item) =>
      fields(item).some((field) => {
        const value = normalizeScanToken(field ?? "");
        return value !== "" && tokens.includes(value);
      })
    ) ?? null
  );
}
