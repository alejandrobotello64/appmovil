import { jsPDF } from "jspdf";
import { drawBrandedFooter, drawBrandedHeader } from "@/lib/brand/pdf";
import { summarize, type ExpenseEntry } from "./summary";
import {
  balanceLabel,
  categoryColor,
  categoryLabel,
  categoryTotals,
  expenseKindMeta,
  formatDate,
  formatMoney,
  itemHasInvoice,
  paymentMethodLabel,
  reportBalance,
  reportDays,
  reportTitle,
  statusMeta,
  todayIso,
  type ExpenseReport,
} from "./types";

export type PdfOutput = "download" | "print";

const MARGIN = 14;
const BOTTOM = 18;

type Column = { header: string; width: number; align?: "left" | "right" | "center" };
type Cell = string | { text: string; color?: string; bold?: boolean };

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16) || 0,
    parseInt(value.slice(2, 4), 16) || 0,
    parseInt(value.slice(4, 6), 16) || 0,
  ];
}

function fit(doc: jsPDF, text: string, width: number) {
  if (doc.getTextWidth(text) <= width) return text;
  let result = text;
  while (result.length > 1 && doc.getTextWidth(`${result}…`) > width) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

function ensureSpace(doc: jsPDF, y: number, needed: number) {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed <= pageH - BOTTOM) return y;
  doc.addPage();
  return 18;
}

