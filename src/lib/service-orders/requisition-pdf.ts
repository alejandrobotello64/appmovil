import { jsPDF } from "jspdf";
import { drawBrandedFooter, drawBrandedHeader } from "@/lib/brand/pdf";
import {
  PDF_BLUE,
  PDF_CYAN,
  PDF_INK,
  PDF_MARGIN,
  PDF_MUTED,
  PdfCursor,
  drawParagraph,
  drawSignatures,
  drawTable,
  formatPdfDate,
  formatPdfQty,
  type PdfColumn,
  type PdfRow,
} from "@/lib/brand/pdf-layout";
import { getProductsAvailableQty } from "@/lib/holds/storage";
import { getPurchaseRequests } from "@/lib/purchasing/storage";
import { isPurchaseOpen, purchaseStatusLabel, type PurchaseRequest } from "@/lib/purchasing/types";
import { loadStaffProfileLookup, type StaffProfile } from "@/lib/users/staff";
import { deliverPdf, type PdfIntent } from "@/lib/print/open-pdf";
import {
  getRequisitionFulfillments,
  getRequisitionOriginDetails,
  type RequisitionOriginDetails,
} from "./requisition-storage";
import {
  groupRequisitionLines,
  requisitionLineStatusLabel,
  requisitionStatusLabel,
  type GroupedRequisitionLine,
  type ServiceOrderRequisition,
} from "./requisitions";
import { serviceTypeLabel } from "./types";
import {
  fulfillmentLotKey,
  listFulfillmentLots,
  type FulfillmentLotOption,
} from "@/lib/warehouse/stock";

const COLUMNS: PdfColumn[] = [
  { key: "n", label: "#", width: 6, align: "center" },
  { key: "sku", label: "SKU", width: 20 },
  { key: "part", label: "N.º parte", width: 24 },
  { key: "desc", label: "Material", width: 46 },
  { key: "unit", label: "Unidad", width: 14, align: "center" },
  { key: "req", label: "Solic.", width: 13, align: "center" },
  { key: "ful", label: "Surtido", width: 14, align: "center" },
  { key: "pend", label: "Pend.", width: 13, align: "center" },
  { key: "buy", label: "Estatus / compra", width: 32 },
];

export type PdfOutput = PdfIntent;

export type RequisitionPrintOptions = {
  /** Usuario que imprime; si es de almacén y aún no hay surtido, aparece como quien surte. */
  printedBy?: { username: string; fullName: string | null };
  printedByWarehouse?: boolean;
  output?: PdfOutput;
  /** Cantidad a recoger por grupo de código (lista de verificación). */
  quantities?: Record<string, number>;
  /** Lote que almacén eligió por producto. Si falta, se marca el que caduca antes. */
  chosenLots?: Record<string, { lotNumber: string; expiryDate: string }>;
};

async function finishPdf(doc: jsPDF, fileName: string, output: PdfOutput = "print", note?: string) {
  drawBrandedFooter(doc, note);
  await deliverPdf(doc, fileName, output);
}

function compactSection(cursor: PdfCursor, title: string) {
  cursor.ensure(7);
  const { doc } = cursor;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_BLUE);
  doc.text(title.toUpperCase(), PDF_MARGIN, cursor.y);
  doc.setDrawColor(210, 216, 236);
  doc.line(PDF_MARGIN, cursor.y + 1.1, cursor.pageW - PDF_MARGIN, cursor.y + 1.1);
  cursor.y += 4.4;
}

function compactFields(cursor: PdfCursor, fields: [string, string][], columns = 4) {
  const filled = fields.filter(([, value]) => String(value ?? "").trim());
  if (!filled.length) return;
  const { doc } = cursor;
  const colW = cursor.contentW / columns;
  for (let start = 0; start < filled.length; start += columns) {
    const row = filled.slice(start, start + columns);
    cursor.ensure(6.4);
    row.forEach(([label, value], index) => {
      const x = PDF_MARGIN + colW * index;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.8);
      doc.setTextColor(...PDF_MUTED);
      doc.text(label, x, cursor.y);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      doc.setTextColor(...PDF_INK);
      const lines = doc.splitTextToSize(value, colW - 2.5) as string[];
      doc.text(lines[0] ?? "—", x, cursor.y + 3.1);
    });
    cursor.y += 6.2;
  }
  cursor.y += 0.8;
}

