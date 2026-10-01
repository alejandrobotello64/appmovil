import { jsPDF } from "jspdf";
import {
  drawBrandedFooter,
  drawBrandedHeader,
  drawCompanySealBlock,
} from "@/lib/brand/pdf";
import { getServiceOrder } from "@/lib/service-orders/storage";
import {
  serviceOrderStatusLabel,
  serviceTypeLabel,
  type ServiceOrder,
} from "@/lib/service-orders/types";
import {
  requisitionLineStatusLabel,
  requisitionStatusLabel,
  type ServiceOrderRequisition,
} from "@/lib/service-orders/requisitions";

const MARGIN = 14;
const BLUE: [number, number, number] = [59, 70, 165];
const INK: [number, number, number] = [30, 30, 30];
const MUTED: [number, number, number] = [110, 110, 110];

function formatDateTime(value: string) {
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
    hour: "2-digit",
    minute: "2-digit",
  });
}

class Cursor {
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
    return this.pageW - MARGIN * 2;
  }
  ensure(height: number) {
    if (this.y + height > this.pageH - 18) {
      this.doc.addPage();
      this.y = 16;
    }
  }
  section(title: string) {
    this.ensure(12);
    const { doc } = this;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...BLUE);
    doc.text(title.toUpperCase(), MARGIN, this.y);
    doc.setDrawColor(210, 216, 236);
    doc.line(MARGIN, this.y + 1.6, this.pageW - MARGIN, this.y + 1.6);
    this.y += 7;
  }
}

function field(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(label, x, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(value || "—", width) as string[];
  doc.text(lines, x, y + 4);
  return 4 + lines.length * 4;
}

function noteBlock(cursor: Cursor, title: string, text: string) {
  if (!text.trim()) return;
  cursor.ensure(16);
  const { doc } = cursor;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BLUE);
  doc.text(title, MARGIN, cursor.y);
  cursor.y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(text.trim(), cursor.contentW) as string[];
  for (const line of lines) {
    cursor.ensure(5);
    doc.text(line, MARGIN, cursor.y);
    cursor.y += 4;
  }
  cursor.y += 3;
}

type Column = {
  key: string;
  label: string;
  width: number;
  align?: "left" | "center" | "right";
};

const COLUMNS: Column[] = [
  { key: "n", label: "#", width: 8, align: "center" },
  { key: "sku", label: "SKU", width: 34 },
  { key: "desc", label: "Descripción", width: 62 },
  { key: "unit", label: "Unid.", width: 14, align: "center" },
  { key: "req", label: "Pedido", width: 16, align: "center" },
  { key: "ok", label: "Surtido", width: 16, align: "center" },
  { key: "pend", label: "Pend.", width: 16, align: "center" },
  { key: "st", label: "Estatus", width: 16, align: "center" },
];

function cellX(col: Column, x: number) {
  if (col.align === "center") return x + col.width / 2;
  if (col.align === "right") return x + col.width - 1.4;
  return x + 1.4;
}

function drawLines(cursor: Cursor, req: ServiceOrderRequisition) {
  const { doc } = cursor;
  cursor.ensure(16);
  doc.setFillColor(...BLUE);
  doc.rect(MARGIN, cursor.y, cursor.contentW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  let x = MARGIN;
  for (const col of COLUMNS) {
    doc.text(col.label, cellX(col, x), cursor.y + 4.6, {
      align: col.align ?? "left",
    });
    x += col.width;
  }
  cursor.y += 7;

  req.lines.forEach((line, index) => {
    const pending = Math.max(0, line.quantityRequested - line.quantityFulfilled);
    const desc = [
      line.description || line.productName || "—",
      line.productName && line.productName !== line.description
        ? line.productName
        : "",
      line.notes ? `Nota: ${line.notes}` : "",
    ].filter(Boolean);
    const descLines = doc.splitTextToSize(desc.join(" · "), COLUMNS[2].width - 3) as string[];
    const rowH = Math.max(8, descLines.length * 3.6 + 4);
    cursor.ensure(rowH + 2);
    if (index % 2 === 1) {
      doc.setFillColor(246, 248, 253);
      doc.rect(MARGIN, cursor.y, cursor.contentW, rowH, "F");
    }
    const values: Record<string, string | string[]> = {
      n: String(index + 1),
      sku: line.productSku || "—",
      desc: descLines,
      unit: line.unit || "pza",
      req: String(line.quantityRequested),
      ok: String(line.quantityFulfilled),
      pend: String(pending),
      st: requisitionLineStatusLabel(line.lineStatus),
    };
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK);
    x = MARGIN;
    for (const col of COLUMNS) {
      const value = values[col.key];
      const textY = cursor.y + 4.4;
      if (Array.isArray(value)) {
        doc.text(value, cellX(col, x), textY);
      } else {
        doc.text(value, cellX(col, x), textY, {
          align: col.align ?? "left",
          maxWidth: col.width - 2.4,
        });
      }
      x += col.width;
    }
    cursor.y += rowH;
  });

  const requested = req.lines.reduce((sum, line) => sum + line.quantityRequested, 0);
  const fulfilled = req.lines.reduce((sum, line) => sum + line.quantityFulfilled, 0);
  const pending = Math.max(0, requested - fulfilled);
  cursor.ensure(10);
  doc.setFillColor(243, 245, 251);
  doc.rect(MARGIN, cursor.y, cursor.contentW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BLUE);
  doc.text(
    `${req.lines.length} partida(s) · Pedido ${requested} · Surtido ${fulfilled} · Pendiente ${pending}`,
    MARGIN + 2,
    cursor.y + 5.2
  );
  cursor.y += 12;
}

