import { jsPDF } from "jspdf";
import { drawBrandedFooter, drawBrandedHeader } from "@/lib/brand/pdf";
import {
  PDF_INK,
  PDF_MARGIN,
  PDF_MUTED,
  PdfCursor,
  drawFieldRow,
  drawParagraph,
  drawPersonCards,
  drawSignatures,
  drawTable,
  formatPdfDate,
  formatPdfQty,
  type PdfColumn,
} from "@/lib/brand/pdf-layout";
import { loadStaffProfileLookup, type StaffProfile } from "@/lib/users/staff";
import { purchasePriorityLabel, purchaseRequestUnits, purchaseStatusLabel, type PurchaseRequest } from "./types";

const COLUMNS: PdfColumn[] = [
  { key: "n", label: "#", width: 7, align: "center" },
  { key: "sku", label: "SKU", width: 26 },
  { key: "desc", label: "Material", width: 79 },
  { key: "unit", label: "Unidad", width: 16, align: "center" },
  { key: "qty", label: "Cantidad", width: 18, align: "center" },
  { key: "stock", label: "Stock al pedir", width: 36, align: "center" },
];

function rowsFor(profile: StaffProfile | null, extra: [string, string][]): [string, string][] {
  return [
    ["Puesto", profile?.jobTitle ?? ""],
    ["Departamento", profile?.department ?? ""],
    ["Teléfono", profile?.phone ?? ""],
    ...extra,
  ];
}

export async function downloadPurchaseRequestPdf(request: PurchaseRequest) {
  const lookup = await loadStaffProfileLookup();
  const requester = lookup(request.requester.username) ?? lookup(request.requester.name);
  const buyer = request.assignedTo ? lookup(request.assignedTo) : null;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const start = await drawBrandedHeader(doc, {
    title: "Solicitud de compra",
    folio: request.folio,
    rightLines: [
      `Estatus: ${purchaseStatusLabel(request.status)}`,
      ...(request.priority === "urgente" ? ["Prioridad: URGENTE"] : []),
    ],
  });
  const cursor = new PdfCursor(doc, start);

  drawFieldRow(cursor, [
    ["Fecha de solicitud", formatPdfDate(request.requestedAt, true)],
    ["Requerida para", formatPdfDate(request.neededBy)],
    ["Prioridad", purchasePriorityLabel(request.priority)],
    ["Origen", request.requisitionFolio ? `Faltantes de ${request.requisitionFolio}` : "Solicitud directa"],
  ]);
  if (request.serviceOrderFolio || request.clientName) {
    drawFieldRow(cursor, [
      ["Orden de servicio", request.serviceOrderFolio],
      ["Cliente", request.clientName],
      ["Equipo", request.equipmentName],
    ]);
  }
  drawParagraph(cursor, "Justificación", request.justification);

  drawPersonCards(
    cursor,
    [
      {
        title: "Solicita",
        name: requester?.fullName || request.requester.name,
        rows: rowsFor(requester, [["Fecha", formatPdfDate(request.requestedAt, true)]]),
      },
      {
        title: "Compras",
        name: buyer?.fullName || request.assignedTo,
        emptyName: "Sin asignar",
        rows: rowsFor(buyer, [
          ["Orden compra", request.purchaseOrderNumber ? `${request.purchaseOrderNumber} · ${request.supplierName}` : ""],
        ]),
      },
    ],
    2
  );

  cursor.sectionTitle("Material a comprar");
  drawTable(
    cursor,
    COLUMNS,
    request.lines.map((line, index) => ({
      cells: {
        n: String(index + 1),
        sku: line.productSku || "—",
        desc: [line.description || line.productName, line.notes ? `Nota: ${line.notes}` : ""],
        unit: line.unit,
        qty: formatPdfQty(line.quantity),
        stock: request.source === "surtimiento" ? formatPdfQty(line.stockAtRequest) : "—",
      },
      styles: { qty: "bold" },
    }))
  );
  cursor.ensure(7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_INK);
  doc.text(
    `${request.lines.length} material(es) · ${formatPdfQty(purchaseRequestUnits(request))} unidades`,
    PDF_MARGIN + cursor.contentW,
    cursor.y + 3,
    { align: "right" }
  );
  cursor.y += 8;

  drawParagraph(cursor, "Notas del solicitante", request.notes);
  drawParagraph(cursor, "Notas de compras", request.purchasingNotes);
  if (request.status === "rechazada" || request.status === "cancelada") {
    drawParagraph(
      cursor,
      request.status === "rechazada" ? "Motivo del rechazo" : "Motivo de la cancelación",
      `${request.closedReason}${request.closedBy ? ` (${request.closedBy})` : ""}`
    );
  }

  if (request.events.length) {
    cursor.sectionTitle("Seguimiento");
    for (const event of request.events) {
      const text = doc.splitTextToSize(event.message, cursor.contentW - 75) as string[];
      cursor.ensure(text.length * 3.8 + 1);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(...PDF_MUTED);
      doc.text(formatPdfDate(event.createdAt, true), PDF_MARGIN, cursor.y);
      doc.setTextColor(...PDF_INK);
      doc.text(text, PDF_MARGIN + 32, cursor.y);
      doc.setTextColor(...PDF_MUTED);
      doc.text(event.actor, PDF_MARGIN + cursor.contentW, cursor.y, { align: "right", maxWidth: 40 });
      cursor.y += text.length * 3.8 + 0.8;
    }
    cursor.y += 2;
  }

  drawSignatures(cursor, [
    { title: "Solicita", name: requester?.fullName || request.requester.name },
    { title: "Autoriza (compras)", name: buyer?.fullName || request.assignedTo },
    { title: "Recibe material (almacén)", name: "" },
  ]);

  drawBrandedFooter(doc);
  doc.save(`${request.folio}-solicitud-compra.pdf`);
}