function compactPeople(
  cursor: PdfCursor,
  people: { title: string; name: string; empty?: string }[]
) {
  compactSection(cursor, "Responsables");
  const { doc } = cursor;
  const gap = 2.4;
  const w = (cursor.contentW - gap * (people.length - 1)) / people.length;
  const h = 11;
  cursor.ensure(h + 2);
  people.forEach((person, index) => {
    const x = PDF_MARGIN + index * (w + gap);
    doc.setFillColor(246, 248, 253);
    doc.setDrawColor(210, 216, 236);
    doc.roundedRect(x, cursor.y, w, h, 1, 1, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8);
    doc.setTextColor(...PDF_CYAN);
    doc.text(person.title.toUpperCase(), x + 2, cursor.y + 3.3);
    const name = person.name || person.empty || "—";
    doc.setFontSize(7.2);
    doc.setTextColor(...(person.name ? PDF_INK : PDF_MUTED));
    doc.text((doc.splitTextToSize(name, w - 4) as string[])[0], x + 2, cursor.y + 7.8);
  });
  cursor.y += h + 2.4;
}

function purchaseForLine(lineId: string, purchases: PurchaseRequest[]) {
  return purchases.filter((purchase) => purchase.lines.some((line) => line.requisitionLineId === lineId));
}

function lotDetailLines(
  lots: FulfillmentLotOption[],
  chosen?: { lotNumber: string; expiryDate: string }
) {
  if (!lots.length) return ["Sin lote con existencia"];
  const chosenKey = chosen ? fulfillmentLotKey(chosen) : "";
  const suggestedKey = fulfillmentLotKey(lots[0]);
  const lines = lots.map((lot, index) => {
    const key = fulfillmentLotKey(lot);
    const when = lot.expiryDate
      ? formatPdfDate(lot.expiryDate.slice(0, 10))
      : "sin caducidad";
    const name = lot.lotNumber.trim() || "sin número";
    const tag =
      chosenKey && key === chosenKey
        ? "a surtir"
        : !chosenKey && key === suggestedKey
          ? "a surtir · caduca antes"
          : index === 0
            ? "caduca antes"
            : "caducidad mayor";
    return `Lote ${name} · caduca ${when} · ${formatPdfQty(lot.available)} disp. · ${tag}`;
  });
  if (chosenKey && !lots.some((lot) => fulfillmentLotKey(lot) === chosenKey)) {
    const when = chosen?.expiryDate
      ? formatPdfDate(chosen.expiryDate.slice(0, 10))
      : "sin caducidad";
    lines.push(`A surtir: lote ${chosen?.lotNumber.trim() || "sin número"} · caduca ${when}`);
  }
  return lines;
}

function materialCell(
  group: GroupedRequisitionLine,
  lots: FulfillmentLotOption[] | undefined,
  chosen: { lotNumber: string; expiryDate: string } | undefined,
  notes: string[] = []
) {
  const title = group.description || group.productName || "Material";
  const extra = [
    group.productBrand.trim() ? `Marca: ${group.productBrand.trim()}` : "",
    group.productId ? `Modelo: ${group.productModel.trim() || "—"}` : "",
    ...notes.map((note) => `Nota: ${note}`),
    ...(group.productId ? lotDetailLines(lots ?? [], chosen) : []),
  ].filter(Boolean);
  return [title, ...extra];
}

/** Orden de surtimiento con su origen (OS o cotización), personas, surtidos y compras de faltantes. */
export async function downloadRequisitionPdf(
  requisition: ServiceOrderRequisition,
  options: RequisitionPrintOptions = {}
) {
  await downloadRequisitionsPdf([requisition], options);
}

