import { jsPDF } from "jspdf";
import { drawBrandedFooter, drawBrandedHeader } from "@/lib/brand/pdf";
import {
  PDF_INK,
  PDF_MARGIN,
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
} from "@/lib/brand/pdf-layout";
import { loadStaffProfileLookup } from "@/lib/users/staff";
import {
  MOVEMENT_KIND_LABELS,
  placeLabel,
  type MovementKind,
  type MovementPlace,
  type MovementRecord,
} from "./movements";
import type { Warehouse } from "./stock";

export type PdfOutput = "print" | "download";

type KindDocument = {
  title: string;
  originTitle: string;
  destinationTitle: string;
  originEmpty: string;
  destinationEmpty: string;
  signatures: string[];
  /** Firma que corresponde a quien registró el movimiento en el sistema. */
  registrantSlot: number;
};

const KIND_DOCUMENTS: Record<MovementKind, KindDocument> = {
  traspaso: {
    title: "Vale de traspaso entre almacenes",
    originTitle: "Almacén origen",
    destinationTitle: "Almacén destino",
    originEmpty: "Sin almacén",
    destinationEmpty: "Sin almacén",
    signatures: ["Entrega (almacén origen)", "Transporta", "Recibe (almacén destino)"],
    registrantSlot: 0,
  },
  cambio_ubicacion: {
    title: "Comprobante de cambio de ubicación",
    originTitle: "Ubicación origen",
    destinationTitle: "Ubicación destino",
    originEmpty: "Sin ubicación",
    destinationEmpty: "Sin ubicación",
    signatures: ["Realizó el movimiento", "Autoriza (almacén)"],
    registrantSlot: 0,
  },
  entrada: {
    title: "Vale de entrada a almacén",
    originTitle: "Procedencia",
    destinationTitle: "Ingresa a",
    originEmpty: "Externo (proveedor / cliente)",
    destinationEmpty: "Sin almacén",
    signatures: ["Entrega (proveedor / origen)", "Recibe (almacén)"],
    registrantSlot: 1,
  },
  salida: {
    title: "Vale de salida de almacén",
    originTitle: "Sale de",
    destinationTitle: "Destino",
    originEmpty: "Sin almacén",
    destinationEmpty: "Externo (cliente / servicio)",
    signatures: ["Entrega (almacén)", "Recibe"],
    registrantSlot: 0,
  },
  canje_caducado: {
    title: "Comprobante de canje de material caducado",
    originTitle: "Almacén",
    destinationTitle: "Proveedor",
    originEmpty: "Sin almacén",
    destinationEmpty: "Proveedor del canje",
    signatures: ["Entrega lote caducado (almacén)", "Recibe caducado y entrega lote nuevo (proveedor)"],
    registrantSlot: 0,
  },
  devolucion: {
    title: "Vale de devolución a almacén",
    originTitle: "Devuelve",
    destinationTitle: "Ingresa a",
    originEmpty: "Externo",
    destinationEmpty: "Sin almacén",
    signatures: ["Devuelve", "Recibe (almacén)"],
    registrantSlot: 1,
  },
  ajuste: {
    title: "Comprobante de ajuste de inventario",
    originTitle: "Origen",
    destinationTitle: "Destino",
    originEmpty: "—",
    destinationEmpty: "—",
    signatures: ["Realizó el ajuste", "Autoriza"],
    registrantSlot: 0,
  },
};

const VOUCHER_COLUMNS: PdfColumn[] = [
  { key: "n", label: "#", width: 7, align: "center" },
  { key: "sku", label: "SKU", width: 25 },
  { key: "product", label: "Producto", width: 60 },
  { key: "lot", label: "Lote", width: 22 },
  { key: "expiry", label: "Caducidad", width: 20, align: "center" },
  { key: "serials", label: "Números de serie", width: 30 },
  { key: "qty", label: "Cantidad", width: 18, align: "center" },
];

