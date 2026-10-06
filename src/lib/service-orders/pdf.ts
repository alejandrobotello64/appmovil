import { jsPDF } from "jspdf";
import {
  drawBrandedFooter,
  drawBrandedHeader,
  drawCompanySealBlock,
  drawSealImage,
  loadCompanySealDataUrl,
} from "@/lib/brand/pdf";
import { biomedicalInstrumentTypeLabel } from "@/lib/biomedical-instruments/types";
import { findStaffProfile, type StaffProfile } from "@/lib/users/staff";
import {
  checklistItemsByKind,
  checklistResultLabel,
  formatValidInterval,
  IMAGE_STAGES,
  clampPercent,
  computeServiceTotals,
  lineAmount,
  pricingFromOrder,
  serviceLineKindLabel,
  serviceOrderStatusLabel,
  serviceTaxLabel,
  serviceTypeLabel,
  type ServiceOrder,
  type ServiceOrderChecklistItem,
  type ServiceOrderImage,
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

function ensureSpace(doc: jsPDF, y: number, need = 20) {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + need < pageH - 14) return y;
  doc.addPage();
  return 18;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo leer la imagen."));
    image.src = src;
  });
}

type PreparedPhoto = {
  dataUrl: string;
  width: number;
  height: number;
};

async function fetchImageBlob(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

async function drawSourceToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number
): Promise<PreparedPhoto | null> {
  const canvas = document.createElement("canvas");
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(width, height, 1));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.86),
    width: canvas.width,
    height: canvas.height,
  };
}

async function loadPdfJpeg(url: string): Promise<PreparedPhoto | null> {
  if (!url || typeof document === "undefined") return null;
  try {
    const blob = await fetchImageBlob(url);
    if (blob && typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(blob, {
          imageOrientation: "from-image",
        } as ImageBitmapOptions);
        const prepared = await drawSourceToCanvas(
          bitmap,
          bitmap.width,
          bitmap.height
        );
        bitmap.close();
        if (prepared) return prepared;
      } catch {
        // Fallback to HTMLImageElement below.
      }
    }
    const src = blob ? await blobToDataUrl(blob) : url;
    const image = await loadHtmlImage(src);
    return drawSourceToCanvas(image, image.width, image.height);
  } catch {
    return null;
  }
}

function containSize(
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number
) {
  const scale = Math.min(maxW / Math.max(srcW, 1), maxH / Math.max(srcH, 1));
  return {
    width: Math.max(10, srcW * scale),
    height: Math.max(10, srcH * scale),
  };
}

function imageStageLabel(stage: string) {
  return IMAGE_STAGES.find((item) => item.id === stage)?.label ?? stage;
}

function photoCaption(image: ServiceOrderImage, showStage?: boolean) {
  return [
    showStage ? imageStageLabel(image.stage) : "",
    image.caption,
  ]
    .filter(Boolean)
    .join(" · ");
}

function drawPhotoCell(
  doc: jsPDF,
  prepared: PreparedPhoto | null,
  caption: string,
  x: number,
  y: number,
  maxW: number,
  maxH: number
) {
  const captionH = caption ? 5 : 0;
  if (!prepared) {
    doc.setDrawColor(220, 224, 232);
    doc.setFillColor(248, 249, 252);
    doc.rect(x, y, maxW, 18, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 90, 90);
    doc.text("Foto no disponible", x + 3, y + 11);
    if (caption) {
      doc.text(caption, x, y + 22);
      return 18 + captionH + 3;
    }
    return 21;
  }

  const fitted = containSize(prepared.width, prepared.height, maxW, maxH);
  const xPad = x + (maxW - fitted.width) / 2;
  doc.setDrawColor(226, 230, 238);
  doc.setFillColor(252, 252, 254);
  doc.rect(xPad - 0.6, y - 0.6, fitted.width + 1.2, fitted.height + 1.2, "FD");
  try {
    doc.addImage(
      prepared.dataUrl,
      "JPEG",
      xPad,
      y,
      fitted.width,
      fitted.height,
      undefined,
      "FAST"
    );
  } catch {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 90, 90);
    doc.text("No se pudo incrustar la foto", xPad + 2, y + fitted.height / 2);
  }
  if (caption) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(70, 70, 70);
    const lines = doc.splitTextToSize(caption, maxW);
    doc.text(lines, x, y + fitted.height + 4);
    return fitted.height + 4 + lines.length * 3.2 + 2;
  }
  return fitted.height + 4;
}