/** Una hoja por cada solicitud, aunque se impriman juntas. */
export async function downloadRequisitionsPdf(
  requisitions: ServiceOrderRequisition[],
  options: RequisitionPrintOptions = {}
) {
  if (!requisitions.length) throw new Error("Selecciona al menos una solicitud para imprimir.");
  const lookup = await loadStaffProfileLookup();
  const lotsByProduct = await listFulfillmentLots(
    requisitions.flatMap((requisition) =>
      requisition.lines.map((line) => line.productId ?? "")
    )
  ).catch(() => new Map<string, FulfillmentLotOption[]>());
  const packed = await Promise.all(
    requisitions.map(async (requisition) => {
      const [origin, fulfillments, purchases] = await Promise.all([
        getRequisitionOriginDetails(requisition),
        getRequisitionFulfillments(requisition.id).catch(() => []),
        getPurchaseRequests({ requisitionId: requisition.id }).catch(() => [] as PurchaseRequest[]),
      ]);
      return { requisition, origin, fulfillments, purchases };
    })
  );
  const nameOf = (profile: StaffProfile | null, raw: string) => profile?.fullName || raw;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  for (let index = 0; index < packed.length; index++) {
    if (index > 0) doc.addPage();
    const item = packed[index];
    const isQuote = item.requisition.sourceType === "cotizacion";
    const fulfillers = [
      ...item.fulfillments.map((row) => row.fulfilledBy),
      item.requisition.fulfilledBy,
    ].filter(Boolean);
    let fulfillerKey = fulfillers.at(-1) || "";
    let fulfillerLabel = item.requisition.fulfilledAt
      ? formatPdfDate(item.requisition.fulfilledAt, true)
      : "";
    if (!fulfillerKey && options.printedByWarehouse && options.printedBy) {
      fulfillerKey = options.printedBy.fullName || options.printedBy.username;
      fulfillerLabel = "Por surtir";
    }

    const requester = lookup(item.requisition.requestedBy);
    const advisor = lookup(isQuote ? item.origin.salesperson : item.origin.advisor);
    const technician = lookup(item.origin.technician);
    const fulfiller = fulfillerKey ? lookup(fulfillerKey) : null;

    const start = await drawBrandedHeader(doc, {
      title: "Orden de surtimiento de material",
      folio: item.requisition.folio,
      rightLines: [
        packed.length > 1
          ? `Hoja ${index + 1} de ${packed.length}`
          : `Estatus: ${requisitionStatusLabel(item.requisition.status)}`,
        ...(item.requisition.priority === "urgente"
          ? ["Prioridad: URGENTE"]
          : packed.length > 1
            ? [`Estatus: ${requisitionStatusLabel(item.requisition.status)}`]
            : []),
      ],
    });
    const cursor = new PdfCursor(doc, start);

    if (isQuote) drawQuoteOrigin(cursor, item.requisition, item.origin);
    else drawServiceOrderOrigin(cursor, item.requisition, item.origin);

    compactPeople(
      cursor,
      isQuote
        ? [
            { title: "Solicita", name: nameOf(requester, item.requisition.requestedBy) },
            {
              title: "Vendedor",
              name: nameOf(advisor, item.origin.salesperson),
              empty: "Sin asignar",
            },
            {
              title: "Almacén",
              name: fulfillerKey ? nameOf(fulfiller, fulfillerKey) : "",
              empty: fulfillerLabel || "Por surtir",
            },
          ]
        : [
            { title: "Solicita", name: nameOf(requester, item.requisition.requestedBy) },
            {
              title: "Asesor",
              name: nameOf(advisor, item.origin.advisor),
              empty: "Sin asignar",
            },
            {
              title: "Técnico",
              name: nameOf(technician, item.origin.technician),
              empty: "Sin asignar",
            },
            {
              title: "Almacén",
              name: fulfillerKey ? nameOf(fulfiller, fulfillerKey) : "",
              empty: fulfillerLabel || "Por surtir",
            },
          ]
    );

    drawRequisitionBody(
      cursor,
      item.requisition,
      item.fulfillments,
      item.purchases,
      (key) => nameOf(lookup(key), key),
      lotsByProduct,
      options.chosenLots
    );
    drawParagraph(
      cursor,
      isQuote ? "Notas de ventas" : "Notas de servicio",
      item.requisition.notes
    );
    drawParagraph(cursor, "Notas de almacén", item.requisition.warehouseNotes);

    drawSignatures(
      cursor,
      isQuote
        ? [
            {
              title: "Entrega material (almacén)",
              name: fulfillerKey ? nameOf(fulfiller, fulfillerKey) : "",
            },
            { title: "Recibe material (cliente / ventas)", name: "" },
            {
              title: "Vo. Bo. ventas",
              name:
                nameOf(advisor, item.origin.salesperson) ||
                nameOf(requester, item.requisition.requestedBy),
            },
          ]
        : [
            {
              title: "Entrega material (almacén)",
              name: fulfillerKey ? nameOf(fulfiller, fulfillerKey) : "",
            },
            {
              title: "Recibe material (técnico)",
              name: nameOf(technician, item.origin.technician),
            },
            {
              title: "Vo. Bo. asesor de servicio",
              name: nameOf(advisor, item.origin.advisor),
            },
          ]
    );
  }

  const first = packed[0];
  const filename =
    packed.length > 1
      ? `surtimiento-${packed.length}-folios.pdf`
      : `${first.requisition.folio}-orden-surtimiento.pdf`;
  await finishPdf(doc, filename, options.output ?? "print");
}

