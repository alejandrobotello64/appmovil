import { jsPDF } from "jspdf";
import {
  drawBrandedFooter,
  drawBrandedHeader,
  drawCompanySealBlock,
} from "@/lib/brand/pdf";
import { getServiceOrder } from "@/lib/service-orders/storage";
import { findStaffProfile, type StaffProfile } from "@/lib/users/staff";
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
    this.ensure(8);
    const { doc } = this;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...BLUE);
    doc.text(title.toUpperCase(), MARGIN, this.y);
    doc.setDrawColor(210, 216, 236);
    doc.line(MARGIN, this.y + 1.2, this.pageW - MARGIN, this.y + 1.2);
    this.y += 5;
  }
}

function kv(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...MUTED);
  doc.text(label, x, y);
  const labelW = Math.min(doc.getTextWidth(`${label}  `), width * 0.42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(value || "—", width - labelW) as string[];
  doc.text(lines.slice(0, 2), x + labelW, y);
  return Math.max(3.6, Math.min(lines.length, 2) * 3.2);
}

function personCard(
  doc: jsPDF,
  title: string,
  subtitle: string,
  name: string,
  profile: StaffProfile | null,
  x: number,
  y: number,
  w: number,
  h: number
) {
  doc.setFillColor(246, 248, 253);
  doc.setDrawColor(210, 216, 236);
  doc.roundedRect(x, y, w, h, 1.2, 1.2, "FD");
  doc.setFillColor(...BLUE);
  doc.rect(x, y + 1.1, 1.1, h - 2.2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...BLUE);
  doc.text(title.toUpperCase(), x + 4, y + 4.6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...MUTED);
  doc.text(subtitle, x + 4, y + 8.2, { maxWidth: w - 8 });

  const displayName = profile?.fullName || name || "—";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text(displayName, x + 4, y + 13, { maxWidth: w - 8 });

  const rows: [string, string][] = [
    ["Puesto", [profile?.jobTitle, profile?.department].filter(Boolean).join(" · ")],
    ["No. emp.", profile?.employeeNumber ?? ""],
    ["Teléfono", profile?.phone ?? ""],
    ["Correo", profile?.email ?? ""],
  ];
  let rowY = y + 17.2;
  for (const [label, value] of rows) {
    kv(doc, label, value || "—", x + 4, rowY, w - 8);
    rowY += 3.6;
  }
}