const REPORT_COLUMNS: PdfColumn[] = [
  { key: "date", label: "Fecha", width: 24 },
  { key: "folio", label: "Folio", width: 27 },
  { key: "kind", label: "Tipo", width: 24 },
  { key: "product", label: "Producto", width: 58 },
  { key: "qty", label: "Cant.", width: 12, align: "center" },
  { key: "from", label: "Origen", width: 34 },
  { key: "to", label: "Destino", width: 34 },
  { key: "lot", label: "Lote", width: 22 },
  { key: "user", label: "Usuario", width: 34 },
];

const MOVE_KINDS: MovementKind[] = ["traspaso", "cambio_ubicacion"];

function finish(doc: jsPDF, fileName: string, output: PdfOutput) {
  if (output === "print") {
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
    return;
  }
  doc.save(fileName);
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function placeCard(
  title: string,
  place: MovementPlace | null,
  emptyName: string,
  warehouses: Map<string, Warehouse>
): PdfPersonCard {
  const warehouse = place?.warehouseId ? warehouses.get(place.warehouseId) : undefined;
  return {
    title,
    name: warehouse ? warehouse.name : (place?.warehouseCode ?? ""),
    emptyName,
    rows: [
      ["Almacén", place?.warehouseCode ?? ""],
      ["Ubicación", place?.locationName ?? ""],
      ["Ciudad", warehouse?.city ?? ""],
    ],
  };
}

function quantityCell(record: MovementRecord): string[] {
  const qty = formatPdfQty(record.quantity);
  if (record.kind !== "canje_caducado") return [qty, record.unit];
  if (record.qtyIn > 0 && record.qtyOut > 0) return [qty, "Sale y entra"];
  return [qty, record.qtyOut > 0 ? "Sale (caducado)" : "Entra (nuevo)"];
}

/** Vale de un movimiento: uno o varios registros que comparten folio (o un canje salida + entrada). */
export async function downloadMovementVoucherPdf(
  records: MovementRecord[],
  options: { warehouses: Warehouse[]; output?: PdfOutput }
) {
  if (!records.length) throw new Error("No hay movimientos para imprimir.");
  const first = records[0];
  const config = KIND_DOCUMENTS[first.kind] ?? KIND_DOCUMENTS.ajuste;
  const warehouses = new Map(options.warehouses.map((warehouse) => [warehouse.id, warehouse]));
  const lookup = await loadStaffProfileLookup();
  const registrant = lookup(first.createdBy);
  const registrantName = registrant?.fullName || first.createdBy;
  const folios = unique(records.map((record) => record.folio));

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const start = await drawBrandedHeader(doc, {
    title: config.title,
    folio: folios.join(" / ") || "Sin folio",
    rightLines: [MOVEMENT_KIND_LABELS[first.kind] ?? first.kind, formatPdfDate(first.occurredAt, true)],
  });
  const cursor = new PdfCursor(doc, start);

  drawFieldRow(cursor, [
    ["Fecha y hora", formatPdfDate(first.occurredAt, true)],
    ["Tipo de movimiento", MOVEMENT_KIND_LABELS[first.kind] ?? first.kind],
    ["Registró", registrantName],
    ["Motivo", unique(records.map((record) => record.reason)).join(" · ")],
  ]);
  const technicians = unique(records.map((record) => record.technician));
  if (technicians.length) drawFieldRow(cursor, [["Técnico / responsable", technicians.join(", ")]]);

  const origin = records.find((record) => record.from)?.from ?? null;
  const destination = records.find((record) => record.to)?.to ?? null;
  if (first.kind === "canje_caducado") {
    drawPersonCards(
      cursor,
      [
        placeCard(config.originTitle, origin ?? destination, config.originEmpty, warehouses),
        { title: config.destinationTitle, name: "", emptyName: config.destinationEmpty, rows: [] },
      ],
      2
    );
  } else {
    drawPersonCards(
      cursor,
      [
        placeCard(config.originTitle, origin, config.originEmpty, warehouses),
        placeCard(config.destinationTitle, destination, config.destinationEmpty, warehouses),
      ],
      2
    );
  }

  cursor.sectionTitle(first.kind === "canje_caducado" ? "Lotes del canje" : "Material");
  drawTable(
    cursor,
    VOUCHER_COLUMNS,
    records.map((record, index) => ({
      cells: {
        n: String(index + 1),
        sku: record.productSku || "—",
        product: record.productName,
        lot: record.lotNumber || "—",
        expiry: formatPdfDate(record.lotExpiry),
        serials: record.serials || "—",
        qty: quantityCell(record),
      },
      styles: { product: "bold", qty: "bold" },
    }))
  );

  const units = records.reduce(
    (sum, record) => sum + (record.kind === "canje_caducado" ? record.qtyOut : record.quantity),
    0
  );
  cursor.ensure(7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_INK);
  doc.text(
    `${records.length} partida(s) · ${formatPdfQty(units)} unidad(es)${first.kind === "canje_caducado" ? " canjeadas" : ""}`,
    PDF_MARGIN + cursor.contentW,
    cursor.y + 3,
    { align: "right" }
  );
  cursor.y += 8;

  drawParagraph(cursor, "Notas", unique(records.map((record) => record.note)).join("\n"));

  drawSignatures(
    cursor,
    config.signatures.map((title, index) => ({
      title,
      name:
        index === config.registrantSlot
          ? registrantName
          : first.kind === "salida" && index === 1
            ? technicians.join(", ")
            : "",
    }))
  );

  drawBrandedFooter(doc);
  finish(doc, `${folios[0] || "movimiento"}-${first.kind}.pdf`, options.output ?? "download");
}

export type MovementReportFilters = {
  period: string;
  kind: string;
  warehouse: string;
  search: string;
};

/** Reporte horizontal del historial filtrado, con totales y firmas de revisión. */
export async function downloadMovementsReportPdf(
  records: MovementRecord[],
  options: { filters: MovementReportFilters; generatedBy: string; output?: PdfOutput }
) {
  const lookup = await loadStaffProfileLookup();
  const nameOf = (user: string) => lookup(user)?.fullName || user;
  const now = new Date();

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const start = await drawBrandedHeader(doc, {
    title: "Reporte de movimientos de almacén",
    rightLines: [options.filters.period, `Generado: ${formatPdfDate(now.toISOString(), true)}`],
  });
  const cursor = new PdfCursor(doc, start);

  let unitsIn = 0;
  let unitsOut = 0;
  let moved = 0;
  for (const record of records) {
    if (MOVE_KINDS.includes(record.kind)) moved += record.quantity;
    else {
      unitsIn += record.qtyIn;
      unitsOut += record.qtyOut;
    }
  }

  drawFieldRow(cursor, [
    ["Periodo", options.filters.period],
    ["Tipo", options.filters.kind],
    ["Almacén", options.filters.warehouse],
    ["Búsqueda", options.filters.search || "Sin filtro"],
  ]);
  drawFieldRow(
    cursor,
    [
      ["Movimientos", String(records.length)],
      ["Unidades que entraron", formatPdfQty(unitsIn)],
      ["Unidades que salieron", formatPdfQty(unitsOut)],
      ["Unidades trasladadas", formatPdfQty(moved)],
    ],
    5
  );

  cursor.sectionTitle("Detalle");
  drawTable(
    cursor,
    REPORT_COLUMNS,
    records.map((record) => ({
      cells: {
        date: formatPdfDate(record.occurredAt, true),
        folio: record.folio || "—",
        kind: MOVEMENT_KIND_LABELS[record.kind] ?? record.kind,
        product: [record.productName, record.productSku],
        qty: `${record.kind === "salida" ? "-" : record.kind === "entrada" ? "+" : ""}${formatPdfQty(record.quantity)}`,
        from: placeLabel(record.from) || "Externo",
        to: placeLabel(record.to) || "Externo",
        lot: record.lotNumber || "—",
        user: nameOf(record.createdBy) || "—",
      },
      styles: {
        qty: record.kind === "salida" ? "danger" : record.kind === "entrada" ? "success" : "bold",
      },
    }))
  );

  drawSignatures(cursor, [
    { title: "Elaboró", name: nameOf(options.generatedBy) },
    { title: "Revisó (almacén)", name: "" },
  ]);

  drawBrandedFooter(doc);
  finish(doc, `reporte-movimientos-${now.toISOString().slice(0, 10)}.pdf`, options.output ?? "download");
}