const PICK_COLUMNS: PdfColumn[] = [
  { key: "ok", label: "✓", width: 8, align: "center" },
  { key: "n", label: "#", width: 7, align: "center" },
  { key: "sku", label: "SKU", width: 20 },
  { key: "part", label: "N.º parte", width: 24 },
  { key: "desc", label: "Producto", width: 52 },
  { key: "unit", label: "Unidad", width: 14, align: "center" },
  { key: "qty", label: "A surtir", width: 15, align: "center" },
  { key: "disp", label: "Disp.", width: 14, align: "center" },
  { key: "from", label: "Folios", width: 28 },
];

function pickQtyForGroup(
  group: ReturnType<typeof groupRequisitionLines>[number],
  quantities?: Record<string, number>
) {
  const override = quantities?.[group.key];
  if (Number.isFinite(override) && (override as number) > 0) return override as number;
  if (group.pending > 0) return group.pending;
  return group.quantityRequested;
}

/** Suma agrupada de lo que se va a recoger. Solo referencia para verificar productos. */
export async function downloadRequisitionPickListPdf(
  requisitions: ServiceOrderRequisition[],
  options: RequisitionPrintOptions = {}
) {
  if (!requisitions.length) throw new Error("Selecciona al menos una solicitud para imprimir la suma.");
  const groups = groupRequisitionLines(requisitions);
  const rowsToPrint = groups
    .map((group) => ({ group, qty: pickQtyForGroup(group, options.quantities) }))
    .filter((row) => row.qty > 0);
  if (!rowsToPrint.length) {
    throw new Error("No hay productos pendientes para la lista de verificación.");
  }

  const catalogIds = rowsToPrint.flatMap((row) =>
    row.group.sources.map((source) => source.line.productId ?? "")
  );
  const [stock, lotsByProduct] = await Promise.all([
    getProductsAvailableQty(catalogIds).catch(() => new Map<string, number>()),
    listFulfillmentLots(catalogIds).catch(() => new Map<string, FulfillmentLotOption[]>()),
  ]);
  const lookup = await loadStaffProfileLookup();
  const requesterKeys = [...new Set(requisitions.map((item) => item.requestedBy).filter(Boolean))];
  const requesterNames = requesterKeys.map((key) => lookup(key)?.fullName || key);
  const folios = requisitions.map((item) => item.folio);
  const origins = [
    ...new Set(
      requisitions.map((item) => {
        const origin = item.sourceType === "cotizacion" ? item.quoteFolio : item.serviceOrderFolio;
        const prefix = item.sourceType === "cotizacion" ? "COT" : "OS";
        return origin ? `${prefix} ${origin}` : "";
      }).filter(Boolean)
    ),
  ];
  const picker =
    options.printedBy?.fullName || options.printedBy?.username || "";
  const totalQty = rowsToPrint.reduce((sum, row) => sum + row.qty, 0);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const start = await drawBrandedHeader(doc, {
    title: "Lista de verificación · suma a surtir",
    folio: folios.length === 1 ? folios[0] : `${folios.length} FOLIOS`,
    rightLines: [
      "SOLO REFERENCIA",
      `${rowsToPrint.length} código${rowsToPrint.length === 1 ? "" : "s"} · ${formatPdfQty(totalQty)} pzas`,
    ],
  });
  const cursor = new PdfCursor(doc, start);

  compactSection(cursor, "Qué verifica esta hoja");
  drawParagraph(
    cursor,
    "Uso",
    "Agrupa el mismo código en una sola cantidad para comprobar lo que se va a recoger. No sustituye la orden por folio: esa hoja sí se entrega y se firma."
  );
  compactFields(cursor, [
    ["Solicitudes", folios.join(" · ")],
    ["Órdenes / cotizaciones", origins.join(" · ")],
    ["Solicita", requesterNames.join(" · ")],
    ["Prepara", picker || "Almacén"],
  ]);

  compactSection(cursor, "Productos a surtir (cantidades juntas)");
  const rows: PdfRow[] = rowsToPrint.map((row, index) => {
    const from = [
      ...new Set(row.group.sources.map((source) => source.requisition.folio)),
    ].join(", ");
    const available =
      row.group.offCatalog || !row.group.productId
        ? null
        : stock.get(row.group.productId);
    return {
      cells: {
        ok: "",
        n: String(index + 1),
        sku: row.group.productSku || "—",
        part: row.group.partNumber.trim() || "—",
        desc: materialCell(
          row.group,
          row.group.productId ? lotsByProduct.get(row.group.productId) : undefined,
          row.group.productId ? options.chosenLots?.[row.group.productId] : undefined
        ),
        unit: row.group.unit,
        qty: formatPdfQty(row.qty),
        disp:
          available == null ? "—" : formatPdfQty(Math.max(0, available)),
        from,
      },
      styles: { qty: "bold" },
    };
  });
  drawTable(cursor, PICK_COLUMNS, rows);

  cursor.ensure(8);
  cursor.doc.setFont("helvetica", "bold");
  cursor.doc.setFontSize(9);
  cursor.doc.setTextColor(...PDF_INK);
  cursor.doc.text(
    `Total a surtir: ${rowsToPrint.length} código${rowsToPrint.length === 1 ? "" : "s"} · ${formatPdfQty(totalQty)} unidades`,
    PDF_MARGIN + cursor.contentW,
    cursor.y + 3,
    { align: "right" }
  );
  cursor.y += 10;

  compactPeople(cursor, [
    { title: "Prepara / verifica", name: picker, empty: "Almacén" },
    { title: "Recoge", name: requesterNames[0] ?? "", empty: "Solicitante" },
  ]);

  await finishPdf(
    doc,
    folios.length === 1
      ? `${folios[0]}-suma-surtir.pdf`
      : `suma-surtir-${folios.length}-folios.pdf`,
    options.output ?? "print",
    "Referencia para verificar productos. La entrega formal es la hoja por folio."
  );
}

