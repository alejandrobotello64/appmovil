import { jsPDF } from "jspdf";
import { drawBrandedFooter, drawBrandedHeader } from "@/lib/brand/pdf";
import { deliverPdf, type PdfIntent } from "@/lib/print/open-pdf";
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
import {
  groupPurchaseRequestLines,
  purchasePriorityLabel,
  purchaseRequestUnits,
  purchaseStatusLabel,
  type PurchaseRequest,
} from "./types";

const COLUMNS: PdfColumn[] = [
  { key: "n", label: "#", width: 7, align: "center" },
  { key: "sku", label: "SKU", width: 26 },
  { key: "desc", label: "Material", width: 79 },
  { key: "unit", label: "Unidad", width: 16, align: "center" },
  { key: "qty", label: "Cantidad", width: 18, align: "center" },
  { key: "stock", label: "Stock al pedir", width: 36, align: "center" },
];

const PICK_COLUMNS: PdfColumn[] = [
  { key: "ok", label: "✓", width: 8, align: "center" },
  { key: "n", label: "#", width: 8, align: "center" },
  { key: "sku", label: "SKU", width: 26 },
  { key: "desc", label: "Material", width: 70 },
  { key: "unit", label: "Unidad", width: 16, align: "center" },
  { key: "qty", label: "A comprar", width: 18, align: "center" },
  { key: "from", label: "Folios", width: 36 },
];

export type PurchasePrintOptions = {
  output?: PdfIntent;
};

function rowsFor(profile: StaffProfile | null, extra: [string, string][]): [string, string][] {
  return [
    ["Puesto", profile?.jobTitle ?? ""],
    ["Departamento", profile?.department ?? ""],
    ["Teléfono", profile?.phone ?? ""],
    ...extra,
  ];
}

type StaffLookup = (name: string) => StaffProfile | null;

async function renderRequestPage(doc: jsPDF, request: PurchaseRequest, lookup: StaffLookup) {
  const requester = lookup(request.requester.username) ?? lookup(request.requester.name);
  const buyer = request.assignedTo ? lookup(request.assignedTo) : null;
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
}

/** Una hoja por cada solicitud de compra. */
export async function downloadPurchaseRequestsPdf(
  requests: PurchaseRequest[],
  options: PurchasePrintOptions = {}
) {
  if (!requests.length) throw new Error("Selecciona al menos una solicitud de compra para imprimir.");
  const lookup = await loadStaffProfileLookup();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  for (let index = 0; index < requests.length; index++) {
    if (index > 0) doc.addPage();
    await renderRequestPage(doc, requests[index], lookup);
  }
  drawBrandedFooter(doc);
  const fileName =
    requests.length === 1
      ? `${requests[0].folio}-solicitud-compra.pdf`
      : `solicitudes-compra-${requests.length}-folios.pdf`;
  await deliverPdf(doc, fileName, options.output ?? "print");
}

export async function downloadPurchaseRequestPdf(
  request: PurchaseRequest,
  options: PurchasePrintOptions = {}
) {
  await downloadPurchaseRequestsPdf([request], options);
}

/** Suma agrupada por código para verificar lo que se va a comprar. */
export async function downloadPurchaseRequestPickListPdf(
  requests: PurchaseRequest[],
  options: PurchasePrintOptions = {}
) {
  if (!requests.length) throw new Error("Selecciona al menos una solicitud de compra para imprimir la suma.");
  const groups = groupPurchaseRequestLines(requests);
  if (!groups.length) throw new Error("No hay materiales para imprimir.");

  const lookup = await loadStaffProfileLookup();
  const folios = requests.map((item) => item.folio);
  const origins = [
    ...new Set(
      requests
        .map((item) =>
          item.requisitionFolio
            ? `Surtimiento ${item.requisitionFolio}`
            : item.serviceOrderFolio
              ? `OS ${item.serviceOrderFolio}`
              : item.source === "manual"
                ? "Compra directa"
                : ""
        )
        .filter(Boolean)
    ),
  ];
  const requesters = [
    ...new Set(
      requests.map((item) => {
        const profile = lookup(item.requester.username) ?? lookup(item.requester.name);
        return profile?.fullName || item.requester.name;
      })
    ),
  ];
  const buyers = [
    ...new Set(requests.map((item) => item.assignedTo).filter(Boolean)),
  ].map((name) => lookup(name)?.fullName || name);
  const totalQty = groups.reduce((sum, group) => sum + group.quantity, 0);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const start = await drawBrandedHeader(doc, {
    title: "Lista de verificación · suma a comprar",
    folio: folios.length === 1 ? folios[0] : `${folios.length} FOLIOS`,
    rightLines: [
      "SOLO REFERENCIA",
      `${groups.length} código${groups.length === 1 ? "" : "s"} · ${formatPdfQty(totalQty)} pzas`,
    ],
  });
  const cursor = new PdfCursor(doc, start);

  drawParagraph(
    cursor,
    "Uso",
    "Agrupa el mismo código en una sola cantidad para comprobar lo que se va a comprar. No sustituye la solicitud por folio: esa hoja sí se entrega y se firma."
  );
  drawFieldRow(cursor, [
    ["Solicitudes", folios.join(" · ")],
    ["Origen", origins.join(" · ")],
    ["Solicita", requesters.join(" · ")],
    ["Atiende", buyers.join(" · ") || "Compras"],
  ]);

  cursor.sectionTitle("Material a comprar (cantidades juntas)");
  drawTable(
    cursor,
    PICK_COLUMNS,
    groups.map((group, index) => {
      const from = [
        ...new Set(group.sources.map((source) => source.request.folio)),
      ].join(", ");
      return {
        cells: {
          ok: "",
          n: String(index + 1),
          sku: group.productSku || "—",
          desc: group.description || group.productName,
          unit: group.unit,
          qty: formatPdfQty(group.quantity),
          from,
        },
        styles: { qty: "bold" },
      };
    })
  );

  cursor.ensure(8);
  cursor.doc.setFont("helvetica", "bold");
  cursor.doc.setFontSize(9);
  cursor.doc.setTextColor(...PDF_INK);
  cursor.doc.text(
    `Total a comprar: ${groups.length} código${groups.length === 1 ? "" : "s"} · ${formatPdfQty(totalQty)} unidades`,
    PDF_MARGIN + cursor.contentW,
    cursor.y + 3,
    { align: "right" }
  );
  cursor.y += 10;

  drawSignatures(cursor, [
    { title: "Prepara / verifica", name: buyers[0] ?? "" },
    { title: "Autoriza (compras)", name: buyers[0] ?? "" },
    { title: "Recibe material (almacén)", name: "" },
  ]);

  drawBrandedFooter(
    doc,
    "Suma de verificación. Imprime también cada solicitud por su folio."
  );
  const fileName =
    folios.length === 1
      ? `${folios[0]}-suma-compra.pdf`
      : `solicitudes-compra-suma-${folios.length}.pdf`;
  await deliverPdf(doc, fileName, options.output ?? "print");
}
