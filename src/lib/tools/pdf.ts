import { jsPDF } from "jspdf";
import { drawBrandedFooter, drawBrandedHeader } from "@/lib/brand/pdf";
import {
  PDF_BLUE as BLUE,
  PDF_INK as INK,
  PDF_MARGIN as MARGIN,
  PDF_MUTED as MUTED,
  PdfCursor,
  drawField as field,
  drawParagraph,
  drawSignatures as drawSignatureRow,
  formatPdfDate as formatDate,
} from "@/lib/brand/pdf-layout";
import {
  lineOutstanding,
  requestOutstanding,
  returnConditionLabel,
  toolConditionLabel,
  todayKey,
  toolRequestStatusLabel,
  type PersonSnapshot,
  type ToolRequest,
  type ToolReturnDetails,
} from "./types";

function conditionText(value: string, kind: "out" | "in") {
  if (!value) return "—";
  return kind === "in" ? returnConditionLabel(value) : toolConditionLabel(value);
}

function personCard(
  doc: jsPDF,
  title: string,
  person: PersonSnapshot,
  dateLabel: string,
  date: string,
  x: number,
  y: number,
  w: number,
  h: number
) {
  doc.setFillColor(246, 248, 253);
  doc.setDrawColor(210, 216, 236);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");
  doc.setFillColor(...BLUE);
  doc.rect(x, y + 1.5, 1.2, h - 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 150, 210);
  doc.text(title.toUpperCase(), x + 4, y + 5);

  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  const pending = !person.name;
  doc.text(pending ? "Pendiente de entrega" : person.name, x + 4, y + 10.5, {
    maxWidth: w - 8,
  });

  const rows: [string, string][] = [
    ["Puesto", person.jobTitle],
    ["Departamento", person.department],
    ["No. de empleado", person.employeeNumber],
    ...(person.phone ? ([["Teléfono", person.phone]] as [string, string][]) : []),
    [dateLabel, date],
  ];
  let rowY = y + 16;
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`${label}:`, x + 4, rowY);
    doc.setTextColor(...INK);
    doc.text(value || "—", x + 30, rowY, { maxWidth: w - 34 });
    rowY += 4.3;
  }
}

type Column = { key: string; label: string; width: number; align?: "left" | "center" };

const COLUMNS: Column[] = [
  { key: "n", label: "#", width: 7, align: "center" },
  { key: "code", label: "Código", width: 21 },
  { key: "tool", label: "Herramienta", width: 62 },
  { key: "req", label: "Solic.", width: 13, align: "center" },
  { key: "del", label: "Entr.", width: 13, align: "center" },
  { key: "ret", label: "Dev.", width: 13, align: "center" },
  { key: "pend", label: "Pend.", width: 13, align: "center" },
  { key: "out", label: "Salida", width: 20 },
  { key: "in", label: "Regreso", width: 20 },
];

function drawTableHeader(cursor: PdfCursor) {
  const { doc } = cursor;
  doc.setFillColor(...BLUE);
  doc.rect(MARGIN, cursor.y, cursor.contentW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  let x = MARGIN;
  for (const col of COLUMNS) {
    const tx = col.align === "center" ? x + col.width / 2 : x + 1.8;
    doc.text(col.label, tx, cursor.y + 4.7, { align: col.align === "center" ? "center" : "left" });
    x += col.width;
  }
  cursor.y += 7;
}

function drawLinesTable(cursor: PdfCursor, request: ToolRequest) {
  const { doc } = cursor;
  const delivered = Boolean(request.deliveredAt);
  drawTableHeader(cursor);

  request.lines.forEach((line, index) => {
    const detail = [line.toolBrand, line.toolModel].filter(Boolean).join(" ");
    const toolLines = [
      ...(doc.splitTextToSize(line.toolName, COLUMNS[2].width - 3.6) as string[]),
      ...(detail ? (doc.splitTextToSize(detail, COLUMNS[2].width - 3.6) as string[]) : []),
      ...(line.toolSerial ? [`S/N ${line.toolSerial}`] : []),
    ];
    const rowH = Math.max(8, toolLines.length * 3.6 + 3.4);
    if (cursor.ensure(rowH)) drawTableHeader(cursor);

    if (index % 2 === 1) {
      doc.setFillColor(247, 248, 252);
      doc.rect(MARGIN, cursor.y, cursor.contentW, rowH, "F");
    }
    doc.setDrawColor(226, 229, 240);
    doc.line(MARGIN, cursor.y + rowH, MARGIN + cursor.contentW, cursor.y + rowH);

    const pending = lineOutstanding(line);
    const values: Record<string, string> = {
      n: String(index + 1),
      code: line.toolCode || "—",
      req: String(line.quantityRequested),
      del: delivered ? String(line.quantityDelivered) : "—",
      ret: delivered
        ? `${line.quantityReturned}${line.quantityLost ? ` (+${line.quantityLost} ext.)` : ""}`
        : "—",
      pend: delivered ? String(pending) : "—",
      out: delivered && line.quantityDelivered ? conditionText(line.conditionOut, "out") : "—",
      in: conditionText(line.conditionIn, "in"),
    };

    let x = MARGIN;
    for (const col of COLUMNS) {
      const baseY = cursor.y + 4.6;
      if (col.key === "tool") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...INK);
        toolLines.forEach((text, i) => {
          if (i === 1) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...MUTED);
          }
          doc.text(text, x + 1.8, baseY + i * 3.6);
        });
      } else {
        const isQty = ["req", "del", "ret", "pend"].includes(col.key);
        doc.setFont("helvetica", isQty ? "bold" : "normal");
        doc.setFontSize(col.key === "ret" && line.quantityLost ? 6.5 : 8);
        doc.setTextColor(...(col.key === "pend" && pending > 0 ? ([200, 60, 40] as [number, number, number]) : INK));
        const tx = col.align === "center" ? x + col.width / 2 : x + 1.8;
        doc.text(values[col.key], tx, baseY, {
          align: col.align === "center" ? "center" : "left",
          maxWidth: col.width - 2,
        });
      }
      x += col.width;
    }
    cursor.y += rowH;
  });

  const totals = request.lines.reduce(
    (acc, line) => ({
      req: acc.req + line.quantityRequested,
      del: acc.del + line.quantityDelivered,
      ret: acc.ret + line.quantityReturned,
      lost: acc.lost + line.quantityLost,
    }),
    { req: 0, del: 0, ret: 0, lost: 0 }
  );
  cursor.ensure(7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text(
    `Total: ${totals.req} solicitadas · ${delivered ? totals.del : 0} entregadas · ${totals.ret} devueltas${totals.lost ? ` · ${totals.lost} extraviadas` : ""} · ${delivered ? requestOutstanding(request) : 0} pendientes`,
    MARGIN + cursor.contentW,
    cursor.y + 5,
    { align: "right" }
  );
  cursor.y += 9;
}