function fieldBlockHeight(doc: jsPDF, fields: [string, string][], width: number) {
  let height = 8;
  for (const [, value] of fields) {
    const lines = (doc.splitTextToSize(value.trim() || "—", width) as string[]).slice(0, 3);
    height += 3.2 + lines.length * 3.15;
  }
  return height + 2.2;
}

function drawInfoCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  fields: [string, string][]
) {
  doc.setFillColor(246, 248, 253);
  doc.setDrawColor(210, 216, 236);
  doc.roundedRect(x, y, w, h, 1.2, 1.2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_BLUE);
  doc.text(title.toUpperCase(), x + 2.4, y + 4.2);
  let cursorY = y + 8;
  const inner = w - 4.8;
  for (const [label, value] of fields) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(...PDF_MUTED);
    doc.text(label, x + 2.4, cursorY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4);
    doc.setTextColor(...PDF_INK);
    const lines = (doc.splitTextToSize(value.trim() || "—", inner) as string[]).slice(0, 3);
    doc.text(lines, x + 2.4, cursorY + 3.1);
    cursorY += 3.2 + lines.length * 3.15;
  }
}

function drawOriginColumns(
  cursor: PdfCursor,
  leftTitle: string,
  left: [string, string][],
  rightTitle: string,
  right: [string, string][]
) {
  const gap = 3;
  const width = (cursor.contentW - gap) / 2;
  const inner = width - 4.8;
  const height = Math.max(
    fieldBlockHeight(cursor.doc, left, inner),
    fieldBlockHeight(cursor.doc, right, inner),
    24
  );
  cursor.ensure(height + 2);
  drawInfoCard(cursor.doc, PDF_MARGIN, cursor.y, width, height, leftTitle, left);
  drawInfoCard(cursor.doc, PDF_MARGIN + width + gap, cursor.y, width, height, rightTitle, right);
  cursor.y += height + 2.6;
}

