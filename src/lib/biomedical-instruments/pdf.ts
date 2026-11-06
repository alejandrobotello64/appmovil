import { jsPDF } from "jspdf";
import { drawBrandedFooter, drawBrandedHeader } from "@/lib/brand/pdf";
import {
  PDF_MARGIN,
  PDF_MUTED,
  PdfCursor,
  drawFieldRow,
  drawParagraph,
  drawTable,
  formatPdfDate,
  type PdfColumn,
  type PdfRow,
} from "@/lib/brand/pdf-layout";
import { deliverPdf } from "@/lib/print/open-pdf";
import { SERVICE_ORDER_KINDS, serviceOrderStatusLabel, serviceTypeLabel } from "@/lib/service-orders/types";
import {
  biomedicalInstrumentTypeLabel,
  usesForInstrument,
  type BiomedicalInstrument,
  type InstrumentServiceUse,
} from "@/lib/biomedical-instruments/types";

const TYPE_ORDER = ["simulador", "analizador", "seguridad_electrica"];

function mexicoToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}

function mexicoStamp() {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function dated(value: string, today: string) {
  if (!value) return "Sin fecha";
  const label = formatPdfDate(value);
  return value < today ? `${label} · vencida` : label;
}

function orderKindLabel(kind: string) {
  return SERVICE_ORDER_KINDS.find((item) => item.id === kind)?.label ?? "Orden de servicio";
}

function countOf(items: BiomedicalInstrument[], type: string) {
  return String(items.filter((item) => item.instrumentType === type).length);
}

function stretchColumns(columns: PdfColumn[], contentW: number): PdfColumn[] {
  const total = columns.reduce((acc, col) => acc + col.width, 0);
  const extra = contentW - total;
  return columns.map((col, index) =>
    index === columns.length - 1 ? { ...col, width: col.width + extra } : col
  );
}

const SUMMARY_COLUMNS: PdfColumn[] = [
  { key: "n", label: "#", width: 10, align: "center" },
  { key: "equipo", label: "Equipo", width: 42 },
  { key: "tipo", label: "Tipo", width: 28 },
  { key: "serie", label: "Serie", width: 30 },
  { key: "inventario", label: "Inventario", width: 32 },
  { key: "ubicacion", label: "Ubicación", width: 30 },
  { key: "certificado", label: "Certificado", width: 34 },
  { key: "calibracion", label: "Próx. calibración", width: 26 },
  { key: "servicios", label: "Servicios", width: 20, align: "center" },
  { key: "estado", label: "Estado", width: 17 },
];

const HISTORY_COLUMNS: PdfColumn[] = [
  { key: "folio", label: "Folio", width: 28 },
  { key: "fecha", label: "Fecha", width: 20 },
  { key: "tipo", label: "Servicio", width: 32 },
  { key: "estatus", label: "Estatus", width: 24 },
  { key: "cliente", label: "Cliente", width: 46 },
  { key: "equipo", label: "Equipo atendido", width: 48 },
  { key: "serie", label: "Serie", width: 26 },
  { key: "tecnico", label: "Técnico", width: 45 },
];

function summaryRow(item: BiomedicalInstrument, index: number, services: number, today: string): PdfRow {
  const expiredCertificate = Boolean(item.certificateExpiresAt) && item.certificateExpiresAt < today;
  const expiredCalibration = Boolean(item.nextCalibrationAt) && item.nextCalibrationAt < today;
  return {
    cells: {
      n: String(index + 1),
      equipo: [item.name, [item.brand, item.model].filter(Boolean).join(" ")],
      tipo: biomedicalInstrumentTypeLabel(item.instrumentType),
      serie: item.serialNumber,
      inventario: item.assetTag,
      ubicacion: item.location,
      certificado: [
        item.certificateNumber,
        item.certificateExpiresAt ? `Vence ${formatPdfDate(item.certificateExpiresAt)}` : "",
      ],
      calibracion: item.nextCalibrationAt ? formatPdfDate(item.nextCalibrationAt) : "Sin fecha",
      servicios: String(services),
      estado: item.isActive ? "Activo" : "Inactivo",
    },
    styles: {
      equipo: "bold",
      certificado: expiredCertificate ? "danger" : undefined,
      calibracion: expiredCalibration ? "danger" : undefined,
      estado: item.isActive ? "success" : "muted",
    },
  };
}

function historyRows(uses: InstrumentServiceUse[]): PdfRow[] {
  return uses.map((use) => ({
    cells: {
      folio: use.folio,
      fecha: formatPdfDate(use.receptionAt),
      tipo: [serviceTypeLabel(use.serviceType), orderKindLabel(use.orderKind)],
      estatus: serviceOrderStatusLabel(use.status),
      cliente: use.clientName,
      equipo: [use.equipmentName, use.usageNotes],
      serie: use.equipmentSerial,
      tecnico: use.technician,
    },
    styles: { folio: "bold" },
  }));
}

/**
 * Relación completa: una fila por equipo y, después, la ficha con todo su historial.
 * El texto se parte en renglones; no se recorta con puntos suspensivos.
 */
export async function downloadInstrumentsRelationPdf(
  instruments: BiomedicalInstrument[],
  uses: InstrumentServiceUse[]
) {
  if (!instruments.length) {
    throw new Error("No hay equipos para incluir en la relación.");
  }
  const today = mexicoToday();
  const sorted = [...instruments].sort((a, b) => {
    const type = TYPE_ORDER.indexOf(a.instrumentType) - TYPE_ORDER.indexOf(b.instrumentType);
    if (type !== 0) return type;
    return a.name.localeCompare(b.name, "es");
  });
  const history = new Map(sorted.map((item) => [item.id, usesForInstrument(item, uses)]));
  const participations = sorted.reduce((acc, item) => acc + (history.get(item.id)?.length ?? 0), 0);
  const expiredCertificates = sorted.filter(
    (item) => item.certificateExpiresAt && item.certificateExpiresAt < today
  ).length;
  const expiredCalibrations = sorted.filter(
    (item) => item.nextCalibrationAt && item.nextCalibrationAt < today
  ).length;
  const withoutCalibration = sorted.filter((item) => !item.nextCalibrationAt).length;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const contentW = doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
  const summaryColumns = stretchColumns(SUMMARY_COLUMNS, contentW);
  const historyColumns = stretchColumns(HISTORY_COLUMNS, contentW);

  const y = await drawBrandedHeader(doc, {
    title: "Relación de simuladores y analizadores",
    folio: `REL-${today.replace(/-/g, "")}`,
    rightLines: [`${sorted.length} equipos`],
    documentCode: "REL-INS",
  });
  const cursor = new PdfCursor(doc, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_MUTED);
  const intro = doc.splitTextToSize(
    `Generada el ${mexicoStamp()} (hora del centro). Incluye cada simulador, analizador y equipo de seguridad eléctrica, con certificado, próxima calibración e historial de los servicios en los que participó.`,
    cursor.contentW
  ) as string[];
  doc.text(intro, PDF_MARGIN, cursor.y);
  cursor.y += intro.length * 3.6 + 3;

  cursor.sectionTitle("Resumen");
  cursor.ensure(20);
  drawFieldRow(cursor, [
    ["Equipos", String(sorted.length)],
    ["Simuladores", countOf(sorted, "simulador")],
    ["Analizadores", countOf(sorted, "analizador")],
    ["Seguridad eléctrica", countOf(sorted, "seguridad_electrica")],
  ]);
  cursor.ensure(20);
  drawFieldRow(cursor, [
    ["Participaciones en servicios", String(participations)],
    ["Sin próxima calibración", String(withoutCalibration)],
    ["Calibraciones vencidas", String(expiredCalibrations)],
    ["Certificados vencidos", String(expiredCertificates)],
  ]);

  cursor.sectionTitle("Relación general");
  drawTable(
    cursor,
    summaryColumns,
    sorted.map((item, index) => summaryRow(item, index, history.get(item.id)?.length ?? 0, today))
  );

  sorted.forEach((item, index) => {
    const services = history.get(item.id) ?? [];
    cursor.ensure(52);
    cursor.sectionTitle(`${index + 1}. ${item.name || "Equipo"}`);
    cursor.ensure(20);
    drawFieldRow(cursor, [
      ["Tipo", biomedicalInstrumentTypeLabel(item.instrumentType)],
      ["Estado", item.isActive ? "Activo" : "Inactivo"],
      ["Marca", item.brand],
      ["Modelo", item.model],
    ]);
    cursor.ensure(20);
    drawFieldRow(cursor, [
      ["Número de serie", item.serialNumber],
      ["Inventario", item.assetTag],
      ["Ubicación", item.location],
      ["Registró", item.createdBy],
    ]);
    cursor.ensure(20);
    drawFieldRow(cursor, [
      ["Certificado", item.certificateNumber],
      ["Vencimiento del certificado", dated(item.certificateExpiresAt, today)],
      ["Próxima calibración", dated(item.nextCalibrationAt, today)],
      ["Servicios", String(services.length)],
    ]);
    drawParagraph(cursor, "Notas", item.notes);
    if (!services.length) {
      cursor.ensure(8);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...PDF_MUTED);
      doc.text("Este equipo no tiene servicios registrados.", PDF_MARGIN, cursor.y);
      cursor.y += 6;
      return;
    }
    cursor.ensure(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_MUTED);
    doc.text("Servicios en los que participó", PDF_MARGIN, cursor.y);
    cursor.y += 3;
    drawTable(cursor, historyColumns, historyRows(services));
  });

  drawBrandedFooter(
    doc,
    "Medical Advanced Supplies · Relación de simuladores y analizadores · Cód. REL-INS"
  );
  await deliverPdf(doc, "relacion-simuladores-analizadores.pdf", "download");
}