function sectionTitle(doc: jsPDF, y: number, title: string) {
  y = ensureSpace(doc, y, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(59, 70, 165);
  doc.text(title, MARGIN, y);
  return y + 4;
}

function drawTable(doc: jsPDF, startY: number, columns: Column[], rows: Cell[][], footer?: Cell[]) {
  const pageW = doc.internal.pageSize.getWidth();
  const tableW = pageW - MARGIN * 2;
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const widths = columns.map((column) => (column.width / totalWidth) * tableW);
  const rowH = 5.6;

  const drawHeader = (y: number) => {
    doc.setFillColor(59, 70, 165);
    doc.rect(MARGIN, y, tableW, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    let x = MARGIN;
    columns.forEach((column, index) => {
      const w = widths[index];
      const tx = column.align === "right" ? x + w - 1.5 : column.align === "center" ? x + w / 2 : x + 1.5;
      doc.text(fit(doc, column.header, w - 3), tx, y + 3.9, { align: column.align ?? "left" });
      x += w;
    });
    return y + rowH;
  };

  const drawRow = (y: number, cells: Cell[], shaded: boolean, bold = false) => {
    if (shaded) {
      doc.setFillColor(245, 247, 252);
      doc.rect(MARGIN, y, tableW, rowH, "F");
    }
    let x = MARGIN;
    cells.forEach((cell, index) => {
      const column = columns[index];
      const w = widths[index];
      const text = typeof cell === "string" ? cell : cell.text;
      const color = typeof cell === "string" ? undefined : cell.color;
      const cellBold = bold || (typeof cell !== "string" && cell.bold);
      let tx = column.align === "right" ? x + w - 1.5 : column.align === "center" ? x + w / 2 : x + 1.5;
      if (color && column.align !== "right") {
        doc.setFillColor(...hexToRgb(color));
        doc.rect(x + 1.5, y + 1.7, 2.2, 2.2, "F");
        tx += 3.4;
      }
      doc.setFont("helvetica", cellBold ? "bold" : "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(40, 40, 40);
      const available = w - 3 - (color && column.align !== "right" ? 3.4 : 0);
      doc.text(fit(doc, text, available), tx, y + 3.9, { align: column.align ?? "left" });
      x += w;
    });
    doc.setDrawColor(228, 231, 240);
    doc.line(MARGIN, y + rowH, MARGIN + tableW, y + rowH);
    return y + rowH;
  };

  let y = ensureSpace(doc, startY, rowH * 3);
  y = drawHeader(y);
  rows.forEach((row, index) => {
    const nextY = ensureSpace(doc, y, rowH);
    if (nextY !== y) y = drawHeader(nextY);
    y = drawRow(y, row, index % 2 === 1);
  });
  if (footer) {
    const nextY = ensureSpace(doc, y, rowH);
    if (nextY !== y) y = drawHeader(nextY);
    doc.setFillColor(232, 236, 248);
    doc.rect(MARGIN, y, tableW, rowH, "F");
    y = drawRow(y, footer, false, true);
  }
  return y + 6;
}

function drawKpis(doc: jsPDF, y: number, kpis: Array<[string, string]>) {
  const pageW = doc.internal.pageSize.getWidth();
  const gap = 3;
  const w = (pageW - MARGIN * 2 - gap * (kpis.length - 1)) / kpis.length;
  y = ensureSpace(doc, y, 18);
  kpis.forEach(([label, value], index) => {
    const x = MARGIN + index * (w + gap);
    doc.setFillColor(243, 245, 251);
    doc.setDrawColor(210, 216, 236);
    doc.roundedRect(x, y, w, 14, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(100, 100, 110);
    doc.text(fit(doc, label.toUpperCase(), w - 4), x + 2.5, y + 4.6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(30, 30, 30);
    doc.text(fit(doc, value, w - 4), x + 2.5, y + 10.6);
  });
  return y + 20;
}

function labelValueGrid(doc: jsPDF, y: number, pairs: Array<[string, string]>) {
  const pageW = doc.internal.pageSize.getWidth();
  const colW = (pageW - MARGIN * 2) / 2;
  for (let i = 0; i < pairs.length; i += 2) {
    y = ensureSpace(doc, y, 6);
    [pairs[i], pairs[i + 1]].forEach((pair, col) => {
      if (!pair) return;
      const x = MARGIN + col * colW;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(59, 70, 165);
      doc.text(`${pair[0]}:`, x, y);
      const labelW = doc.getTextWidth(`${pair[0]}: `);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      doc.text(fit(doc, pair[1] || "—", colW - labelW - 4), x + labelW, y);
    });
    y += 5;
  }
  return y + 2;
}

function signatures(doc: jsPDF, y: number, labels: string[]) {
  const pageW = doc.internal.pageSize.getWidth();
  y = ensureSpace(doc, y + 8, 24);
  const w = (pageW - MARGIN * 2 - 10 * (labels.length - 1)) / labels.length;
  labels.forEach((label, index) => {
    const x = MARGIN + index * (w + 10);
    doc.setDrawColor(150, 150, 160);
    doc.line(x, y + 14, x + w, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text(label, x + w / 2, y + 18, { align: "center" });
  });
  return y + 24;
}

function finish(doc: jsPDF, fileName: string, output: PdfOutput) {
  if (output === "print") {
    doc.autoPrint();
    const url = doc.output("bloburl");
    window.open(url, "_blank");
    return;
  }
  doc.save(fileName);
}

/** Comprobación de un registro: datos generales, gastos, resumen por categoría y saldo. */
export async function buildExpenseReportPdf(report: ExpenseReport) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const meta = expenseKindMeta(report.kind);
  const balance = reportBalance(report);
  let y = await drawBrandedHeader(doc, {
    title: `Comprobación de gastos · ${meta.label}`,
    folio: report.folio,
    rightLines: [`Estatus: ${statusMeta(report.status).label}`],
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(reportTitle(report), MARGIN, y);
  y += 6;

  const period =
    report.startDate === report.endDate
      ? formatDate(report.startDate)
      : `${formatDate(report.startDate)} al ${formatDate(report.endDate)}${meta.isTrip ? ` (${reportDays(report)} días)` : ""}`;
  const pairs: Array<[string, string]> = [
    ["Responsable", report.employeeName],
    ["Área", report.department],
    [meta.isTrip ? "Fechas" : "Periodo", period],
    ["Tipo", meta.label],
  ];
  if (meta.isTrip) pairs.push(["Destino", report.destination], ["Cliente / motivo", report.clientName]);
  if (report.purpose) pairs.push(["Objetivo", report.purpose]);
  if (meta.advanceLabel) pairs.push([meta.advanceLabel, formatMoney(report.advanceAmount)]);
  if (report.reviewedBy) pairs.push(["Revisó", `${report.reviewedBy} · ${formatDate(report.reviewedAt)}`]);
  y = labelValueGrid(doc, y, pairs);

  y = drawKpis(doc, y, [
    ["Total de gastos", formatMoney(balance.spent)],
    ["Con factura", formatMoney(balance.invoiced)],
    ["Pagado por la empresa", formatMoney(balance.companyPaid)],
    meta.advanceLabel
      ? [balanceLabel(balance.balance, true), formatMoney(Math.abs(balance.balance))]
      : ["Pagado por colaborador", formatMoney(balance.employeePaid)],
  ]);

  const byCategory = categoryTotals(report.items);
  if (byCategory.length) {
    y = sectionTitle(doc, y, "Resumen por categoría");
    y = drawTable(
      doc,
      y,
      [
        { header: "Categoría", width: 50 },
        { header: "Gastos", width: 14, align: "right" },
        { header: "Con factura", width: 24, align: "right" },
        { header: "Total", width: 24, align: "right" },
        { header: "%", width: 12, align: "right" },
      ],
      byCategory.map((row) => [
        { text: row.label, color: row.color },
        String(row.count),
        formatMoney(row.invoiced),
        formatMoney(row.total),
        `${(row.share * 100).toFixed(1)}%`,
      ]),
      ["Total", String(report.items.length), formatMoney(balance.invoiced), formatMoney(balance.spent), "100%"]
    );
  }

  y = sectionTitle(doc, y, "Detalle de gastos");
  y = drawTable(
    doc,
    y,
    [
      { header: "Fecha", width: 16 },
      { header: "Categoría", width: 30 },
      { header: "Concepto / proveedor", width: 50 },
      { header: "Factura", width: 20 },
      { header: "Pago", width: 22 },
      { header: "Total", width: 20, align: "right" },
    ],
    report.items.map((item) => [
      formatDate(item.expenseDate),
      { text: categoryLabel(item.category), color: categoryColor(item.category) },
      [item.concept, item.supplierName].filter(Boolean).join(" · "),
      itemHasInvoice(item)
        ? item.invoiceNumber || item.cfdiUuid.slice(0, 8) || "XML"
        : item.pdfPath
          ? "Ticket"
          : "Sin comprobante",
      paymentMethodLabel(item.paymentMethod, true),
      formatMoney(item.total),
    ]),
    ["", "", "", "", "Total", formatMoney(balance.spent)]
  );

  if (report.reviewNotes || report.notes) {
    y = sectionTitle(doc, y, "Observaciones");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(
      [report.notes, report.reviewNotes ? `Revisión: ${report.reviewNotes}` : ""].filter(Boolean).join("\n"),
      doc.internal.pageSize.getWidth() - MARGIN * 2
    );
    y = ensureSpace(doc, y, lines.length * 4);
    doc.text(lines, MARGIN, y + 2);
    y += lines.length * 4 + 4;
  }

  signatures(doc, y, ["Responsable", "Revisó", "Autorizó"]);
  drawBrandedFooter(doc);
  return doc;
}

export async function exportExpenseReportPdf(report: ExpenseReport, output: PdfOutput = "download") {
  finish(await buildExpenseReportPdf(report), `${report.folio}-comprobacion-gastos.pdf`, output);
}

export type SummaryPdfOptions = {
  entries: ExpenseEntry[];
  reports: ExpenseReport[];
  periodLabel: string;
  filterLines: string[];
  includeItems: boolean;
  output?: PdfOutput;
};

export async function exportExpenseSummaryPdf(options: SummaryPdfOptions) {
  finish(await buildExpenseSummaryPdf(options), "resumen-gastos.pdf", options.output ?? "download");
}

/** Resumen general de gastos: totales por tipo, categoría, colaborador y registro. */
export async function buildExpenseSummaryPdf(options: SummaryPdfOptions) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const summary = summarize(options.entries);
  let y = await drawBrandedHeader(doc, {
    title: "Resumen de gastos",
    rightLines: [options.periodLabel, `Generado ${formatDate(todayIso())}`],
  });

  if (options.filterLines.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    for (const line of options.filterLines) {
      doc.text(line, MARGIN, y);
      y += 4.4;
    }
    y += 2;
  }

  y = drawKpis(doc, y, [
    ["Total de gastos", formatMoney(summary.total)],
    ["Registros", String(summary.reports)],
    ["Comprobantes", String(summary.count)],
    ["Con factura", formatMoney(summary.invoiced)],
    ["Sin factura", formatMoney(summary.withoutInvoice)],
  ]);

  if (summary.count === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text("No hay gastos con los filtros seleccionados.", MARGIN, y + 4);
    drawBrandedFooter(doc);
    return doc;
  }

  y = sectionTitle(doc, y, "Por tipo de gasto");
  y = drawTable(
    doc,
    y,
    [
      { header: "Tipo", width: 50 },
      { header: "Registros", width: 18, align: "right" },
      { header: "Gastos", width: 16, align: "right" },
      { header: "Total", width: 26, align: "right" },
      { header: "%", width: 12, align: "right" },
    ],
    summary.byKind.map((row) => [
      row.label,
      String(row.reports),
      String(row.count),
      formatMoney(row.total),
      `${(row.share * 100).toFixed(1)}%`,
    ]),
    ["Total", String(summary.reports), String(summary.count), formatMoney(summary.total), "100%"]
  );

  y = sectionTitle(doc, y, "Por categoría");
  y = drawTable(
    doc,
    y,
    [
      { header: "Categoría", width: 50 },
      { header: "Gastos", width: 14, align: "right" },
      { header: "Con factura", width: 24, align: "right" },
      { header: "Total", width: 24, align: "right" },
      { header: "%", width: 12, align: "right" },
    ],
    summary.byCategory.map((row) => [
      { text: row.label, color: row.color },
      String(row.count),
      formatMoney(row.invoiced),
      formatMoney(row.total),
      `${(row.share * 100).toFixed(1)}%`,
    ]),
    ["Total", String(summary.count), formatMoney(summary.invoiced), formatMoney(summary.total), "100%"]
  );

  y = sectionTitle(doc, y, "Por colaborador");
  y = drawTable(
    doc,
    y,
    [
      { header: "Colaborador", width: 60 },
      { header: "Registros", width: 18, align: "right" },
      { header: "Gastos", width: 16, align: "right" },
      { header: "Total", width: 26, align: "right" },
    ],
    summary.byEmployee.map((row) => [row.name, String(row.reports), String(row.count), formatMoney(row.total)])
  );

  const reportTotals = new Map<string, number>();
  for (const entry of options.entries) {
    reportTotals.set(entry.report.id, (reportTotals.get(entry.report.id) ?? 0) + entry.item.total);
  }
  y = sectionTitle(doc, y, "Registros incluidos");
  y = drawTable(
    doc,
    y,
    [
      { header: "Folio", width: 22 },
      { header: "Tipo", width: 22 },
      { header: "Descripción", width: 46 },
      { header: "Responsable", width: 32 },
      { header: "Estatus", width: 18 },
      { header: "Total", width: 22, align: "right" },
    ],
    options.reports
      .filter((report) => reportTotals.has(report.id))
      .map((report) => [
        report.folio,
        expenseKindMeta(report.kind).label,
        reportTitle(report),
        report.employeeName,
        statusMeta(report.status).label,
        formatMoney(reportTotals.get(report.id) ?? 0),
      ])
  );

  if (options.includeItems) {
    y = sectionTitle(doc, y, "Detalle de gastos");
    drawTable(
      doc,
      y,
      [
        { header: "Fecha", width: 16 },
        { header: "Folio", width: 22 },
        { header: "Categoría", width: 26 },
        { header: "Concepto / proveedor", width: 50 },
        { header: "Factura", width: 16 },
        { header: "Total", width: 20, align: "right" },
      ],
      options.entries.map(({ item, report }) => [
        formatDate(item.expenseDate),
        report.folio,
        { text: categoryLabel(item.category), color: categoryColor(item.category) },
        [item.concept, item.supplierName].filter(Boolean).join(" · "),
        itemHasInvoice(item) ? "Sí" : item.pdfPath ? "Ticket" : "No",
        formatMoney(item.total),
      ]),
      ["", "", "", "", "Total", formatMoney(summary.total)]
    );
  }

  drawBrandedFooter(doc);
  return doc;
}