function clientSide(origin: RequisitionOriginDetails): [string, string][] {
  const address = [origin.address, origin.city].filter((part) => part.trim()).join(", ");
  const contact = [origin.contactName, origin.contactPhone].filter((part) => part.trim()).join(" · ");
  return [
    ["Cliente", origin.clientName],
    ["Dirección", address],
    ["Estado", origin.state],
    [origin.promiseLabel, origin.promisedAt ? formatPdfDate(origin.promisedAt) : ""],
    ...(contact ? ([["Contacto", contact]] as [string, string][]) : []),
  ];
}

function drawQuoteOrigin(
  cursor: PdfCursor,
  requisition: ServiceOrderRequisition,
  origin: RequisitionOriginDetails
) {
  drawOriginColumns(
    cursor,
    "Venta",
    [
      ["Cotización", requisition.quoteFolio || origin.folio],
      ["Proyecto", origin.title],
      ["Solicitado", formatPdfDate(requisition.requestedAt, true)],
      ...(requisition.deliveryAddress
        ? ([["Entrega", requisition.deliveryAddress]] as [string, string][])
        : []),
    ],
    "Cliente",
    clientSide(origin)
  );
}

function drawServiceOrderOrigin(
  cursor: PdfCursor,
  requisition: ServiceOrderRequisition,
  origin: RequisitionOriginDetails
) {
  drawOriginColumns(
    cursor,
    "Equipo",
    [
      ["Orden de servicio", requisition.serviceOrderFolio || origin.folio],
      ["Equipo", origin.equipmentName || requisition.equipmentName],
      ["Marca", origin.equipmentBrand],
      ["Modelo", origin.equipmentModel],
      ["No. de serie", origin.equipmentSerial],
      ["Ubicación", origin.equipmentLocation],
      ...(origin.serviceType
        ? ([["Tipo", serviceTypeLabel(origin.serviceType)]] as [string, string][])
        : []),
      ...(origin.priority === "urgente" ? ([["Prioridad", "Urgente"]] as [string, string][]) : []),
    ],
    "Cliente",
    clientSide(origin)
  );
  const fault = origin.faultReported.trim();
  if (!fault) return;
  const { doc } = cursor;
  const lines = (doc.splitTextToSize(fault, cursor.contentW) as string[]).slice(0, 2);
  cursor.ensure(4 + lines.length * 3.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8);
  doc.setTextColor(...PDF_MUTED);
  doc.text("Falla reportada", PDF_MARGIN, cursor.y);
  doc.setFontSize(7);
  doc.setTextColor(...PDF_INK);
  doc.text(lines, PDF_MARGIN, cursor.y + 3);
  cursor.y += 3.4 + lines.length * 3.2;
}

