import type { jsPDF } from "jspdf";
import { openDocumentPreview } from "@/lib/print/document-preview";

export type PdfIntent = "print" | "download";

/** App instalada o teléfono: window.open de un blob se bloquea y autoPrint no corre. */
export function isMobilePdfClient() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(pointer: coarse)").matches ||
    /iPhone|iPad|iPod|Android/i.test(nav.userAgent)
  );
}

function triggerAnchor(url: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.target = "_blank";
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * Entrega un PDF generado. En escritorio abre el cuadro de impresión.
 * En celular muestra la vista previa y desde ahí se imprime.
 */
export async function deliverPdf(
  doc: jsPDF,
  fileName: string,
  intent: PdfIntent = "print"
) {
  const mobile = isMobilePdfClient();
  if (intent === "print" && !mobile) {
    doc.autoPrint();
  }
  const blob = doc.output("blob") as Blob;
  const file = new File([blob], fileName, { type: "application/pdf" });

  if (mobile) {
    const url = URL.createObjectURL(blob);
    openDocumentPreview({
      title: fileName.replace(/\.pdf$/i, ""),
      fileName,
      url,
      mime: "application/pdf",
      revoke: true,
      blob: file,
    });
    return;
  }

  if (intent === "print") {
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) {
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }
    URL.revokeObjectURL(url);
  }

  const url = URL.createObjectURL(blob);
  triggerAnchor(url, fileName);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** En celular abre la vista previa del archivo y cancela la navegación del enlace. */
export function openStoredFileOnMobile(
  event: { preventDefault(): void },
  file: { url: string; title: string; fileName?: string; mime?: string }
) {
  if (!file.url || !isMobilePdfClient()) return false;
  event.preventDefault();
  openDocumentPreview({
    title: file.title,
    fileName: file.fileName || file.title,
    url: file.url,
    mime: file.mime,
  });
  return true;
}
