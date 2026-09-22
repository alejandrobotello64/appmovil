import { jsPDF } from "jspdf";
import { drawBrandedFooter, drawBrandedHeader } from "@/lib/brand/pdf";
import { lineAmount, type Quote } from "./types";

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

/** Genera y descarga el PDF comercial de una cotización. */
export async function downloadQuotePdf(quote: Quote) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = await drawBrandedHeader(doc, {
    title: "Cotización comercial",
    folio: quote.folio,
    rightLines: [
      `Fecha: ${formatDate(quote.quoteDate)}`,
      quote.validUntil ? `Vigencia: ${formatDate(quote.validUntil)}` : "",
    ].filter(Boolean),
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(quote.title || "Cotización de productos y servicios", margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Cliente", margin, y);
  doc.text("Contacto / vendedor", pageW / 2, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);

  const leftBlock = [
    quote.clientName || "—",
    [quote.city, quote.state].filter(Boolean).join(", ") || undefined,
  ].filter(Boolean) as string[];
  const rightBlock = [
    quote.contactName ? `At'n: ${quote.contactName}` : undefined,
    quote.contactEmail || undefined,
    quote.contactPhone || undefined,
    quote.salesperson ? `Vendedor: ${quote.salesperson}` : undefined,
  ].filter(Boolean) as string[];

  const blockLines = Math.max(leftBlock.length, rightBlock.length, 1);
  for (let i = 0; i < blockLines; i++) {
    if (leftBlock[i]) doc.text(leftBlock[i], margin, y + i * 4.5);
    if (rightBlock[i]) doc.text(rightBlock[i], pageW / 2, y + i * 4.5);
  }
  y += blockLines * 4.5 + 6;

  // Table header
  const colX = {
    n: margin,
    desc: margin + 10,
    qty: pageW - margin - 62,
    price: pageW - margin - 40,
    amount: pageW - margin,
  };

  doc.setFillColor(245, 247, 252);
  doc.rect(margin, y - 4, pageW - margin * 2, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text("#", colX.n, y);
  doc.text("Descripción", colX.desc, y);
  doc.text("Cant.", colX.qty, y, { align: "right" });
  doc.text("P. unit.", colX.price, y, { align: "right" });
  doc.text("Importe", colX.amount, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);

  quote.lines.forEach((line, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const label = line.productSku
      ? `${line.description} (${line.productSku})`
      : line.description;
    const descLines = doc.splitTextToSize(label, colX.qty - colX.desc - 4);
    doc.text(String(index + 1), colX.n, y);
    doc.text(descLines, colX.desc, y);
    doc.text(
      `${line.quantity} ${line.unit}`,
      colX.qty,
      y,
      { align: "right" }
    );
    doc.text(money(line.unitPrice), colX.price, y, { align: "right" });
    doc.text(money(lineAmount(line)), colX.amount, y, { align: "right" });
    y += Math.max(descLines.length * 4, 6) + 1;
  });

  y += 4;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  const totalsX = pageW - margin;
  const labelX = pageW - margin - 50;
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text("Subtotal", labelX, y, { align: "right" });
  doc.text(money(quote.subtotal + quote.discount), totalsX, y, {
    align: "right",
  });
  y += 5;
  if (quote.discount > 0) {
    doc.text("Descuento", labelX, y, { align: "right" });
    doc.text(`- ${money(quote.discount)}`, totalsX, y, { align: "right" });
    y += 5;
  }
  doc.text(`IVA (${quote.taxRate}%)`, labelX, y, { align: "right" });
  doc.text(money(quote.taxAmount), totalsX, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(59, 70, 165);
  doc.text("Total", labelX, y, { align: "right" });
  doc.text(money(quote.total), totalsX, y, { align: "right" });

  if (quote.notes.trim()) {
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text("Notas / condiciones", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    const noteLines = doc.splitTextToSize(quote.notes, pageW - margin * 2);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4 + 4;
  }

  y = Math.max(y + 10, 270);
  drawBrandedFooter(
    doc,
    "Documento generado desde MAS · Cotización sujeta a disponibilidad y confirmación."
  );

  doc.save(`${quote.folio}.pdf`);
}
