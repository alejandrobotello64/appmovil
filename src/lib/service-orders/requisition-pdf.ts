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
  type PdfPersonCard,
  type PdfRow,
} from "@/lib/brand/pdf-layout";
import { getPurchaseRequests } from "@/lib/purchasing/storage";
import { isPurchaseOpen, purchaseStatusLabel, type PurchaseRequest } from "@/lib/purchasing/types";
import { supabase } from "@/lib/supabase/client";
import { loadStaffProfileLookup, type StaffProfile } from "@/lib/users/staff";
import { getRequisitionFulfillments } from "./requisition-storage";
import {
  requisitionLinePending,
  requisitionLineStatusLabel,
  requisitionOriginFolio,
  requisitionStatusLabel,
  type ServiceOrderRequisition,
} from "./requisitions";
import { serviceOrderStatusLabel, serviceTypeLabel } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Row = Record<string, unknown>;
const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));

const COLUMNS: PdfColumn[] = [
  { key: "n", label: "#", width: 7, align: "center" },
  { key: "sku", label: "SKU", width: 24 },
  { key: "desc", label: "Material", width: 58 },
  { key: "unit", label: "Unidad", width: 14, align: "center" },
  { key: "req", label: "Solic.", width: 14, align: "center" },
  { key: "ful", label: "Surtido", width: 15, align: "center" },
  { key: "pend", label: "Pend.", width: 14, align: "center" },
  { key: "buy", label: "Estatus / compra", width: 36 },
];

export type RequisitionPrintOptions = {
  /** Usuario que imprime; si es de almacén y aún no hay surtido, aparece como quien surte. */
  printedBy?: { username: string; fullName: string | null };
  printedByWarehouse?: boolean;
};

function personRows(profile: StaffProfile | null, extra: [string, string][] = []): [string, string][] {
  return [
    ["Puesto", profile?.jobTitle ?? ""],
    ["Departamento", profile?.department ?? ""],
    ["No. empleado", profile?.employeeNumber ?? ""],
    ["Teléfono", profile?.phone ?? ""],
    ...extra,
  ];
}

function purchaseForLine(lineId: string, purchases: PurchaseRequest[]) {
  return purchases.filter((purchase) => purchase.lines.some((line) => line.requisitionLineId === lineId));
}

async function loadOrigin(requisition: ServiceOrderRequisition): Promise<Row> {
  if (requisition.sourceType === "cotizacion") {
    if (!requisition.quoteId) return {};
    const { data } = await db
      .from("quotes")
      .select("folio, title, status, client_name, contact_name, contact_phone, contact_email, city, state, salesperson, quote_date")
      .eq("id", requisition.quoteId)
      .maybeSingle();
    return (data ?? {}) as Row;
  }
  if (!requisition.serviceOrderId) return {};
  const { data } = await db
    .from("service_orders")
    .select(
      "folio, status, priority, service_type, client_name, contact_name, contact_phone, equipment_name, equipment_brand, equipment_model, equipment_serial, equipment_location, technician, advisor, reception_at, promised_at, fault_reported"
    )
    .eq("id", requisition.serviceOrderId)
    .maybeSingle();
  return (data ?? {}) as Row;
}

/** Orden de surtimiento con su origen (OS o cotización), personas, surtidos y compras de faltantes. */
export async function downloadRequisitionPdf(
  requisition: ServiceOrderRequisition,
  options: RequisitionPrintOptions = {}
) {
  await downloadRequisitionsPdf([requisition], options);
}

