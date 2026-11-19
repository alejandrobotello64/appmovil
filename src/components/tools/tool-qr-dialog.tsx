"use client";
import { Ui } from "@/components/ui/ui-text";

import { useEffect, useState } from "react";
import { Printer, QrCode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  LABEL_FORMATS,
  printToolLabels,
  toolQrDataUrl,
  toolQrPayload,
  type LabelFormat,
  type ToolLabelItem,
} from "@/lib/tools/labels";
import { toolCategoryLabel } from "@/lib/tools/types";
import { cn } from "@/lib/utils";
import { fieldClass, Notice, primaryButtonClass } from "./tools-shared";

type ToolQrDialogProps = {
  tool: ToolLabelItem;
  onClose: () => void;
  /** Si viene de un alta nueva, resalta el siguiente paso. */
  freshlyCreated?: boolean;
};

export function ToolQrDialog({ tool, onClose, freshlyCreated }: ToolQrDialogProps) {
  const [preview, setPreview] = useState("");
  const [format, setFormat] = useState<LabelFormat>("thermal");
  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const payload = toolQrPayload(tool.code);

  useEffect(() => {
    let active = true;
    setPreview("");
    void toolQrDataUrl(tool.code)
      .then((url) => {
        if (active) setPreview(url);
      })
      .catch(() => {
        if (active) setError("No se pudo generar la vista previa del QR.");
      });
    return () => {
      active = false;
    };
  }, [tool.code]);

  async function print() {
    setPrinting(true);
    setError("");
    try {
      await printToolLabels([tool], { format, copies });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo imprimir la etiqueta.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <ModalShell
      title={`QR · ${tool.code}`}
      description={
        freshlyCreated
          ? "Herramienta registrada. Imprime la etiqueta y pégala para escanearla en solicitudes y el catálogo."
          : "Imprime o descarga la etiqueta QR para registrar y rastrear esta herramienta."
      }
      className="max-w-lg"
      headerAction={
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
          <X className="size-4" />
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-start">
          <div className="flex size-40 shrink-0 items-center justify-center rounded-xl border border-border bg-white p-2">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt={`QR ${tool.code}`} className="size-full object-contain" />
            ) : (
              <QrCode className="size-10 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1 text-center sm:text-left">
            <p className="text-sm font-semibold text-foreground">{tool.name}</p>
            <p className="font-mono text-xs text-[#00BFFF]">{tool.code}</p>
            <p className="text-xs text-muted-foreground">
              {toolCategoryLabel(tool.category)}
              {[tool.brand, tool.model].filter(Boolean).length
                ? ` · ${[tool.brand, tool.model].filter(Boolean).join(" · ")}`
                : ""}
            </p>
            {tool.serialNumber ? (
              <p className="text-xs text-muted-foreground">S/N {tool.serialNumber}</p>
            ) : null}
            {tool.location ? (
              <p className="text-xs text-muted-foreground">Ubicación: {tool.location}</p>
            ) : null}
            <p className="pt-1 text-[11px] break-all text-muted-foreground">
              Contenido del QR: <span className="font-mono text-foreground">{payload}</span>
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Formato</span>
            <select
              className={fieldClass}
              value={format}
              onChange={(e) => setFormat(e.target.value as LabelFormat)}
            >
              {LABEL_FORMATS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Copias</span>
            <input
              type="number"
              min={1}
              max={50}
              className={fieldClass}
              value={copies}
              onChange={(e) =>
                setCopies(Math.min(50, Math.max(1, Math.round(Number(e.target.value) || 1))))
              }
            />
          </label>
        </div>

        <Notice tone="error">{error}</Notice>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="h-10 px-3" onClick={onClose}><Ui>Cerrar</Ui></Button>
          <Button
            type="button"
            disabled={printing || !tool.code}
            onClick={() => void print()}
            className={cn("h-10 px-4", primaryButtonClass)}
          >
            <Printer className="size-4" />
            {printing ? "Generando…" : "Imprimir etiqueta"}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
