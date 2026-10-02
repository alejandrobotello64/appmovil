"use client";

import { useState } from "react";
import { FileDown, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MovementRecord } from "@/lib/warehouse/movements";
import type { PdfOutput } from "@/lib/warehouse/movements-pdf";
import type { Warehouse } from "@/lib/warehouse/stock";

type Props = {
  /** Registros del vale; puede consultarlos al momento (p. ej. por folio recién creado). */
  records: MovementRecord[] | (() => Promise<MovementRecord[]>);
  warehouses: Warehouse[];
  variant?: "icon" | "button";
  onError?: (message: string) => void;
};

export function MovementVoucherActions({ records, warehouses, variant = "icon", onError }: Props) {
  const [busy, setBusy] = useState<PdfOutput | null>(null);

  async function run(output: PdfOutput) {
    setBusy(output);
    try {
      const [{ downloadMovementVoucherPdf }, list] = await Promise.all([
        import("@/lib/warehouse/movements-pdf"),
        typeof records === "function" ? records() : Promise.resolve(records),
      ]);
      await downloadMovementVoucherPdf(list, { warehouses, output });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo generar el PDF.";
      if (onError) onError(message);
      else window.alert(message);
    } finally {
      setBusy(null);
    }
  }

  if (variant === "button") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => run("print")}>
          {busy === "print" ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
          Imprimir vale
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => run("download")}>
          {busy === "download" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
          Descargar PDF
        </Button>
      </div>
    );
  }

  const iconClass =
    "inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50";
  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        title="Imprimir vale"
        aria-label="Imprimir vale"
        disabled={busy !== null}
        onClick={() => run("print")}
        className={iconClass}
      >
        {busy === "print" ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
      </button>
      <button
        type="button"
        title="Descargar vale en PDF"
        aria-label="Descargar vale en PDF"
        disabled={busy !== null}
        onClick={() => run("download")}
        className={iconClass}
      >
        {busy === "download" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
      </button>
    </span>
  );
}