async function drawOrderPhotos(
  doc: jsPDF,
  order: ServiceOrder,
  y: number,
  options?: { stages?: string[]; title?: string; showStage?: boolean }
) {
  const wanted = options?.stages;
  const photos = (order.images ?? []).filter((image) =>
    wanted ? wanted.includes(image.stage) : true
  );
  if (!photos.length) return y;

  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const usableW = pageW - margin * 2;
  const cols = 2;
  const gap = 5;
  const cellW = (usableW - gap) / cols;
  const maxPhotoH = 48;

  y = ensureSpace(doc, y, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(options?.title ?? "Evidencia fotográfica", margin, y);
  y += 6;

  for (let i = 0; i < photos.length; i += cols) {
    const row = photos.slice(i, i + cols);
    const prepared = await Promise.all(
      row.map(async (photo) => ({
        photo,
        image: await loadPdfJpeg(photo.fileUrl),
        caption: photoCaption(photo, options?.showStage),
      }))
    );
    const heights = prepared.map((item) => {
      if (!item.image) return item.caption ? 26 : 21;
      const fitted = containSize(
        item.image.width,
        item.image.height,
        cellW,
        maxPhotoH
      );
      const captionLines = item.caption
        ? Math.max(1, Math.ceil(item.caption.length / 42))
        : 0;
      return fitted.height + (captionLines ? 4 + captionLines * 3.2 : 0) + 4;
    });
    const rowH = Math.max(...heights);
    y = ensureSpace(doc, y, rowH + 4);
    prepared.forEach((item, index) => {
      const x = margin + index * (cellW + gap);
      drawPhotoCell(doc, item.image, item.caption, x, y, cellW, maxPhotoH);
    });
    y += rowH + 3;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);
  doc.text(`${photos.length} foto(s).`, margin, y);
  return y + 6;
}

function drawChecklistSection(
  doc: jsPDF,
  y: number,
  title: string,
  items: ServiceOrderChecklistItem[]
) {
  if (!items.length) return y;
  const margin = 14;
  y = ensureSpace(doc, y, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(title, margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (const item of items) {
    const interval = formatValidInterval(item.minValue, item.maxValue, item.unit);
    const measured = item.measuredValue.trim();
    const extra = [
      interval ? `Intervalo ${interval}` : "",
      measured ? `Valor ${measured}${item.unit ? ` ${item.unit}` : ""}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    y = ensureSpace(doc, y, extra ? 10 : 6);
    doc.setTextColor(40, 40, 40);
    doc.text(`• ${item.label}`, margin, y);
    doc.text(checklistResultLabel(item.result), 160, y);
    y += 4.5;
    if (extra) {
      doc.setTextColor(90, 90, 90);
      doc.text(extra, margin + 4, y);
      y += 4.5;
    }
  }
  return y + 4;
}

function staffLine(order: ServiceOrder) {
  const parts = [
    order.technician ? `Técnico: ${order.technician}` : null,
    order.advisor ? `Asesor: ${order.advisor}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "";
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
    order.contractNumber ? `Contrato: ${order.contractNumber}` : undefined,
  ].filter(Boolean) as string[];

  const n = Math.max(left.length, right.length, 1);
  for (let i = 0; i < n; i++) {
    if (left[i]) doc.text(left[i], margin, y + i * 4.5);
    if (right[i]) doc.text(right[i], pageW / 2, y + i * 4.5);
  }
  y = y + n * 4.5 + 4;

  const linked = order.linkedEquipment ?? [];
  if (linked.length) {
    y = ensureSpace(doc, y, 10 + linked.length * 4.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text("Equipos ligados", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    for (const item of linked) {
      y = ensureSpace(doc, y, 6);
      const parts = [
        item.relationLabel,
        item.equipmentName,
        [item.equipmentBrand, item.equipmentModel].filter(Boolean).join(" "),
        item.equipmentSerial ? `Serie ${item.equipmentSerial}` : "",
      ].filter(Boolean);
      doc.text(`• ${parts.join(" · ")}`, margin, y);
      y += 4.5;
    }
    y += 2;
  }

  const instruments = order.instruments ?? [];
  if (instruments.length) {
    y = ensureSpace(doc, y, 10 + instruments.length * 4.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text("Simuladores / analizadores usados", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    for (const item of instruments) {
      y = ensureSpace(doc, y, 6);
      const parts = [
        biomedicalInstrumentTypeLabel(item.instrumentType),
        item.instrumentName,
        [item.instrumentBrand, item.instrumentModel].filter(Boolean).join(" "),
        item.instrumentSerial ? `Serie ${item.instrumentSerial}` : "",
      ].filter(Boolean);
      doc.text(`• ${parts.join(" · ")}`, margin, y);
      y += 4.5;
    }
    y += 2;
  }

  return y + 2;
}

function drawLinesTable(
  doc: jsPDF,
  order: ServiceOrder,
  y: number,
  options?: { includePrices?: boolean }
) {
  const includePrices = options?.includePrices ?? order.showPricesInPdf;
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
  doc.text("Cant", pageW - margin - (includePrices ? 48 : 8), y, {
    align: includePrices ? "left" : "right",
  });
  if (includePrices) {
    doc.text("P. unit.", pageW - margin - 32, y);
    doc.text("Importe", pageW - margin, y, { align: "right" });
  }
  y += 7;

  doc.setFont("helvetica", "normal");
  order.lines.forEach((line, idx) => {
    y = ensureSpace(doc, y, 10);
    const desc = doc.splitTextToSize(
      line.description || "—",
      includePrices ? 70 : 110
    );
    doc.text(String(idx + 1), margin + 1, y);
    doc.text(serviceLineKindLabel(line.lineKind).slice(0, 10), margin + 8, y);
    doc.text(desc, margin + 32, y);
    doc.text(
      String(line.quantity),
      pageW - margin - (includePrices ? 48 : 8),
      y,
      { align: includePrices ? "left" : "right" }
    );
    if (includePrices) {
      doc.text(money(line.unitPrice), pageW - margin - 32, y);
      doc.text(money(lineAmount(line)), pageW - margin, y, { align: "right" });
      const lineDiscount = clampPercent(line.discountPercent);
      if (lineDiscount > 0) {
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text(`Desc. ${Number(lineDiscount.toFixed(2))}%`, pageW - margin, y + 3.5, {
          align: "right",
        });
        doc.setFontSize(8);
        doc.setTextColor(40, 40, 40);
      }
    }
    y += Math.max(desc.length * 4, 5) + 2;
  });

  if (!includePrices) return y + 6;
  return drawTotalsSummary(doc, order, y + 2);
}

function drawTotalsSummary(doc: jsPDF, order: ServiceOrder, y: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const totals = computeServiceTotals(order.lines, pricingFromOrder(order));
  const pct = (value: number) => `${Number(value.toFixed(4))}%`;
  const rows: { label: string; value: string; bold?: boolean }[] = [
    { label: "Importe de partidas", value: money(totals.linesGross) },
  ];
  if (totals.lineDiscounts > 0) {
    rows.push({ label: "Descuentos por partida", value: `-${money(totals.lineDiscounts)}` });
  }
  if (totals.discountAmount > 0) {
    rows.push({
      label:
        totals.discountPercent > 0
          ? `Descuento general (${pct(totals.discountPercent)})`
          : "Descuento general",
      value: `-${money(totals.discountAmount)}`,
    });
  }
  for (const charge of order.extraCharges.filter((c) => c.taxable && c.amount > 0)) {
    rows.push({ label: charge.label || "Cargo adicional", value: money(charge.amount) });
  }
  rows.push({ label: "Subtotal", value: money(totals.subtotal), bold: true });
  rows.push({ label: serviceTaxLabel(totals), value: money(totals.taxAmount) });
  for (const charge of order.extraCharges.filter((c) => !c.taxable && c.amount > 0)) {
    rows.push({
      label: `${charge.label || "Cargo adicional"} (sin IVA)`,
      value: money(charge.amount),
    });
  }
  if (totals.retentionIsr > 0) {
    rows.push({
      label: `Retención ISR (${pct(totals.retentionIsrPercent)})`,
      value: `-${money(totals.retentionIsr)}`,
    });
  }
  if (totals.retentionIva > 0) {
    rows.push({
      label: `Retención IVA (${pct(totals.retentionIvaPercent)})`,
      value: `-${money(totals.retentionIva)}`,
    });
  }

  y = ensureSpace(doc, y, rows.length * 5 + 14);
  const labelX = pageW - margin - 38;
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  for (const row of rows) {
    doc.setFont("helvetica", row.bold ? "bold" : "normal");
    doc.text(row.label, labelX, y, { align: "right" });
    doc.text(row.value, pageW - margin, y, { align: "right" });
    y += 5;
  }
  doc.setDrawColor(200, 200, 210);
  doc.line(labelX - 50, y - 2.5, pageW - margin, y - 2.5);
  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total", labelX, y, { align: "right" });
  doc.text(money(totals.total), pageW - margin, y, { align: "right" });
  doc.setFontSize(8);
  return y + 8;
}

function drawBlankField(doc: jsPDF, label: string, x: number, y: number, width: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);
  doc.text(label, x, y);
  doc.setDrawColor(180, 180, 188);
  doc.line(x + 22, y + 0.8, x + width, y + 0.8);
}

type SignatureBox =
  | { kind: "blank"; title: string; fields?: string[] }
  | { kind: "technician"; name: string; profile: StaffProfile | null };

const SIGNATURE_BOX_H = 50;
const SIGNATURE_BLOCK_H = SIGNATURE_BOX_H + 19;

async function technicianBox(order: ServiceOrder): Promise<SignatureBox> {
  const name = order.technician.trim();
  const profile = name ? await findStaffProfile(name) : null;
  return { kind: "technician", name, profile };
}

function fitText(doc: jsPDF, text: string, width: number) {
  const [first] = doc.splitTextToSize(text, width) as string[];
  return first ?? "";
}

function drawTechnicianBox(
  doc: jsPDF,
  box: Extract<SignatureBox, { kind: "technician" }>,
  x: number,
  y: number,
  w: number
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(59, 70, 165);
  doc.text("Por Medical Advanced Supplies", x + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(110, 110, 110);
  doc.text("Técnico que realiza el servicio", x + 4, y + 10);

  const profile = box.profile;
  const puesto = [profile?.jobTitle, profile?.department].filter(Boolean).join(" · ");
  const rows: [string, string][] = [
    ["Nombre", profile?.fullName || box.name || ""],
    ["Puesto", puesto],
    ["No. empleado", profile?.employeeNumber ?? ""],
    ["Teléfono", profile?.phone ?? ""],
    ["Correo", profile?.email ?? ""],
  ];

  const labelW = 19;
  let rowY = y + 15.5;
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text(label, x + 4, rowY);
    if (value) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(35, 35, 35);
      doc.text(fitText(doc, value, w - labelW - 8), x + 4 + labelW, rowY);
    } else {
      doc.setDrawColor(200, 200, 208);
      doc.line(x + 4 + labelW, rowY + 0.8, x + w - 4, rowY + 0.8);
    }
    rowY += 4.4;
  }

  doc.setDrawColor(150, 150, 160);
  doc.line(x + 4, y + SIGNATURE_BOX_H - 6, x + w - 4, y + SIGNATURE_BOX_H - 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(110, 110, 110);
  doc.text("Firma del técnico", x + w / 2, y + SIGNATURE_BOX_H - 2.5, { align: "center" });
}

function drawSignatureBoxes(
  doc: jsPDF,
  y: number,
  heading: string,
  note: string,
  boxes: SignatureBox[]
) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const gap = 5;
  const weight = (box: SignatureBox) =>
    box.kind === "technician" && boxes.length > 2 ? 1.35 : 1;
  const unit =
    (pageW - margin * 2 - gap * (boxes.length - 1)) /
    boxes.reduce((sum, box) => sum + weight(box), 0);

  y = ensureSpace(doc, y, SIGNATURE_BLOCK_H);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(heading, margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(note, margin, y);
  y += 5;

  let x = margin;
  boxes.forEach((box) => {
    const boxW = unit * weight(box);
    const boxX = x;
    x += boxW + gap;
    drawSignatureBox(doc, box, boxX, y, boxW);
  });

  return y + SIGNATURE_BOX_H + 8;
}

function drawSignatureBox(doc: jsPDF, box: SignatureBox, x: number, y: number, boxW: number) {
  doc.setDrawColor(210, 214, 222);
  if (box.kind === "technician") doc.setFillColor(246, 248, 253);
  else doc.setFillColor(252, 252, 254);
  doc.roundedRect(x, y, boxW, SIGNATURE_BOX_H, 1.5, 1.5, "FD");
  if (box.kind === "technician") {
    drawTechnicianBox(doc, box, x, y, boxW);
    return;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  doc.text(box.title, x + 4, y + 6);
  const fields = box.fields ?? ["Nombre", "Cargo", "Firma", "Fecha"];
  fields.forEach((field, i) => {
    drawBlankField(doc, field, x + 4, y + 16 + i * 9, boxW - 8);
  });
}

const STAMP_BOX_H = 44;
const STAMPS_BLOCK_H = STAMP_BOX_H + 14;

async function drawStampsSection(doc: jsPDF, y: number, clientTitle: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const gap = 6;
  const seal = await loadCompanySealDataUrl();
  const boxes = [
    { title: clientTitle, seal: null },
    { title: "Sello de Medical Advanced Supplies", seal },
  ];
  const boxW = (pageW - margin * 2 - gap * (boxes.length - 1)) / boxes.length;

  y = ensureSpace(doc, y, STAMPS_BLOCK_H);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text("Sellos", margin, y);
  y += 4;

  boxes.forEach((box, index) => {
    const x = margin + index * (boxW + gap);
    doc.setDrawColor(210, 214, 222);
    doc.setFillColor(252, 252, 254);
    doc.roundedRect(x, y, boxW, STAMP_BOX_H, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    doc.text(box.title, x + 4, y + 6);

    const areaX = x + 4;
    const areaY = y + 9;
    const areaW = boxW - 8;
    const areaH = STAMP_BOX_H - 13;
    if (box.seal && drawSealImage(doc, box.seal, areaX + 2, areaY + 1, areaW - 4, areaH - 2)) {
      return;
    }

    doc.setDrawColor(190, 196, 210);
    doc.setLineDashPattern([1.5, 1.2], 0);
    doc.roundedRect(areaX, areaY, areaW, areaH, 1.2, 1.2, "S");
    doc.setLineDashPattern([], 0);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(170, 170, 170);
    doc.text("Espacio para sello", x + boxW / 2, areaY + areaH / 2 + 1, {
      align: "center",
    });
  });

  doc.setDrawColor(220, 220, 220);
  return y + STAMP_BOX_H + 8;
}

function drawHospitalSignatures(doc: jsPDF, y: number, technician: SignatureBox) {
  return drawSignatureBoxes(
    doc,
    y,
    "Firmas",
    "Espacios del hospital en blanco para llenado manuscrito.",
    [
      { kind: "blank", title: "Recibido / autorizado" },
      { kind: "blank", title: "Vo.Bo. biomédica / mantenimiento" },
      technician,
    ]
  );
}

/** Cotización / propuesta económica para el cliente. */
export async function downloadServiceQuotePdf(order: ServiceOrder) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  let y = await drawBrandedHeader(doc, {
    title: "Cotización de servicio técnico",
    folio: order.folio,
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text(
    `${serviceTypeLabel(order.serviceType)} · ${serviceOrderStatusLabel(order.status)} · ${formatDate(order.receptionAt || order.createdAt)}${order.underWarranty ? " · Garantía" : ""}`,
    margin,
    y
  );
  y += 5;
  if (staffLine(order)) {
    doc.text(staffLine(order), margin, y);
    y += 5;
  }
  y += 3;
  y = drawClientEquipment(doc, order, y);
  y = await drawOrderPhotos(doc, order, y, {
    stages: ["recepcion"],
    title: "Fotos de recepción del equipo",
  });

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
    y += notes.length * 4;
  }

  await drawCompanySealBlock(doc, y + 8);

  drawBrandedFooter(doc);
  doc.save(`${order.folio}-cotizacion.pdf`);
}

/** Orden de trabajo / reporte técnico para calidad. */
export async function downloadServiceWorkOrderPdf(order: ServiceOrder) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  let y = await drawBrandedHeader(doc, {
    title: "Orden de trabajo · Control de calidad",
    folio: order.folio,
  });

  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text(
    `Tipo: ${serviceTypeLabel(order.serviceType)} · Estatus: ${serviceOrderStatusLabel(order.status)} · Técnico: ${order.technician || "—"}${order.advisor ? ` · Asesor: ${order.advisor}` : ""}${order.underWarranty ? " · Garantía" : ""}`,
    margin,
    y
  );
  y += 5;
  if (order.nextServiceAt) {
    doc.text(`Próximo servicio: ${formatDate(order.nextServiceAt)}`, margin, y);
    y += 5;
  }
  y += 3;
  y = drawClientEquipment(doc, order, y);
  y = await drawOrderPhotos(doc, order, y, {
    stages: ["recepcion"],
    title: "Fotos de recepción del equipo",
  });

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
    y = drawChecklistSection(
      doc,
      y,
      "Checklist de verificación",
      checklistItemsByKind(order.checklist, "verificacion")
    );
    y = drawChecklistSection(
      doc,
      y,
      "Pruebas de funcionamiento",
      checklistItemsByKind(order.checklist, "funcionamiento")
    );
  }

  if (order.lines.length) {
    y = drawLinesTable(doc, order, y);
  }

  y = await drawOrderPhotos(doc, order, y, {
    stages: ["diagnostico", "servicio", "entrega", "calidad", "otro"],
    title: "Otras evidencias fotográficas",
    showStage: true,
  });

  y = drawSignatureBoxes(doc, y, "Firmas", "Validación interna del servicio.", [
    await technicianBox(order),
    { kind: "blank", title: "Vo.Bo. calidad" },
  ]);
  await drawCompanySealBlock(doc, y);

  drawBrandedFooter(doc);
  doc.save(`${order.folio}-orden-trabajo.pdf`);
}

/** Acta de entrega / conformidad para el cliente. */
export async function downloadServiceDeliveryPdf(order: ServiceOrder) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  let y = await drawBrandedHeader(doc, {
    title: "Acta de entrega de equipo médico",
    folio: order.folio,
  });

  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text(
    `Recepción: ${formatDate(order.receptionAt)} · Entrega: ${formatDate(order.deliveredAt || order.updatedAt)}${staffLine(order) ? ` · ${staffLine(order)}` : ""}`,
    margin,
    y
  );
  y += 8;
  y = drawClientEquipment(doc, order, y);
  y = await drawOrderPhotos(doc, order, y, {
    stages: ["recepcion"],
    title: "Fotos de recepción del equipo",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    "El cliente confirma la recepción del equipo en las condiciones descritas y la realización del servicio técnico.",
    margin,
    y
  );
  y += 8;

  const verification = checklistItemsByKind(order.checklist, "verificacion");
  const functionTests = checklistItemsByKind(order.checklist, "funcionamiento");
  if (verification.length || functionTests.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    if (verification.length) {
      const ok = verification.filter((c) => c.result === "bien").length;
      const bad = verification.filter((c) => c.result === "danado").length;
      const missing = verification.filter((c) => c.result === "no_tiene").length;
      const pending = verification.filter((c) => c.result === "pendiente").length;
      doc.text("Checklist de verificación", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(
        `Bien: ${ok} · Dañado: ${bad} · No tiene: ${missing} · Pendiente: ${pending}`,
        margin,
        y
      );
      y += 7;
    }
    if (functionTests.length) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const pass = functionTests.filter((c) => c.result === "pasa").length;
      const fail = functionTests.filter((c) => c.result === "no_pasa").length;
      const na = functionTests.filter((c) => c.result === "no_aplica").length;
      const pending = functionTests.filter((c) => c.result === "pendiente").length;
      doc.text("Pruebas de funcionamiento", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(
        `Pasa: ${pass} · No pasa: ${fail} · No aplica: ${na} · Pendiente: ${pending}`,
        margin,
        y
      );
      y += 8;
    }
  }

  const otherPhotos = order.images.filter((image) => image.stage !== "recepcion");
  if (otherPhotos.length) {
    y = await drawOrderPhotos(doc, order, y, {
      stages: ["diagnostico", "servicio", "entrega", "calidad", "otro"],
      title: "Otras evidencias fotográficas",
      showStage: true,
    });
  }

  const technician = await technicianBox(order);
  y = ensureSpace(doc, y, SIGNATURE_BLOCK_H + STAMPS_BLOCK_H);
  y = drawSignatureBoxes(
    doc,
    y,
    "Firmas de conformidad",
    "Espacio del cliente en blanco para llenado manuscrito.",
    [{ kind: "blank", title: "Recibe por el cliente" }, technician]
  );

  await drawStampsSection(doc, y, "Sello del cliente / institución");

  drawBrandedFooter(doc);
  doc.save(`${order.folio}-entrega.pdf`);
}

/** Orden de servicio para el hospital: sin importes y firmas en blanco. */
export async function downloadServiceHospitalPdf(order: ServiceOrder) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  let y = await drawBrandedHeader(doc, {
    title: "Orden de servicio",
    folio: order.folio,
  });

  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text(
    `Tipo: ${serviceTypeLabel(order.serviceType)} · Estatus: ${serviceOrderStatusLabel(order.status)} · Técnico: ${order.technician || "—"}${order.advisor ? ` · Asesor: ${order.advisor}` : ""}${order.underWarranty ? " · Garantía" : ""}`,
    margin,
    y
  );
  y += 5;
  if (order.nextServiceAt) {
    doc.text(`Próximo servicio: ${formatDate(order.nextServiceAt)}`, margin, y);
    y += 5;
  }
  y += 3;
  y = drawClientEquipment(doc, order, y);
  y = await drawOrderPhotos(doc, order, y, {
    stages: ["recepcion"],
    title: "Fotos de recepción del equipo",
  });

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
    y = drawChecklistSection(
      doc,
      y,
      "Checklist de verificación",
      checklistItemsByKind(order.checklist, "verificacion")
    );
    y = drawChecklistSection(
      doc,
      y,
      "Pruebas de funcionamiento",
      checklistItemsByKind(order.checklist, "funcionamiento")
    );
  }

  if (order.lines.length) {
    y = drawLinesTable(doc, order, y, { includePrices: false });
  }

  y = await drawOrderPhotos(doc, order, y, {
    stages: ["diagnostico", "servicio", "entrega", "calidad", "otro"],
    title: "Otras evidencias fotográficas",
    showStage: true,
  });

  const technician = await technicianBox(order);
  y = ensureSpace(doc, y, SIGNATURE_BLOCK_H + STAMPS_BLOCK_H);
  y = drawHospitalSignatures(doc, y, technician);
  await drawStampsSection(doc, y, "Sello del hospital / institución");

  drawBrandedFooter(doc);
  doc.save(`${order.folio}-orden.pdf`);
}