/** Una o varias solicitudes de la misma persona, aunque vengan de órdenes distintas. */
export async function downloadRequisitionsPdf(
  requisitions: ServiceOrderRequisition[],
  options: RequisitionPrintOptions = {}
) {
  if (!requisitions.length) throw new Error("Selecciona al menos una solicitud para imprimir.");
  const lookup = await loadStaffProfileLookup();
  const packed = await Promise.all(
    requisitions.map(async (requisition) => {
      const [order, fulfillments, purchases] = await Promise.all([
        loadOrigin(requisition),
        getRequisitionFulfillments(requisition.id).catch(() => []),
        getPurchaseRequests({ requisitionId: requisition.id }).catch(() => [] as PurchaseRequest[]),
      ]);
      return { requisition, order, fulfillments, purchases };
    })
  );
  const first = packed[0];
  const combined = packed.length > 1;
  const allQuote = packed.every((item) => item.requisition.sourceType === "cotizacion");
  const fulfillers = [
    ...new Set(
      packed.flatMap((item) => [
        ...item.fulfillments.map((row) => row.fulfilledBy),
        item.requisition.fulfilledBy,
      ])
    ),
  ].filter(Boolean);
  let fulfillerKey = fulfillers.at(-1) || "";
  let fulfillerLabel = packed.some((item) => item.requisition.fulfilledAt)
    ? formatPdfDate(
        packed.map((item) => item.requisition.fulfilledAt).filter(Boolean).at(-1) || "",
        true
      )
    : "";
  if (!fulfillerKey && options.printedByWarehouse && options.printedBy) {
    fulfillerKey = options.printedBy.fullName || options.printedBy.username;
    fulfillerLabel = "Por surtir";
  }

  const requester = lookup(first.requisition.requestedBy);
  const advisor = lookup(str(allQuote ? first.order.salesperson : first.order.advisor));
  const technician = lookup(str(first.order.technician));
  const fulfiller = fulfillerKey ? lookup(fulfillerKey) : null;
  const nameOf = (profile: StaffProfile | null, raw: string) => profile?.fullName || raw;
  const folioLabel = combined
    ? packed.map((item) => item.requisition.folio).join(" + ")
    : first.requisition.folio;
  const urgent = packed.some((item) => item.requisition.priority === "urgente");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const start = await drawBrandedHeader(doc, {
    title: "Orden de surtimiento de material",
    folio: folioLabel.length > 42 ? `${packed.length} solicitudes` : folioLabel,
    rightLines: [
      combined
        ? `${packed.length} solicitudes de ${nameOf(requester, first.requisition.requestedBy) || "la misma persona"}`
        : `Estatus: ${requisitionStatusLabel(first.requisition.status)}`,
      ...(urgent ? ["Prioridad: URGENTE"] : []),
    ],
  });
  const cursor = new PdfCursor(doc, start);

  if (!combined) {
    if (allQuote) drawQuoteOrigin(cursor, first.requisition, first.order);
    else drawServiceOrderOrigin(cursor, first.requisition, first.order);
  } else {
    cursor.sectionTitle("Solicitudes incluidas");
    drawFieldRow(cursor, [
      ["Solicita", nameOf(requester, first.requisition.requestedBy)],
      ["Folios", packed.map((item) => item.requisition.folio).join(", ")],
      [
        "Órdenes / cotizaciones",
        packed.map((item) => requisitionOriginFolio(item.requisition) || "—").join(", "),
      ],
    ]);
  }

  cursor.sectionTitle("Personas involucradas");
  const fulfillerCard: PdfPersonCard = {
    title: "Surte (almacén)",
    name: fulfillerKey ? nameOf(fulfiller, fulfillerKey) : "",
    emptyName: "Pendiente de surtir",
    rows: personRows(fulfiller, [["Surtido", fulfillerLabel]]),
  };
  const requesterCard: PdfPersonCard = {
    title: "Solicita",
    name: nameOf(requester, first.requisition.requestedBy),
    rows: personRows(requester, [
      ["Fecha", formatPdfDate(first.requisition.requestedAt, true)],
    ]),
  };
  const cards: PdfPersonCard[] =
    allQuote
      ? [
          requesterCard,
          {
            title: "Vendedor",
            name: nameOf(advisor, str(first.order.salesperson)),
            emptyName: "Sin vendedor asignado",
            rows: personRows(advisor),
          },
          fulfillerCard,
        ]
      : [
          requesterCard,
          {
            title: "Asesor de servicio",
            name: nameOf(advisor, str(first.order.advisor)),
            emptyName: "Sin asesor asignado",
            rows: personRows(advisor),
          },
          {
            title: "Técnico asignado",
            name: nameOf(technician, str(first.order.technician)),
            emptyName: "Sin técnico asignado",
            rows: personRows(technician),
          },
          fulfillerCard,
        ];
  drawPersonCards(cursor, cards, 2);

  for (const item of packed) {
    if (combined) {
      if (item.requisition.sourceType === "cotizacion") {
        drawQuoteOrigin(cursor, item.requisition, item.order);
      } else {
        drawServiceOrderOrigin(cursor, item.requisition, item.order);
      }
    }
    drawRequisitionBody(
      cursor,
      item.requisition,
      item.fulfillments,
      item.purchases,
      (key) => nameOf(lookup(key), key)
    );
    drawParagraph(
      cursor,
      item.requisition.sourceType === "cotizacion" ? "Notas de ventas" : "Notas de servicio",
      item.requisition.notes
    );
    drawParagraph(cursor, "Notas de almacén", item.requisition.warehouseNotes);
  }

  drawSignatures(
    cursor,
    allQuote
      ? [
          {
            title: "Entrega material (almacén)",
            name: fulfillerKey ? nameOf(fulfiller, fulfillerKey) : "",
          },
          { title: "Recibe material (cliente / ventas)", name: "" },
          {
            title: "Vo. Bo. ventas",
            name:
              nameOf(advisor, str(first.order.salesperson)) ||
              nameOf(requester, first.requisition.requestedBy),
          },
        ]
      : [
          {
            title: "Entrega material (almacén)",
            name: fulfillerKey ? nameOf(fulfiller, fulfillerKey) : "",
          },
          {
            title: "Recibe material (técnico)",
            name: nameOf(technician, str(first.order.technician)),
          },
          {
            title: "Vo. Bo. asesor de servicio",
            name: nameOf(advisor, str(first.order.advisor)),
          },
        ]
  );

  drawBrandedFooter(doc);
  const filename = combined
    ? `surtimiento-${packed.length}-solicitudes.pdf`
    : `${first.requisition.folio}-orden-surtimiento.pdf`;
  doc.save(filename);
}

