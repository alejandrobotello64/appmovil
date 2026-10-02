import type { jsPDF } from "jspdf";

export type Rgb = [number, number, number];

export const PDF_MARGIN = 14;
export const PDF_BLUE: Rgb = [59, 70, 165];
export const PDF_CYAN: Rgb = [0, 150, 210];
export const PDF_INK: Rgb = [30, 30, 30];
export const PDF_MUTED: Rgb = [110, 110, 110];
export const PDF_DANGER: Rgb = [200, 60, 40];
export const PDF_SUCCESS: Rgb = [20, 130, 80];

export function formatPdfDate(value: string, withTime = false) {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function formatPdfQty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

/** Lleva la Y actual y agrega página cuando el siguiente bloque no cabe sobre el pie. */
export class PdfCursor {
  y: number;
  constructor(
    readonly doc: jsPDF,
    start: number
  ) {
    this.y = start;
  }
  get pageW() {
    return this.doc.internal.pageSize.getWidth();
  }
  get pageH() {
    return this.doc.internal.pageSize.getHeight();
  }
  get contentW() {
    return this.pageW - PDF_MARGIN * 2;
  }
  ensure(height: number) {
    if (this.y + height > this.pageH - 16) {
      this.doc.addPage();
      this.y = 16;
      return true;
    }
    return false;
  }
  sectionTitle(text: string) {
    this.ensure(12);
    const { doc } = this;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...PDF_BLUE);
    doc.text(text.toUpperCase(), PDF_MARGIN, this.y);
    doc.setDrawColor(210, 216, 236);
    doc.line(PDF_MARGIN, this.y + 1.6, this.pageW - PDF_MARGIN, this.y + 1.6);
    this.y += 6.5;
  }
}

/** Etiqueta pequeña + valor en negritas; devuelve la altura usada. */
export function drawField(doc: jsPDF, label: string, value: string, x: number, y: number, width: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_MUTED);
  doc.text(label, x, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_INK);
  const lines = doc.splitTextToSize(value || "—", width) as string[];
  doc.text(lines, x, y + 4.2);
  return 4.2 + lines.length * 4;
}

/** Fila de campos repartidos en columnas iguales; avanza el cursor. */
export function drawFieldRow(cursor: PdfCursor, fields: [string, string][], gapAfter = 3) {
  if (!fields.length) return;
  const colW = cursor.contentW / fields.length;
  const heights = fields.map(([label, value], i) =>
    drawField(cursor.doc, label, value, PDF_MARGIN + colW * i, cursor.y, colW - 4)
  );
  cursor.y += Math.max(...heights) + gapAfter;
}

export function drawParagraph(cursor: PdfCursor, label: string, text: string) {
  if (!text) return;
  const { doc } = cursor;
  const lines = doc.splitTextToSize(text, cursor.contentW) as string[];
  cursor.ensure(6 + lines.length * 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_MUTED);
  doc.text(label, PDF_MARGIN, cursor.y);
  cursor.y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_INK);
  doc.text(lines, PDF_MARGIN, cursor.y);
  cursor.y += lines.length * 4 + 2.5;
}

export type PdfPersonCard = {
  title: string;
  name: string;
  emptyName?: string;
  rows: [string, string][];
};

const CARD_ROW_H = 4.3;

function cardHeight(card: PdfPersonCard) {
  return 16 + card.rows.length * CARD_ROW_H;
}

function drawPersonCard(doc: jsPDF, card: PdfPersonCard, x: number, y: number, w: number, h: number) {
  doc.setFillColor(246, 248, 253);
  doc.setDrawColor(210, 216, 236);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");
  doc.setFillColor(...PDF_BLUE);
  doc.rect(x, y + 1.5, 1.2, h - 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_CYAN);
  doc.text(card.title.toUpperCase(), x + 4, y + 5);

  doc.setFontSize(card.name ? 10 : 9);
  doc.setTextColor(...(card.name ? PDF_INK : PDF_MUTED));
  const name = card.name || card.emptyName || "Sin asignar";
  doc.text(doc.splitTextToSize(name, w - 8)[0] as string, x + 4, y + 10.5);

  let rowY = y + 16;
  for (const [label, value] of card.rows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(...PDF_MUTED);
    doc.text(`${label}:`, x + 4, rowY);
    doc.setTextColor(...PDF_INK);
    doc.text(doc.splitTextToSize(value || "—", w - 30)[0] as string, x + 26, rowY);
    rowY += CARD_ROW_H;
  }
}

/** Tarjetas de personas en una rejilla de `columns` columnas, todas con la misma altura por fila. */
export function drawPersonCards(cursor: PdfCursor, cards: PdfPersonCard[], columns = 2) {
  const gap = 5;
  const w = (cursor.contentW - gap * (columns - 1)) / columns;
  for (let start = 0; start < cards.length; start += columns) {
    const row = cards.slice(start, start + columns);
    const h = Math.max(...row.map(cardHeight)) + 1;
    cursor.ensure(h + 3);
    row.forEach((card, i) => drawPersonCard(cursor.doc, card, PDF_MARGIN + i * (w + gap), cursor.y, w, h));
    cursor.y += h + 4;
  }
}