function drawSignatures(cursor: Cursor, req: ServiceOrderRequisition) {
  cursor.ensure(42);
  const { doc } = cursor;
  const gap = 4;
  const w = (cursor.contentW - gap * 2) / 3;
  const h = 34;
  const boxes = [
    { title: "Solicitó (servicio)", name: req.requestedBy, date: req.requestedAt },
    { title: "Surtido (almacén)", name: req.fulfilledBy, date: req.fulfilledAt },
    { title: "Recibido en servicio", name: "", date: "" },
  ];
  boxes.forEach((box, index) => {
    const x = MARGIN + index * (w + gap);
    doc.setDrawColor(190, 190, 198);
    doc.setFillColor(252, 252, 254);
    doc.roundedRect(x, cursor.y, w, h, 1.4, 1.4, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...BLUE);
    doc.text(box.title, x + 3, cursor.y + 5);
    doc.setDrawColor(160, 160, 170);
    doc.line(x + 8, cursor.y + 20, x + w - 8, cursor.y + 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK);
    doc.text(box.name || "Nombre y firma", x + w / 2, cursor.y + 24, {
      align: "center",
      maxWidth: w - 8,
    });
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.text(
      box.date ? formatDateTime(box.date) : "Fecha",
      x + w / 2,
      cursor.y + 29,
      { align: "center" }
    );
  });
  cursor.y += h + 6;
}

