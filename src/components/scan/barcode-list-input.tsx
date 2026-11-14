"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ScanBarcode, X } from "lucide-react";
import { normalizeBarcode, parseGs1 } from "@/lib/scan/codes";
import { productsWithBarcode } from "@/lib/scan/lookup";
import { useScanBurstInput, useScanTarget } from "@/lib/scan/use-barcode-scanner";

type BarcodeListInputProps = {
  value: string[];
  onChange: (codes: string[]) => void;
  /** Producto en edición, para no avisar de su propio código. */
  productId?: string;
};

/** Lista de códigos de barras del producto; el lector escribe aquí y Enter agrega. */
export function BarcodeListInput({ value, onChange, productId }: BarcodeListInputProps) {
  const [draft, setDraft] = useState("");
  const [warning, setWarning] = useState("");

  function add(raw: string) {
    const gtin = parseGs1(raw)?.gtin;
    const code = normalizeBarcode(gtin ?? raw);
    setDraft("");
    if (!code) return;
    if (value.some((current) => current.toLowerCase() === code.toLowerCase())) {
      setWarning(`${code} ya está en la lista.`);
      return;
    }
    setWarning("");
    onChange([...value, code]);
    productsWithBarcode(code, productId)
      .then((rows) => {
        if (rows.length) {
          setWarning(
            `Atención: ${code} ya pertenece a ${rows.map((row) => `${row.sku} ${row.name}`).join(", ")}.`
          );
        }
      })
      .catch(() => undefined);
  }

  const inputRef = useRef<HTMLInputElement>(null);
  const handleBurst = useScanBurstInput(add);
  useScanTarget(inputRef, add);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === "Enter" || event.key === "Tab") && draft.trim()) {
      event.preventDefault();
      add(draft);
    }
    handleBurst(event);
  }

  return (
    <div className="space-y-1.5">
      {value.length ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 py-0.5 pr-1 pl-2 font-mono text-xs"
            >
              {code}
              <button
                type="button"
                onClick={() => onChange(value.filter((current) => current !== code))}
                className="inline-flex size-5 items-center justify-center rounded hover:bg-destructive/15 hover:text-destructive"
                aria-label={`Quitar ${code}`}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <ScanBarcode className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          data-scan-target="true"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => draft.trim() && add(draft)}
          placeholder="Escanea la caja o escribe el código y presiona Enter"
          className="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-9 font-mono text-sm outline-none"
        />
      </div>
      {warning ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">{warning}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          EAN/UPC/GS1 de la caja del fabricante. Un producto puede tener varios.
        </p>
      )}
    </div>
  );
}
