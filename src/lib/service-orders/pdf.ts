import { jsPDF } from "jspdf";
import {
  checklistResultLabel,
  lineAmount,
  serviceLineKindLabel,
  serviceOrderStatusLabel,
  serviceTypeLabel,
  type ServiceOrder,
} from "./types";

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string) {
  if (!value) return "—";
  const d = value.slice(0, 10);
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return value;
  return `${day}/${m}/${y}`;
}

function drawHeader(doc: jsPDF, title: string, folio: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  doc.setFillColor(0, 191, 255);
  doc.rect(0, 0, pageW, 4, "F");
  doc.setFillColor(59, 70, 165);
  doc.rect(0, 4, pageW, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(59, 70, 165);
  doc.text("Medical Advanced Supplies", margin, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(title, margin, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(folio, pageW - margin, 16, { align: "right" });
  return 30;
}

function ensureSpace(doc: jsPDF, y: number, need = 20) {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + need < pageH - 14) return y;
  doc.addPage();
  return 16;
}

function drawClientEquipment(doc: jsPDF, order: ServiceOrder, y: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text("Cliente", margin, y);
  doc.text("Equipo médico", pageW / 2, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);

  const left = [
    order.clientName || "—",
    order.contactName ? `Contacto: ${order.contactName}` : undefined,
    order.contactPhone || undefined,
    order.contactEmail || undefined,
  ].filter(Boolean) as string[];

  const right = [
    order.equipmentName || "—",
    [order.equipmentBrand, order.equipmentModel].filter(Boolean).join(" ") ||
      undefined,
    order.equipmentSerial ? `Serie: ${order.equipmentSerial}` : undefined,
    order.equipmentLocation ? `Ubicación: ${order.equipmentLocation}` : undefined,
  ].filter(Boolean) as string[];

  const n = Math.max(left.length, right.length, 1);
  for (let i = 0; i < n; i++) {
    if (left[i]) doc.text(left[i], margin, y + i * 4.5);
    if (right[i]) doc.text(right[i], pageW / 2, y + i * 4.5);
  }
  return y + n * 4.5 + 6;
}

function drawLinesTable(doc: jsPDF, order: ServiceOrder, y: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  y = ensureSpace(doc, y, 16);
  doc.setFillColor(245, 247, 252);
  doc.rect(margin, y - 4, pageW - margin * 2, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.text("#", margin + 1, y);
  doc.text("Tipo", margin + 8, y);
  doc.text("Descripción", margin + 32, y);
  doc.text("Cant", pageW - margin - 48, y);
  doc.text("P. unit.", pageW - margin - 32, y);
  doc.text("Importe", pageW - margin, y, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "normal");
  order.lines.forEach((line, idx) => {
    y = ensureSpace(doc, y, 10);
    const desc = doc.splitTextToSize(line.description || "—", 70);
    doc.text(String(idx + 1), margin + 1, y);
    doc.text(serviceLineKindLabel(line.lineKind).slice(0, 10), margin + 8, y);
    doc.text(desc, margin + 32, y);
    doc.text(String(line.quantity), pageW - margin - 48, y);
    doc.text(money(line.unitPrice), pageW - margin - 32, y);
    doc.text(money(lineAmount(line)), pageW - margin, y, { align: "right" });
    y += Math.max(desc.length * 4, 5) + 2;
  });

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.text(`Subtotal: ${money(order.subtotal)}`, pageW - margin, y, {
    align: "right",
  });
  y += 5;
  doc.text(`IVA (${order.taxRate}%): ${money(order.taxAmount)}`, pageW - margin, y, {
    align: "right",
  });
  y += 5;
  doc.setFontSize(11);
  doc.text(`Total: ${money(order.total)}`, pageW - margin, y, { align: "right" });
  return y + 8;
}

/** Cotización / propuesta económica para el cliente. */
export function downloadServiceQuotePdf(order: ServiceOrder) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  let y = drawHeader(doc, "Cotización de servicio técnico", order.folio);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text(
    `${serviceTypeLabel(order.serviceType)} · ${serviceOrderStatusLabel(order.status)} · ${formatDate(order.receptionAt || order.createdAt)}`,
    margin,
    y
  );
  y += 8;
  y = drawClientEquipment(doc, order, y);

  if (order.faultReported) {
    y = ensureSpace(doc, y, 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Falla / solicitud reportada", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(order.faultReported, 180);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 4;
  }

  if (order.lines.length) {
    y = drawLinesTable(doc, order, y);
  }

  if (order.serviceNotes) {
    y = ensureSpace(doc, y, 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Notas (aparecen en cotización)", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    const notes = doc.splitTextToSize(order.serviceNotes, 180);
    doc.text(notes, margin, y);
  }

  doc.save(`${order.folio}-cotizacion.pdf`);
}

/** Orden de trabajo / reporte técnico para calidad. */
export function downloadServiceWorkOrderPdf(order: ServiceOrder) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  let y = drawHeader(doc, "Orden de trabajo · Control de calidad", order.folio);

  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text(
    `Tipo: ${serviceTypeLabel(order.serviceType)} · Estatus: ${serviceOrderStatusLabel(order.status)} · Técnico: ${order.technician || "—"}`,
    margin,
    y
  );
  y += 8;
  y = drawClientEquipment(doc, order, y);

  const blocks = [
    ["Falla reportada", order.faultReported],
    ["Diagnóstico", order.diagnosisNotes],
    ["Observaciones generales", order.generalObservations],
    ["Notas de servicio", order.serviceNotes],
  ] as const;

  for (const [label, text] of blocks) {
    if (!text) continue;
    y = ensureSpace(doc, y, 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(label, margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(text, 180);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 4;
  }

  if (order.checklist.length) {
    y = ensureSpace(doc, y, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Revisión de puntos", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const item of order.checklist) {
      y = ensureSpace(doc, y, 6);
      doc.text(`• ${item.label}`, margin, y);
      doc.text(checklistResultLabel(item.result), 160, y);
      y += 4.5;
    }
    y += 4;
  }

  if (order.lines.length) {
    y = drawLinesTable(doc, order, y);
  }

  y = ensureSpace(doc, y, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("_______________________________", margin, y + 12);
  doc.text("Firma técnico", margin, y + 17);
  doc.text("_______________________________", 120, y + 12);
  doc.text("Vo.Bo. calidad", 120, y + 17);

  doc.save(`${order.folio}-orden-trabajo.pdf`);
}

/** Acta de entrega / conformidad para el cliente. */
export function downloadServiceDeliveryPdf(order: ServiceOrder) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  let y = drawHeader(doc, "Acta de entrega de equipo médico", order.folio);

  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text(
    `Recepción: ${formatDate(order.receptionAt)} · Entrega: ${formatDate(order.deliveredAt || order.updatedAt)}`,
    margin,
    y
  );
  y += 8;
  y = drawClientEquipment(doc, order, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    "El cliente confirma la recepción del equipo en las condiciones descritas y la realización del servicio técnico.",
    margin,
    y
  );
  y += 8;

  if (order.checklist.length) {
    doc.setFont("helvetica", "bold");
    doc.text("Resumen de revisión de puntos", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const ok = order.checklist.filter((c) => c.result === "bien").length;
    const bad = order.checklist.filter((c) => c.result === "danado").length;
    const na = order.checklist.filter((c) => c.result === "no_tiene").length;
    const pending = order.checklist.filter((c) => c.result === "pendiente").length;
    doc.text(
      `Bien: ${ok} · Dañado: ${bad} · No tiene: ${na} · Pendiente: ${pending}`,
      margin,
      y
    );
    y += 8;
  }

  if (order.images.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Evidencia fotográfica registrada: ${order.images.length} imagen(es)`, margin, y);
    y += 8;
  }

  y = ensureSpace(doc, y, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("_______________________________", margin, y + 16);
  doc.text("Firma del cliente", margin, y + 21);
  doc.text("_______________________________", 120, y + 16);
  doc.text("Firma del técnico", 120, y + 21);

  doc.save(`${order.folio}-entrega.pdf`);
}