function drawQuoteOrigin(cursor: PdfCursor, requisition: ServiceOrderRequisition, quote: Row) {
  cursor.sectionTitle("Venta / cotización");
  drawFieldRow(cursor, [
    ["Cotización", requisition.quoteFolio || str(quote.folio)],
    ["Proyecto", str(quote.title)],
    ["Fecha de solicitud", formatPdfDate(requisition.requestedAt, true)],
    ["Requerido para", formatPdfDate(requisition.neededBy)],
  ]);
  drawFieldRow(cursor, [
    ["Cliente", requisition.clientName || str(quote.client_name)],
    ["Contacto", [str(quote.contact_name), str(quote.contact_phone)].filter(Boolean).join(" · ")],
    ["Ciudad", [str(quote.city), str(quote.state)].filter(Boolean).join(", ")],
  ]);
  if (requisition.deliveryAddress) drawParagraph(cursor, "Entrega en", requisition.deliveryAddress);
}

function drawServiceOrderOrigin(cursor: PdfCursor, requisition: ServiceOrderRequisition, order: Row) {
  cursor.sectionTitle("Orden de servicio");
  drawFieldRow(cursor, [
    ["Orden de servicio", requisition.serviceOrderFolio || str(order.folio)],
    ["Tipo de servicio", order.service_type ? serviceTypeLabel(str(order.service_type)) : ""],
    ["Estatus de la OS", order.status ? serviceOrderStatusLabel(str(order.status)) : ""],
    ["Prioridad", str(order.priority) === "urgente" ? "Urgente" : "Normal"],
  ]);
  drawFieldRow(cursor, [
    ["Cliente", requisition.clientName || str(order.client_name)],
    ["Contacto", [str(order.contact_name), str(order.contact_phone)].filter(Boolean).join(" · ")],
    ["Ubicación del equipo", str(order.equipment_location)],
  ]);
  drawFieldRow(cursor, [
    ["Equipo", requisition.equipmentName || str(order.equipment_name)],
    ["Marca / modelo", [str(order.equipment_brand), str(order.equipment_model)].filter(Boolean).join(" ")],
    ["No. de serie", str(order.equipment_serial)],
    ["Fecha de solicitud", formatPdfDate(requisition.requestedAt, true)],
  ]);
  if (order.fault_reported) drawParagraph(cursor, "Falla reportada", str(order.fault_reported));
}