/** PDF de la orden de surtimiento (solicitud de material de una OS). */
export async function downloadServiceRequisitionPdf(
  requisition: ServiceOrderRequisition
) {
  let order: ServiceOrder | null = null;
  try {
    order = await getServiceOrder(requisition.serviceOrderId);
  } catch {
    order = null;
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const generated = new Date().toLocaleString("es-MX");
  let y = await drawBrandedHeader(doc, {
    title: "Orden de surtimiento de servicio",
    folio: requisition.folio,
    rightLines: [requisitionStatusLabel(requisition.status), generated],
  });

  const cursor = new Cursor(doc, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `Material pedido desde ${requisition.serviceOrderFolio || order?.folio || "orden de servicio"} para trabajo en campo.`,
    MARGIN,
    cursor.y
  );
  cursor.y += 8;

  cursor.section("Orden de servicio");
  const col = cursor.contentW / 3 - 2;
  let h1 = field(
    doc,
    "Folio OS",
    order?.folio || requisition.serviceOrderFolio || "—",
    MARGIN,
    cursor.y,
    col
  );
  h1 = Math.max(
    h1,
    field(
      doc,
      "Tipo / estatus",
      order
        ? `${serviceTypeLabel(order.serviceType)} · ${serviceOrderStatusLabel(order.status)}`
        : "—",
      MARGIN + col + 3,
      cursor.y,
      col
    )
  );
  h1 = Math.max(
    h1,
    field(
      doc,
      "Prioridad / garantía",
      order
        ? `${order.priority === "urgente" ? "Urgente" : "Normal"}${order.underWarranty ? " · Garantía" : ""}`
        : "—",
      MARGIN + (col + 3) * 2,
      cursor.y,
      col
    )
  );
  cursor.y += h1 + 2;
  let h2 = field(doc, "Técnico", order?.technician || "—", MARGIN, cursor.y, col);
  h2 = Math.max(
    h2,
    field(doc, "Asesor", order?.advisor || "—", MARGIN + col + 3, cursor.y, col)
  );
  h2 = Math.max(
    h2,
    field(
      doc,
      "Recepción",
      formatDateTime(order?.receptionAt || ""),
      MARGIN + (col + 3) * 2,
      cursor.y,
      col
    )
  );
  cursor.y += h2 + 4;

  cursor.section("Cliente");
  let h3 = field(
    doc,
    "Cliente",
    order?.clientName || requisition.clientName || "—",
    MARGIN,
    cursor.y,
    col
  );
  h3 = Math.max(
    h3,
    field(doc, "Contacto", order?.contactName || "—", MARGIN + col + 3, cursor.y, col)
  );
  h3 = Math.max(
    h3,
    field(
      doc,
      "Teléfono / correo",
      [order?.contactPhone, order?.contactEmail].filter(Boolean).join(" · ") || "—",
      MARGIN + (col + 3) * 2,
      cursor.y,
      col
    )
  );
  cursor.y += h3 + 4;

  cursor.section("Equipo");
  let h4 = field(
    doc,
    "Equipo",
    order?.equipmentName || requisition.equipmentName || "—",
    MARGIN,
    cursor.y,
    col
  );
  h4 = Math.max(
    h4,
    field(
      doc,
      "Marca / modelo",
      [order?.equipmentBrand, order?.equipmentModel].filter(Boolean).join(" · ") ||
        "—",
      MARGIN + col + 3,
      cursor.y,
      col
    )
  );
  h4 = Math.max(
    h4,
    field(
      doc,
      "Serie / ubicación",
      [order?.equipmentSerial, order?.equipmentLocation].filter(Boolean).join(" · ") ||
        "—",
      MARGIN + (col + 3) * 2,
      cursor.y,
      col
    )
  );
  cursor.y += h4 + 2;
  if (order?.linkedEquipment?.length) {
    const linked = order.linkedEquipment
      .map(
        (item) =>
          `${item.relationLabel}${item.equipmentName ? `: ${item.equipmentName}` : ""}${
            item.equipmentSerial ? ` (${item.equipmentSerial})` : ""
          }`
      )
      .join(" · ");
    cursor.y += field(doc, "Equipos ligados", linked, MARGIN, cursor.y, cursor.contentW) + 2;
  }
  cursor.y += 2;

  cursor.section("Solicitud a almacén");
  let h5 = field(doc, "Solicitó", requisition.requestedBy || "—", MARGIN, cursor.y, col);
  h5 = Math.max(
    h5,
    field(
      doc,
      "Fecha de solicitud",
      formatDateTime(requisition.requestedAt),
      MARGIN + col + 3,
      cursor.y,
      col
    )
  );
  h5 = Math.max(
    h5,
    field(
      doc,
      "Estatus de surtido",
      requisitionStatusLabel(requisition.status),
      MARGIN + (col + 3) * 2,
      cursor.y,
      col
    )
  );
  cursor.y += h5 + 2;
  let h6 = field(
    doc,
    "Surtido por",
    requisition.fulfilledBy || "Pendiente",
    MARGIN,
    cursor.y,
    col
  );
  h6 = Math.max(
    h6,
    field(
      doc,
      "Fecha de surtido",
      formatDateTime(requisition.fulfilledAt),
      MARGIN + col + 3,
      cursor.y,
      col
    )
  );
  h6 = Math.max(
    h6,
    field(
      doc,
      "Partidas",
      String(requisition.lines.length),
      MARGIN + (col + 3) * 2,
      cursor.y,
      col
    )
  );
  cursor.y += h6 + 4;

  if (order?.faultReported) {
    noteBlock(cursor, "Falla / trabajo reportado", order.faultReported);
  }

  cursor.section("Material a surtir");
  drawLines(cursor, requisition);

  noteBlock(cursor, "Notas de la solicitud", requisition.notes);
  noteBlock(cursor, "Notas de almacén", requisition.warehouseNotes);

  cursor.section("Firmas");
  drawSignatures(cursor, requisition);

  await drawCompanySealBlock(doc, cursor.y);
  drawBrandedFooter(
    doc,
    "Orden de surtimiento de material para orden de servicio · MAS almacén"
  );
  doc.save(`${requisition.folio}-surtimiento.pdf`);
}
