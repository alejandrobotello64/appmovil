"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  downloadProductTemplate,
  exportProductsToExcel,
  parseProductWorkbook,
  type ProductExcelRow,
} from "@/lib/inventory/excel";
import { bulkImportInventoryItems } from "@/lib/inventory/storage";
import { getSession } from "@/lib/auth";
import type { InventoryItem, ItemKind } from "@/lib/inventory/types";

type InventoryExcelActionsProps = {
  items: InventoryItem[];
  canWrite: boolean;
  defaultKind: ItemKind;
  onImported: () => Promise<void>;
  onError: (message: string) => void;
};

export function InventoryExcelActions({
  items,
  canWrite,
  defaultKind,
  onImported,
  onError,
}: InventoryExcelActionsProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ProductExcelRow[]>([]);
  const [parseErrors, setParseErrors] = useState<
    Array<{ row: number; sku: string; message: string }>
  >([]);
  const [result, setResult] = useState("");

  function handleExport() {
    try {
      exportProductsToExcel(items);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "No se pudo exportar el Excel."
      );
    }
  }

  async function handleFile(file: File) {
    setBusy(true);
    setResult("");
    setFileName(file.name);
    try {
      const parsed = await parseProductWorkbook(file, defaultKind);
      setPreview(parsed.rows);
      setParseErrors(parsed.errors);
      setOpen(true);
      if (parsed.rows.length === 0 && parsed.errors.length === 0) {
        onError("El archivo no tiene productos para importar.");
      }
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "No se pudo leer el archivo de Excel."
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleImport() {
    if (preview.length === 0) return;
    setBusy(true);
    setResult("");
    try {
      const session = getSession();
      const outcome = await bulkImportInventoryItems(
        preview,
        session?.username ?? "sistema"
      );
      const parts = [
        outcome.created ? `${outcome.created} nuevos` : "",
        outcome.updated ? `${outcome.updated} actualizados` : "",
      ].filter(Boolean);
      const extra =
        outcome.errors.length > 0
          ? ` · ${outcome.errors.length} con error`
          : "";
      setResult(
        parts.length > 0
          ? `Listo: ${parts.join(", ")}${extra}.`
          : `No se importó ningún producto${extra}.`
      );
      if (outcome.errors.length > 0) {
        setParseErrors(
          outcome.errors.map((item) => ({
            row: 0,
            sku: item.sku,
            message: item.message,
          }))
        );
      }
      await onImported();
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "No se pudo importar el catálogo."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <Button type="button" variant="outline" className="h-10" onClick={handleExport}>
        <Download className="size-4" />
        Exportar Excel
      </Button>

      {canWrite ? (
        <Button
          type="button"
          variant="outline"
          className="h-10"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" />
          {busy ? "Leyendo..." : "Importar Excel"}
        </Button>
      ) : null}

      {open ? (
        <ModalShell
          title="Importar catálogo Excel"
          description="Los sku nuevos se dan de alta. Los sku que ya existen se actualizan sin cambiar la existencia."
          className="max-w-3xl"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Archivo: <span className="font-medium text-foreground">{fileName}</span>
              {" · "}
              {preview.length} fila{preview.length === 1 ? "" : "s"} lista
              {preview.length === 1 ? "" : "s"} para importar.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadProductTemplate}
              >
                <FileSpreadsheet className="size-4" />
                Descargar plantilla
              </Button>
            </div>

            {preview.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">SKU</th>
                      <th className="px-3 py-2 font-medium">Nombre</th>
                      <th className="px-3 py-2 font-medium">Categoría</th>
                      <th className="px-3 py-2 font-medium">Existencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 8).map((row) => (
                      <tr key={`${row.sku}-${row.rowNumber}`} className="border-t border-border/70">
                        <td className="px-3 py-2 font-mono text-xs">{row.sku}</td>
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="px-3 py-2">{row.category}</td>
                        <td className="px-3 py-2">{row.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 8 ? (
                  <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                    Y {preview.length - 8} más...
                  </p>
                ) : null}
              </div>
            ) : null}

            {parseErrors.length > 0 ? (
              <ul className="space-y-1 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {parseErrors.slice(0, 8).map((item, index) => (
                  <li key={`${item.sku}-${item.row}-${index}`}>
                    {item.row ? `Fila ${item.row}` : item.sku || "Error"}: {item.message}
                  </li>
                ))}
              </ul>
            ) : null}

            {result ? (
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                {result}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setPreview([]);
                  setParseErrors([]);
                  setResult("");
                }}
              >
                Cerrar
              </Button>
              <Button
                type="button"
                disabled={busy || preview.length === 0}
                onClick={() => void handleImport()}
                className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
              >
                {busy ? "Importando..." : `Importar ${preview.length}`}
              </Button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}
