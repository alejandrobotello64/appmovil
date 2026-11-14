import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { catalogModelLabel } from "@/lib/inventory/product-label";
import type { InventoryItem } from "@/lib/inventory/types";
import { deliverPdf } from "@/lib/print/open-pdf";

export type LabelFormat = "thermal" | "sheet";

export const LABEL_FORMATS: { id: LabelFormat; label: string }[] = [
  { id: "thermal", label: "Etiqueta térmica 50 × 30 mm" },
  { id: "sheet", label: "Hoja carta (3 × 8 etiquetas)" },
];

type LabelItem = Pick<InventoryItem, "sku" | "name" | "brand" | "model" | "unit">;

/** El QR lleva solo el SKU: lo lee cualquier lector sin depender del teclado. */
async function qrFor(sku: string) {
  return QRCode.toDataURL(sku, { margin: 0, errorCorrectionLevel: "M", width: 320 });
}

function drawLabel(
  doc: jsPDF,
  item: LabelItem,
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
  doc.setFontSize(9);
  doc.text(item.sku, textX, cursor, { maxWidth: textW });
  cursor += 3.6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.6);
  const name = (doc.splitTextToSize(item.name, textW) as string[]).slice(0, 3);
  doc.text(name, textX, cursor);
  cursor += name.length * 2.7 + 0.6;

  const detail = [item.brand, catalogModelLabel(item.model ?? "")].filter(Boolean).join(" · ");
  if (detail && cursor < y + h - pad) {
    doc.setFontSize(5.8);
    doc.setTextColor(90);
    const lines = (doc.splitTextToSize(detail, textW) as string[]).slice(0, 2);
    doc.text(lines, textX, cursor);
    doc.setTextColor(0);
  }
}

export async function printProductLabels(
  items: LabelItem[],
  options: { format?: LabelFormat; copies?: number } = {}
) {
  const format = options.format ?? "thermal";
  const copies = Math.max(1, Math.min(200, Math.round(options.copies ?? 1)));
  const queue = items.flatMap((item) => Array.from({ length: copies }, () => item));
  if (!queue.length) return;
  const qrs = new Map<string, string>();
  for (const item of items) {
    if (!qrs.has(item.sku)) qrs.set(item.sku, await qrFor(item.sku));
  }

  let doc: jsPDF;
  if (format === "thermal") {
    const w = 50;
    const h = 30;
    doc = new jsPDF({ unit: "mm", format: [w, h], orientation: "landscape" });
    queue.forEach((item, index) => {
      if (index) doc.addPage([w, h], "landscape");
      drawLabel(doc, item, qrs.get(item.sku)!, 0, 0, w, h);
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
      drawLabel(doc, item, qrs.get(item.sku)!, x + 1, y + 1, w - 2, h - 2);
    });
  }

  const name = items.length === 1 ? `Etiqueta-${items[0].sku}` : "Etiquetas-productos";
  await deliverPdf(doc, `${name}.pdf`, "print");
}