function drawRequisitionBody(
  cursor: PdfCursor,
  requisition: ServiceOrderRequisition,
  fulfillments: Awaited<ReturnType<typeof getRequisitionFulfillments>>,
  purchases: PurchaseRequest[],
  displayName: (key: string) => string,
  lotsByProduct: Map<string, FulfillmentLotOption[]>,
  chosenLots?: RequisitionPrintOptions["chosenLots"]
) {
  const doc = cursor.doc;
  compactSection(cursor, "Material solicitado");
  const groups = groupRequisitionLines([requisition]);
  const rows: PdfRow[] = groups.map((group, index) => {
    const linked = group.sources.flatMap((source) => purchaseForLine(source.line.id, purchases));
    const buy = [...new Set(linked.map((purchase) => `${purchase.folio} · ${purchaseStatusLabel(purchase.status)}`))];
    const notes = group.sources
      .map((source) => source.line.notes)
      .filter(Boolean)
      .filter((note, noteIndex, list) => list.indexOf(note) === noteIndex);
    return {
      cells: {
        n: String(index + 1),
        sku: group.productSku || "—",
        part: group.partNumber.trim() || "—",
        desc: materialCell(
          group,
          group.productId ? lotsByProduct.get(group.productId) : undefined,
          group.productId ? chosenLots?.[group.productId] : undefined,
          notes
        ),
        unit: group.unit,
        req: formatPdfQty(group.quantityRequested),
        ful: formatPdfQty(group.quantityFulfilled),
        pend: formatPdfQty(group.pending),
        buy: [requisitionLineStatusLabel(group.lineStatus), ...buy],
      },
      styles: {
        req: "bold",
        ful: group.quantityFulfilled > 0 ? "success" : "muted",
        pend: group.pending > 0 ? "danger" : "bold",
      },
    };
  });
  drawTable(cursor, COLUMNS, rows);

  const totals = groups.reduce(
    (acc, group) => ({
      req: acc.req + group.quantityRequested,
      ful: acc.ful + group.quantityFulfilled,
      pend: acc.pend + group.pending,
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
    compactSection(cursor, "Surtidos registrados");
    const lineById = new Map(requisition.lines.map((line) => [line.id, line]));
    for (const item of fulfillments) {
      const line = item.lineId ? lineById.get(item.lineId) : undefined;
      const note = item.notes.trim();
      const noteLines = note
        ? (doc.splitTextToSize(note, cursor.contentW - 32) as string[]).slice(0, 2)
        : [];
      cursor.ensure(5 + noteLines.length * 3.2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...PDF_MUTED);
      doc.text(formatPdfDate(item.createdAt, true), PDF_MARGIN, cursor.y);
      doc.setTextColor(...PDF_INK);
      const part = line?.partNumber.trim();
      const model = line?.productModel.trim();
      const brand = line?.productBrand.trim();
      doc.text(
        `${formatPdfQty(item.quantity)} × ${
          line
            ? `${line.productSku ? `${line.productSku} · ` : ""}${brand ? `${brand} · ` : ""}${model ? `modelo ${model} · ` : ""}${part ? `n.º ${part} · ` : ""}${line.description}`
            : "Material"
        }`,
        PDF_MARGIN + 32,
        cursor.y,
        { maxWidth: 100 }
      );
      doc.setTextColor(...PDF_MUTED);
      doc.text(`Surtió: ${displayName(item.fulfilledBy)}`, PDF_MARGIN + cursor.contentW, cursor.y, {
        align: "right",
      });
      cursor.y += 4.2;
      if (noteLines.length) {
        doc.setFontSize(7);
        doc.text(noteLines, PDF_MARGIN + 32, cursor.y);
        cursor.y += noteLines.length * 3.2;
      }
    }
    cursor.y += 2;
  }

  if (purchases.length) {
    compactSection(cursor, "Compras por faltantes");
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
      const partByLine = new Map(requisition.lines.map((line) => [line.id, line.partNumber.trim()]));
      const items = purchase.lines
        .map((line) => {
          const part = line.requisitionLineId ? partByLine.get(line.requisitionLineId) : "";
          return `${formatPdfQty(line.quantity)} ${line.unit}${part ? ` · n.º ${part}` : ""} ${line.description}`;
        })
        .join(" · ");
      const wrapped = doc.splitTextToSize(items, cursor.contentW - 28) as string[];
      cursor.ensure(wrapped.length * 3.6);
      doc.text(wrapped, PDF_MARGIN + 28, cursor.y);
      cursor.y += wrapped.length * 3.6 + 2;
    }
  }
}