export type PdfColumn = {
  key: string;
  label: string;
  width: number;
  align?: "left" | "center" | "right";
};

export type PdfCellStyle = "bold" | "danger" | "muted" | "success";

export type PdfRow = {
  cells: Record<string, string | string[]>;
  styles?: Partial<Record<string, PdfCellStyle>>;
};

function drawTableHeader(cursor: PdfCursor, columns: PdfColumn[]) {
  const { doc } = cursor;
  doc.setFillColor(...PDF_BLUE);
  doc.rect(PDF_MARGIN, cursor.y, cursor.contentW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  let x = PDF_MARGIN;
  for (const col of columns) {
    doc.text(col.label, cellX(col, x), cursor.y + 4.7, { align: col.align ?? "left" });
    x += col.width;
  }
  cursor.y += 7;
}

function cellX(col: PdfColumn, x: number) {
  if (col.align === "center") return x + col.width / 2;
  if (col.align === "right") return x + col.width - 1.8;
  return x + 1.8;
}

const STYLE_COLOR: Record<PdfCellStyle, Rgb> = {
  bold: PDF_INK,
  danger: PDF_DANGER,
  muted: PDF_MUTED,
  success: PDF_SUCCESS,
};

/**
 * Tabla con encabezado azul que se repite al cambiar de página. Si una celda trae
 * un arreglo, la primera línea va en negritas y las demás en gris (detalle).
 */
export function drawTable(cursor: PdfCursor, columns: PdfColumn[], rows: PdfRow[]) {
  const { doc } = cursor;
  drawTableHeader(cursor, columns);
  const lineH = 3.6;

  rows.forEach((row, index) => {
    doc.setFontSize(8);
    const wrapped = columns.map((col) => {
      const raw = row.cells[col.key] ?? "";
      const parts = Array.isArray(raw) ? raw.filter(Boolean) : [raw];
      return parts.flatMap((part, i) => {
        doc.setFontSize(i === 0 ? 8 : 7);
        return (doc.splitTextToSize(part || (i === 0 ? "—" : ""), col.width - 3.6) as string[]).map((text) => ({
          text,
          detail: i > 0,
        }));
      });
    });
    const rowH = Math.max(8, Math.max(...wrapped.map((lines) => lines.length)) * lineH + 3.4);
    if (cursor.ensure(rowH)) drawTableHeader(cursor, columns);

    if (index % 2 === 1) {
      doc.setFillColor(247, 248, 252);
      doc.rect(PDF_MARGIN, cursor.y, cursor.contentW, rowH, "F");
    }
    doc.setDrawColor(226, 229, 240);
    doc.line(PDF_MARGIN, cursor.y + rowH, PDF_MARGIN + cursor.contentW, cursor.y + rowH);

    let x = PDF_MARGIN;
    columns.forEach((col, ci) => {
      const style = row.styles?.[col.key];
      wrapped[ci].forEach((line, li) => {
        if (line.detail) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(...PDF_MUTED);
        } else {
          doc.setFont("helvetica", style && style !== "muted" ? "bold" : "normal");
          doc.setFontSize(8);
          doc.setTextColor(...(style ? STYLE_COLOR[style] : PDF_INK));
        }
        doc.text(line.text, cellX(col, x), cursor.y + 4.6 + li * lineH, { align: col.align ?? "left" });
      });
      x += col.width;
    });
    cursor.y += rowH;
  });
  cursor.y += 2;
}

export type PdfSignature = { title: string; name: string };

/** Líneas de firma en una sola fila; el nombre se parte en renglones sin encimarse con el rótulo. */
export function drawSignatures(cursor: PdfCursor, boxes: PdfSignature[]) {
  const { doc } = cursor;
  const gap = 8;
  const w = (cursor.contentW - gap * (boxes.length - 1)) / boxes.length;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  const names = boxes.map((box) => doc.splitTextToSize(box.name || " ", w) as string[]);
  const nameLines = Math.max(...names.map((lines) => lines.length));
  cursor.ensure(11 + nameLines * 3.8 + 4);
  cursor.y += 11;
  boxes.forEach((box, i) => {
    const x = PDF_MARGIN + i * (w + gap);
    doc.setDrawColor(120, 120, 130);
    doc.line(x, cursor.y, x + w, cursor.y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_INK);
    doc.text(names[i], x + w / 2, cursor.y + 4.2, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_MUTED);
    doc.text(box.title, x + w / 2, cursor.y + 4.2 + nameLines * 3.8, { align: "center", maxWidth: w });
  });
  cursor.y += nameLines * 3.8 + 8;
}