function noteBlock(cursor: Cursor, title: string, text: string) {
  if (!text.trim()) return;
  cursor.ensure(10);
  const { doc } = cursor;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...BLUE);
  doc.text(title, MARGIN, cursor.y);
  cursor.y += 3.2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(text.trim(), cursor.contentW) as string[];
  for (const line of lines.slice(0, 4)) {
    cursor.ensure(4);
    doc.text(line, MARGIN, cursor.y);
    cursor.y += 3.4;
  }
  cursor.y += 2;
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
  cursor.ensure(32);
  const { doc } = cursor;
  const gap = 4;
  const w = (cursor.contentW - gap * 2) / 3;
  const h = 26;
  const boxes = [
    { title: "Solicitó (servicio)", name: req.requestedBy, date: req.requestedAt },
    { title: "Surtido (almacén)", name: req.fulfilledBy, date: req.fulfilledAt },
    { title: "Recibido en servicio", name: "", date: "" },
  ];
  boxes.forEach((box, index) => {
    const x = MARGIN + index * (w + gap);
    doc.setDrawColor(190, 190, 198);
    doc.setFillColor(252, 252, 254);
    doc.roundedRect(x, cursor.y, w, h, 1.2, 1.2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...BLUE);
    doc.text(box.title, x + 3, cursor.y + 4);
    doc.setDrawColor(160, 160, 170);
    doc.line(x + 8, cursor.y + 14, x + w - 8, cursor.y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...INK);
    doc.text(box.name || "Nombre y firma", x + w / 2, cursor.y + 17.5, {
      align: "center",
      maxWidth: w - 8,
    });
    doc.setTextColor(...MUTED);
    doc.setFontSize(6);
    doc.text(
      box.date ? formatDateTime(box.date) : "Fecha",
      x + w / 2,
      cursor.y + 21.5,
      { align: "center" }
    );
  });
  cursor.y += h + 4;
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

  const [advisorProfile, technicianProfile] = await Promise.all([
    order?.advisor ? findStaffProfile(order.advisor) : Promise.resolve(null),
    order?.technician ? findStaffProfile(order.technician) : Promise.resolve(null),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const generated = new Date().toLocaleString("es-MX");
  let y = await drawBrandedHeader(doc, {
    title: "Orden de surtimiento de servicio",
    folio: requisition.folio,
    rightLines: [requisitionStatusLabel(requisition.status), generated],
  });

  const cursor = new Cursor(doc, y);

  const pad = 3;
  const gap = 3;
  const cardW = (cursor.contentW - gap) / 2;
  const cardH = 33.5;
  const orderH = 16.5;

  doc.setFillColor(246, 248, 253);
  doc.setDrawColor(210, 216, 236);
  doc.roundedRect(MARGIN, cursor.y, cursor.contentW, orderH, 1.2, 1.2, "FD");
  doc.setFillColor(...BLUE);
  doc.rect(MARGIN, cursor.y + 1, 1.1, orderH - 2, "F");

  let rowY = cursor.y + 4.2;
  const left = MARGIN + pad;
  const mid = MARGIN + cursor.contentW / 3;
  const right = MARGIN + (cursor.contentW / 3) * 2;
  const colW = cursor.contentW / 3 - pad;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...BLUE);
  doc.text("ORDEN DE SERVICIO", left, rowY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text(
    requisition.folio,
    MARGIN + cursor.contentW - pad,
    rowY,
    { align: "right" }
  );
  rowY += 4.2;
  kv(
    doc,
    "Folio OS",
    order?.folio || requisition.serviceOrderFolio || "—",
    left,
    rowY,
    colW
  );
  kv(
    doc,
    "Tipo",
    order
      ? `${serviceTypeLabel(order.serviceType)} · ${serviceOrderStatusLabel(order.status)}`
      : "—",
    mid,
    rowY,
    colW
  );
  kv(
    doc,
    "Cliente",
    order?.clientName || requisition.clientName || "—",
    right,
    rowY,
    colW
  );
  rowY += 3.6;
  const equipmentLine = [
    order?.equipmentName || requisition.equipmentName,
    order?.equipmentBrand,
    order?.equipmentModel,
    order?.equipmentSerial,
  ]
    .filter(Boolean)
    .join(" · ");
  kv(doc, "Equipo", equipmentLine || "—", left, rowY, cursor.contentW - pad * 2);
  cursor.y += orderH + 2.8;

  cursor.ensure(cardH + 4);
  personCard(
    doc,
    "Asesor de servicio",
    "Responsable comercial / autorización",
    order?.advisor || "",
    advisorProfile,
    MARGIN,
    cursor.y,
    cardW,
    cardH
  );
  personCard(
    doc,
    "Técnico que recibe",
    "Recibe el surtimiento en servicio",
    order?.technician || "",
    technicianProfile,
    MARGIN + cardW + gap,
    cursor.y,
    cardW,
    cardH
  );
  cursor.y += cardH + 3.5;

  cursor.section("Solicitud a almacén");
  const col = (cursor.contentW - 6) / 3;
  let h5 = kv(doc, "Solicitó", requisition.requestedBy || "—", MARGIN, cursor.y, col);
  h5 = Math.max(
    h5,
    kv(doc, "Fecha", formatDateTime(requisition.requestedAt), MARGIN + col + 3, cursor.y, col)
  );
  h5 = Math.max(
    h5,
    kv(
      doc,
      "Estatus",
      requisitionStatusLabel(requisition.status),
      MARGIN + (col + 3) * 2,
      cursor.y,
      col
    )
  );
  cursor.y += h5 + 0.4;
  let h6 = kv(
    doc,
    "Surtido por",
    requisition.fulfilledBy || "Pendiente",
    MARGIN,
    cursor.y,
    col
  );
  h6 = Math.max(
    h6,
    kv(
      doc,
      "Fecha surtido",
      formatDateTime(requisition.fulfilledAt),
      MARGIN + col + 3,
      cursor.y,
      col
    )
  );
  h6 = Math.max(
    h6,
    kv(doc, "Partidas", String(requisition.lines.length), MARGIN + (col + 3) * 2, cursor.y, col)
  );
  cursor.y += h6 + 3;

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