function drawReturns(cursor: PdfCursor, request: ToolRequest) {
  const returns = request.events.filter((event) => event.eventType === "devolucion");
  if (!request.deliveredAt) return;
  cursor.sectionTitle("Devoluciones");
  const { doc } = cursor;
  if (!returns.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text("Aún no se registran devoluciones.", MARGIN, cursor.y);
    cursor.y += 7;
    return;
  }
  returns.forEach((event, index) => {
    const details = event.details as ToolReturnDetails;
    const items = details.lines ?? [];
    cursor.ensure(10 + items.length * 4.2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(`${index + 1}. ${formatDate(event.createdAt, true)}`, MARGIN, cursor.y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(
      `Recibió en almacén: ${details.receivedBy || event.actor || "—"}   ·   Devolvió: ${details.returnedBy || "—"}`,
      MARGIN + 38,
      cursor.y
    );
    cursor.y += 4.6;
    doc.setTextColor(...INK);
    for (const item of items) {
      doc.text(
        `•  ${item.quantity} × ${item.toolCode ? `${item.toolCode} · ` : ""}${item.toolName} — ${returnConditionLabel(item.condition)}`,
        MARGIN + 4,
        cursor.y
      );
      cursor.y += 4.2;
    }
    if (details.notes) {
      const notes = doc.splitTextToSize(`Notas: ${details.notes}`, cursor.contentW - 4) as string[];
      cursor.ensure(notes.length * 4);
      doc.setTextColor(...MUTED);
      doc.text(notes, MARGIN + 4, cursor.y);
      cursor.y += notes.length * 4;
    }
    cursor.y += 2.5;
  });
}

function drawSignatures(cursor: PdfCursor, request: ToolRequest) {
  const lastReturn = [...request.events].reverse().find((event) => event.eventType === "devolucion");
  const receiver = (lastReturn?.details as ToolReturnDetails | undefined)?.receivedBy ?? "";
  drawSignatureRow(cursor, [
    { title: "Entrega (almacén)", name: request.deliverer.name },
    { title: "Recibe herramientas (solicitante)", name: request.requester.name },
    { title: "Recibe devolución (almacén)", name: receiver },
  ]);
}

/** Herramientas que siguen fuera del almacén, agrupadas por la persona que las tiene. */
export async function downloadToolsCustodyPdf(requests: ToolRequest[], now: Date) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const start = await drawBrandedHeader(doc, {
    title: "Resguardo de herramientas prestadas",
    rightLines: [`Corte: ${formatDate(now.toISOString(), true)}`],
  });
  const cursor = new PdfCursor(doc, start);
  const open = requests.filter((request) => requestOutstanding(request) > 0 && request.deliveredAt);

  const byPerson = new Map<string, { person: PersonSnapshot; requests: ToolRequest[] }>();
  for (const request of open) {
    const key = request.requester.username || request.requester.name;
    const entry = byPerson.get(key) ?? { person: request.requester, requests: [] };
    entry.requests.push(request);
    byPerson.set(key, entry);
  }

  if (!byPerson.size) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text("No hay herramientas prestadas en este momento.", MARGIN, cursor.y + 4);
  }

  const today = todayKey(now);
  const groups = [...byPerson.values()].sort((a, b) => a.person.name.localeCompare(b.person.name, "es"));
  for (const group of groups) {
    const pieces = group.requests.reduce((acc, request) => acc + requestOutstanding(request), 0);
    cursor.ensure(18);
    doc.setFillColor(246, 248, 253);
    doc.setDrawColor(210, 216, 236);
    doc.roundedRect(MARGIN, cursor.y, cursor.contentW, 10, 1.2, 1.2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(group.person.name || group.person.username, MARGIN + 3, cursor.y + 6.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      [group.person.jobTitle, group.person.department, `${pieces} pieza(s) en resguardo`]
        .filter(Boolean)
        .join("  ·  "),
      MARGIN + cursor.contentW - 3,
      cursor.y + 6.5,
      { align: "right" }
    );
    cursor.y += 14;

    for (const request of group.requests) {
      const overdue = Boolean(request.expectedReturnAt && request.expectedReturnAt < today);
      for (const line of request.lines) {
        const pending = lineOutstanding(line);
        if (!pending) continue;
        cursor.ensure(6);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...INK);
        doc.text(`${pending} ×`, MARGIN + 3, cursor.y);
        doc.text(`${line.toolCode ? `${line.toolCode} · ` : ""}${line.toolName}`, MARGIN + 13, cursor.y, {
          maxWidth: 88,
        });
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MUTED);
        doc.text(request.folio, MARGIN + 106, cursor.y);
        doc.text(`Entregado ${formatDate(request.deliveredAt)}`, MARGIN + 132, cursor.y);
        if (overdue) doc.setTextColor(200, 60, 40);
        doc.text(
          `Dev. ${formatDate(request.expectedReturnAt)}${overdue ? " (vencida)" : ""}`,
          MARGIN + cursor.contentW,
          cursor.y,
          { align: "right" }
        );
        cursor.y += 5;
      }
    }
    cursor.y += 4;
  }

  drawBrandedFooter(doc);
  doc.save(`resguardo-herramientas-${today}.pdf`);
}

