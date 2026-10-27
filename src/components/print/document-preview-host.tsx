"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  canPrintPreview,
  closeDocumentPreview,
  downloadDocumentPreview,
  openDocumentPreview,
  previewKind,
  printDocumentPreview,
  subscribeDocumentPreview,
  type DocumentPreview,
} from "@/lib/print/document-preview";

export function DocumentPreviewHost() {
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [mounted, setMounted] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"print" | "download" | null>(null);
  const [frameReady, setFrameReady] = useState(false);

  useEffect(() => {
    setMounted(true);
    return subscribeDocumentPreview((next) => {
      setPreview(next);
      setNotice("");
      setBusy(null);
    });
  }, []);

  useEffect(() => {
    if (!preview) return;
    setFrameReady(previewKind(preview.mime, preview.fileName) !== "pdf");
    const timer = window.setTimeout(() => setFrameReady(true), 2500);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeDocumentPreview();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [preview]);

  if (!mounted || !preview) return null;

  const kind = previewKind(preview.mime, preview.fileName);
  const printable = canPrintPreview(preview.mime, preview.fileName);

  async function onPrint() {
    if (!preview) return;
    const current = preview;
    setBusy("print");
    setNotice("");
    const frame = document.getElementById(
      "mas-document-preview-frame"
    ) as HTMLIFrameElement | null;
    const result = await printDocumentPreview(current, frame);
    setBusy(null);
    if (!result.ok && result.reason === "retry") {
      const url = URL.createObjectURL(result.blob);
      openDocumentPreview({
        title: current.title,
        fileName: current.fileName,
        url,
        mime: result.blob.type || current.mime,
        revoke: true,
        blob: result.blob,
      });
      setNotice("El archivo ya está listo. Toca Imprimir otra vez.");
      return;
    }
    if (result.ok && result.via === "share") {
      setNotice("En el menú del teléfono, elige Imprimir.");
      return;
    }
    if (!result.ok && result.reason === "cancelled") return;
    if (!result.ok && result.reason === "too-large") {
      setNotice(
        "Este archivo es muy grande para imprimirlo aquí. Descárgalo y ábrelo con el visor del teléfono."
      );
      return;
    }
    if (!result.ok) {
      setNotice(
        "No se pudo abrir la impresión. Descarga el archivo y usa el visor del teléfono."
      );
    }
  }

  async function onDownload() {
    if (!preview) return;
    const current = preview;
    setBusy("download");
    setNotice("");
    try {
      await downloadDocumentPreview(current);
    } finally {
      setBusy(null);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label={`Vista previa de ${preview.title}`}
    >
      <header className="safe-top flex items-center gap-2 border-b border-border px-3 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">{preview.title}</h2>
          <p className="truncate text-xs text-muted-foreground">{preview.fileName}</p>
        </div>
        <button
          type="button"
          className="touch-target inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          onClick={() => closeDocumentPreview()}
          aria-label="Cerrar vista previa"
        >
          <X className="size-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 bg-muted/40">
        {kind === "pdf" || kind === "text" ? (
          <iframe
            id="mas-document-preview-frame"
            title={preview.title}
            src={preview.url}
            className="h-full w-full border-0 bg-white"
            onLoad={() => setFrameReady(true)}
          />
        ) : null}
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.url}
            alt={preview.title}
            className="mx-auto h-full max-h-full w-full object-contain"
          />
        ) : null}
        {kind === "video" ? (
          <video
            src={preview.url}
            controls
            className="mx-auto h-full max-h-full w-full bg-black"
          />
        ) : null}
        {kind === "other" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium">
              Este formato no se puede previsualizar en el celular.
            </p>
            <p className="text-sm text-muted-foreground">
              Descárgalo para abrirlo con otra aplicación.
            </p>
          </div>
        ) : null}
      </div>

      {notice ? (
        <p className="border-t border-border px-4 py-2 text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      ) : null}

      <footer className="safe-bottom flex gap-2 border-t border-border px-3 pt-3">
        {printable ? (
          <Button
            type="button"
            className="h-11 flex-1"
            disabled={busy !== null || !frameReady}
            onClick={() => void onPrint()}
          >
            {busy === "print" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Printer className="size-4" />
            )}
            Imprimir
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          disabled={busy !== null}
          onClick={() => void onDownload()}
        >
          {busy === "download" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Descargar
        </Button>
      </footer>
    </div>,
    document.body
  );
}