function drawRequisitionBody(
  cursor: PdfCursor,
  requisition: ServiceOrderRequisition,
  fulfillments: Awaited<ReturnType<typeof getRequisitionFulfillments>>,
  purchases: PurchaseRequest[],
  displayName: (key: string) => string
) {
  const doc = cursor.doc;
  cursor.sectionTitle("Material solicitado");
  const rows: PdfRow[] = requisition.lines.map((line, index) => {
    const pending = requisitionLinePending(line);
    const linked = purchaseForLine(line.id, purchases);
    const buy = linked.map((purchase) => `${purchase.folio} · ${purchaseStatusLabel(purchase.status)}`);
    return {
      cells: {
        n: String(index + 1),
        sku: line.productSku || "—",
        desc: [line.description || line.productName, line.notes ? `Nota: ${line.notes}` : ""],
        unit: line.unit,
        req: formatPdfQty(line.quantityRequested),
        ful: formatPdfQty(line.quantityFulfilled),
        pend: formatPdfQty(pending),
        buy: [requisitionLineStatusLabel(line.lineStatus), ...buy],
      },
      styles: {
        req: "bold",
        ful: line.quantityFulfilled > 0 ? "success" : "muted",
        pend: pending > 0 ? "danger" : "bold",
      },
    };
  });
  drawTable(cursor, COLUMNS, rows);

  const totals = requisition.lines.reduce(
    (acc, line) => ({
      req: acc.req + line.quantityRequested,
      ful: acc.ful + line.quantityFulfilled,
      pend: acc.pend + requisitionLinePending(line),
    }),
    { req: 0, ful: 0, pend: 0 }
  );
  cursor.ensure(7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_INK);
  doc.text(
    `Total: ${formatPdfQty(totals.req)} solicitadas · ${formatPdfQty(totals.ful)} surtidas · ${formatPdfQty(totals.pend)} pendientes`,
    PDF_MARGIN + cursor.contentW,
    cursor.y + 3,
    { align: "right" }
  );
  cursor.y += 8;

  if (fulfillments.length) {
    cursor.sectionTitle("Surtidos registrados");
    const lineById = new Map(requisition.lines.map((line) => [line.id, line]));
    for (const item of fulfillments) {
      const line = item.lineId ? lineById.get(item.lineId) : undefined;
      cursor.ensure(5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...PDF_MUTED);
      doc.text(formatPdfDate(item.createdAt, true), PDF_MARGIN, cursor.y);
      doc.setTextColor(...PDF_INK);
      doc.text(
        `${formatPdfQty(item.quantity)} × ${line ? `${line.productSku ? `${line.productSku} · ` : ""}${line.description}` : "Material"}`,
        PDF_MARGIN + 32,
        cursor.y,
        { maxWidth: 100 }
      );
      doc.setTextColor(...PDF_MUTED);
      doc.text(`Surtió: ${displayName(item.fulfilledBy)}`, PDF_MARGIN + cursor.contentW, cursor.y, {
        align: "right",
      });
      cursor.y += 4.6;
    }
    cursor.y += 2;
  }

  if (purchases.length) {
    cursor.sectionTitle("Compras por faltantes");
    for (const purchase of purchases) {
      const detail = [
        purchaseStatusLabel(purchase.status),
        purchase.purchaseOrderNumber && `OC ${purchase.purchaseOrderNumber}`,
        purchase.supplierName,
        purchase.neededBy && `Requerida ${formatPdfDate(purchase.neededBy)}`,
      ]
        .filter(Boolean)
        .join(" · ");
      cursor.ensure(9);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...PDF_INK);
      doc.text(purchase.folio, PDF_MARGIN, cursor.y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...(isPurchaseOpen(purchase.status) ? PDF_INK : PDF_MUTED));
      doc.text(detail, PDF_MARGIN + 28, cursor.y);
      cursor.y += 4.2;
      doc.setFontSize(7.5);
      doc.setTextColor(...PDF_MUTED);
      const items = purchase.lines.map((line) => `${formatPdfQty(line.quantity)} ${line.unit} ${line.description}`).join(" · ");
      const wrapped = doc.splitTextToSize(items, cursor.contentW - 28) as string[];
      cursor.ensure(wrapped.length * 3.6);
      doc.text(wrapped, PDF_MARGIN + 28, cursor.y);
      cursor.y += wrapped.length * 3.6 + 2;
    }
  }
}
