import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { deliverPdf } from "@/lib/print/open-pdf";
import { LABEL_FORMATS, type LabelFormat } from "@/lib/scan/label";
import { toolCategoryLabel, type Tool } from "@/lib/tools/types";

export { LABEL_FORMATS, type LabelFormat };

/** Prefijo del QR de herramientas: al escanear se identifica sin confundir con inventario. */
export const TOOL_QR_PREFIX = "MAS-TOOL:";

export type ToolLabelItem = Pick<
  Tool,
  "code" | "name" | "brand" | "model" | "serialNumber" | "location" | "category"
>;

/** Contenido que lleva el QR (código de herramienta). */
export function toolQrPayload(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return "";
  return `${TOOL_QR_PREFIX}${normalized}`;
}

/**
 * Si la lectura es un QR de herramienta (`MAS-TOOL:HER-0001`),
 * devuelve el código; si no, null.
 */
export function parseToolQrPayload(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper.startsWith(TOOL_QR_PREFIX)) {
    const code = upper.slice(TOOL_QR_PREFIX.length).trim();
    return code || null;
  }
  // Algunos lectores añaden URL o espacios raros alrededor del prefijo.
  const match = upper.match(/MAS-TOOL:([A-Z0-9._\-/]+)/);
  return match?.[1] ?? null;
}

async function qrFor(code: string) {
  const payload = toolQrPayload(code);
  return QRCode.toDataURL(payload, {
    margin: 0,
    errorCorrectionLevel: "M",
    width: 320,
  });
}

/** Vista previa del QR (data URL) para mostrar en pantalla. */
export async function toolQrDataUrl(code: string) {
  return qrFor(code);
}

function drawToolLabel(
  doc: jsPDF,
  item: ToolLabelItem,
  qr: string,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const pad = 2;
  const qrSize = Math.min(h - pad * 2, w * 0.42);
  doc.addImage(qr, "PNG", x + pad, y + (h - qrSize) / 2, qrSize, qrSize);

  const textX = x + pad * 2 + qrSize;
  const textW = w - (textX - x) - pad;
  let cursor = y + pad + 3;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(item.code, textX, cursor, { maxWidth: textW });
  cursor += 3.4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  const name = (doc.splitTextToSize(item.name, textW) as string[]).slice(0, 2);
  doc.text(name, textX, cursor);
  cursor += name.length * 2.6 + 0.4;

  doc.setFontSize(5.6);
  doc.setTextColor(90);
  const category = toolCategoryLabel(item.category);
  if (category && cursor < y + h - pad) {
    doc.text(category, textX, cursor, { maxWidth: textW });
    cursor += 2.4;
  }
  const detail = [item.brand, item.model].filter(Boolean).join(" · ");
  if (detail && cursor < y + h - pad) {
    const lines = (doc.splitTextToSize(detail, textW) as string[]).slice(0, 2);
    doc.text(lines, textX, cursor);
    cursor += lines.length * 2.3;
  }
  if (item.serialNumber && cursor < y + h - pad) {
    doc.text(`S/N ${item.serialNumber}`, textX, cursor, { maxWidth: textW });
    cursor += 2.3;
  }
  if (item.location && cursor < y + h - pad) {
    doc.text(item.location, textX, cursor, { maxWidth: textW });
  }
  doc.setTextColor(0);
}

export async function printToolLabels(
  items: ToolLabelItem[],
  options: { format?: LabelFormat; copies?: number } = {}
) {
  const format = options.format ?? "thermal";
  const copies = Math.max(1, Math.min(200, Math.round(options.copies ?? 1)));
  const queue = items.flatMap((item) => Array.from({ length: copies }, () => item));
  if (!queue.length) return;

  const qrs = new Map<string, string>();
  for (const item of items) {
    const code = item.code.trim().toUpperCase();
    if (!code || qrs.has(code)) continue;
    qrs.set(code, await qrFor(code));
  }

  let doc: jsPDF;
  if (format === "thermal") {
    const w = 50;
    const h = 30;
    doc = new jsPDF({ unit: "mm", format: [w, h], orientation: "landscape" });
    queue.forEach((item, index) => {
      if (index) doc.addPage([w, h], "landscape");
      const code = item.code.trim().toUpperCase();
      drawToolLabel(doc, item, qrs.get(code)!, 0, 0, w, h);
    });
  } else {
    doc = new jsPDF({ unit: "mm", format: "letter" });
    const cols = 3;
    const rows = 8;
    const marginX = 6;
    const marginY = 12;
    const w = (215.9 - marginX * 2) / cols;
    const h = (279.4 - marginY * 2) / rows;
    queue.forEach((item, index) => {
      const slot = index % (cols * rows);
      if (index && slot === 0) doc.addPage("letter");
      const x = marginX + (slot % cols) * w;
      const y = marginY + Math.floor(slot / cols) * h;
      doc.setDrawColor(220);
      doc.setLineDashPattern([0.8, 0.8], 0);
      doc.rect(x, y, w, h);
      doc.setLineDashPattern([], 0);
      const code = item.code.trim().toUpperCase();
      drawToolLabel(doc, item, qrs.get(code)!, x + 1, y + 1, w - 2, h - 2);
    });
  }

  const name =
    items.length === 1 ? `Etiqueta-herramienta-${items[0].code}` : "Etiquetas-herramientas";
  await deliverPdf(doc, `${name}.pdf`, "print");
}