/** Vale de préstamo de herramientas con entrega y devoluciones en el mismo folio. */
export async function downloadToolRequestPdf(request: ToolRequest) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const start = await drawBrandedHeader(doc, {
    title: "Vale de préstamo de herramientas",
    folio: request.folio,
    rightLines: [`Estatus: ${toolRequestStatusLabel(request.status)}`],
  });
  const cursor = new PdfCursor(doc, start);
  const colW = cursor.contentW / 3;

  const h1 = field(doc, "Fecha de solicitud", formatDate(request.requestedAt, true), MARGIN, cursor.y, colW - 4);
  const h2 = field(doc, "Devolución comprometida", formatDate(request.expectedReturnAt), MARGIN + colW, cursor.y, colW - 4);
  const h3 = field(
    doc,
    "Orden de servicio",
    request.serviceOrderFolio
      ? `${request.serviceOrderFolio}${request.clientName ? ` · ${request.clientName}` : ""}`
      : "Sin orden vinculada",
    MARGIN + colW * 2,
    cursor.y,
    colW - 4
  );
  cursor.y += Math.max(h1, h2, h3) + 3;
  cursor.y += field(doc, "Motivo / trabajo a realizar", request.purpose, MARGIN, cursor.y, cursor.contentW) + 4;

  const cardH = 36;
  const gap = 6;
  const cardW = (cursor.contentW - gap) / 2;
  cursor.ensure(cardH + 4);
  personCard(doc, "Solicita (biomédica)", request.requester, "Fecha", formatDate(request.requestedAt, true), MARGIN, cursor.y, cardW, cardH);
  personCard(
    doc,
    "Entrega (almacén)",
    request.deliverer,
    "Fecha de entrega",
    formatDate(request.deliveredAt, true),
    MARGIN + cardW + gap,
    cursor.y,
    cardW,
    cardH
  );
  cursor.y += cardH + 6;

  cursor.sectionTitle("Herramientas");
  drawLinesTable(cursor, request);
  drawReturns(cursor, request);

  cursor.y += 1;
  drawParagraph(cursor, "Notas de la solicitud", request.notes);
  drawParagraph(cursor, "Notas de entrega", request.deliveryNotes);
  if (request.status === "rechazada" || request.status === "cancelada") {
    drawParagraph(
      cursor,
      request.status === "rechazada" ? "Motivo del rechazo" : "Cancelación",
      `${request.closedReason || "Sin motivo registrado"}${request.closedBy ? ` (${request.closedBy})` : ""}`
    );
  }

  drawParagraph(
    cursor,
    "Compromiso de resguardo",
    "Quien recibe las herramientas se compromete a usarlas solo para el trabajo indicado, cuidarlas y devolverlas a almacén en la fecha comprometida y en las mismas condiciones en que se entregaron. Cualquier daño o extravío debe reportarse al momento de la devolución."
  );
  drawSignatures(cursor, request);

  drawBrandedFooter(doc);
  doc.save(`${request.folio}-vale-herramientas.pdf`);
}
