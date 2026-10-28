import { jsPDF } from "jspdf";
import { drawBrandedFooter, drawBrandedHeader } from "@/lib/brand/pdf";
import {
  PDF_INK,
  PDF_MARGIN,
  PDF_MUTED,
  PDF_SUCCESS,
  PdfCursor,
  drawFieldRow,
  drawParagraph,
  drawSignatures,
  drawTable,
  formatPdfDate,
  formatPdfQty,
  type PdfColumn,
} from "@/lib/brand/pdf-layout";
import { catalogModelLabel } from "@/lib/inventory/product-label";
import { deliverPdf, type PdfIntent } from "@/lib/print/open-pdf";
import { supabase } from "@/lib/supabase/client";
import { loadStaffProfileLookup } from "@/lib/users/staff";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import {
  purchaseOrderTotal,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from "@/lib/warehouse/orders";

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  borrador: "Borrador",
  enviado: "En camino",
  parcial: "Recepción parcial",
  recibido: "Recibido",
  cancelado: "Cancelado",
};

const COLUMNS: PdfColumn[] = [
  { key: "n", label: "#", width: 8, align: "center" },
  { key: "sku", label: "SKU", width: 28 },
  { key: "desc", label: "Material", width: 62 },
  { key: "pedido", label: "Pedido", width: 16, align: "center" },
  { key: "recibido", label: "Recibido", width: 18, align: "center" },
  { key: "lote", label: "Lote / caducidad", width: 50 },
];

type ReceiveLot = {
  productId: string;
  sku: string;
  qty: number;
  lotNumber: string;
  expiryDate: string;
  serial: string;
};

function money(value: number) {
  return value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function isMissingColumnError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const code = String(error.code ?? "");
  const text = `${error.message ?? ""}`.toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    text.includes("does not exist") ||
    text.includes("schema cache")
  );
}

async function loadReceiveLots(orderId: string): Promise<ReceiveLot[]> {
  const { data, error } = await db
    .from("inventory_movements")
    .select(
      "product_id, product_sku, qty_in, related_serial, lot:lots(lot_number, expiry_date)"
    )
    .eq("purchase_order_id", orderId)
    .eq("movement_type", "entrada")
    .order("occurred_at", { ascending: true });
  if (error) {
    if (isMissingColumnError(error)) return [];
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const rawLot = row.lot;
    const lot = (Array.isArray(rawLot) ? rawLot[0] : rawLot ?? {}) as {
      lot_number?: string;
      expiry_date?: string;
    };
    return {
      productId: String(row.product_id ?? ""),
      sku: String(row.product_sku ?? ""),
      qty: Number(row.qty_in ?? 0),
      lotNumber: String(lot.lot_number ?? ""),
      expiryDate: String(lot.expiry_date ?? "").slice(0, 10),
      serial: String(row.related_serial ?? ""),
    };
  });
}

function lotLabel(lots: ReceiveLot[]) {
  if (!lots.length) return "";
  return lots
    .map((lot) => {
      const qty = lot.qty ? `${formatPdfQty(lot.qty)} pza` : "";
      const code = lot.lotNumber ? `lote ${lot.lotNumber}` : "";
      const expiry = lot.expiryDate ? `cad. ${formatPdfDate(lot.expiryDate)}` : "";
      const serial = lot.serial ? `serie ${lot.serial}` : "";
      return [qty, code, expiry, serial].filter(Boolean).join(" · ");
    })
    .join("\n");
}

function drawChecks(
  cursor: PdfCursor,
  items: Array<{ label: string; done: boolean }>
) {
  cursor.sectionTitle("Verificación al recibir");
  const { doc } = cursor;
  const colW = cursor.contentW / 2;
  items.forEach((item, index) => {
    if (index % 2 === 0) cursor.ensure(7);
    const col = index % 2;
    const x = PDF_MARGIN + col * colW;
    const y = cursor.y;
    doc.setDrawColor(120, 120, 130);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y - 3.2, 4.2, 4.2, 0.6, 0.6, "FD");
    if (item.done) {
      doc.setDrawColor(...PDF_SUCCESS);
      doc.setLineWidth(0.7);
      doc.line(x + 0.8, y - 1.1, x + 1.7, y + 0.4);
      doc.line(x + 1.7, y + 0.4, x + 3.4, y - 2.4);
      doc.setLineWidth(0.2);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(...PDF_INK);
    doc.text(item.label, x + 6.2, y);
    if (col === 1 || index === items.length - 1) cursor.y += 7;
  });
  cursor.y += 1;
}

export async function downloadPurchaseOrderReceivePdf(
  order: PurchaseOrder,
  options: { output?: PdfIntent } = {}
) {
  const [lookup, lots] = await Promise.all([
    loadStaffProfileLookup(),
    loadReceiveLots(order.id),
  ]);
  const receiver = lookup(order.createdBy);
  const completed = order.status === "recibido";
  const partial = order.status === "parcial";
  const appointment = [
    formatPdfDate(order.scheduledReceiveAt),
    order.scheduledReceiveTime,
  ]
    .filter((part) => part && part !== "—")
    .join(" · ");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const start = await drawBrandedHeader(doc, {
    title: "Recepción de material",
    folio: order.orderNumber,
    rightLines: [
      `Estatus: ${STATUS_LABEL[order.status]}`,
      completed ? "Documento cerrado" : "Hoja de trabajo de almacén",
    ],
  });
  const cursor = new PdfCursor(doc, start);

  drawFieldRow(cursor, [
    ["Proveedor", order.supplierName || "Sin proveedor"],
    ["Cita de recepción", appointment || "Sin agendar"],
    ["Llegada estimada", formatPdfDate(order.expectedDate)],
    ["Folio pedido", order.orderNumber],
  ]);
  drawFieldRow(cursor, [
    ["Levantó el pedido", receiver?.fullName || order.createdBy || "—"],
    ["Fecha del pedido", formatPdfDate(order.createdAt, true)],
    ["Importe", money(purchaseOrderTotal(order))],
    [
      "Pendiente",
      formatPdfQty(
        order.items.reduce(
          (sum, line) => sum + Math.max(line.quantity - line.receivedQuantity, 0),
          0
        )
      ),
    ],
  ]);
  drawParagraph(cursor, "Nota de la cita", order.scheduledReceiveNote);
  drawParagraph(cursor, "Notas del pedido", order.notes);

  cursor.sectionTitle("Material a recibir");
  drawTable(
    cursor,
    COLUMNS,
    order.items.map((line, index) => {
      const pending = Math.max(line.quantity - line.receivedQuantity, 0);
      const lineLots = lots.filter(
        (lot) =>
          (line.itemId && lot.productId === line.itemId) ||
          (!line.itemId && lot.sku === line.itemSku)
      );
      const lotText = lotLabel(lineLots);
      const receivedText =
        line.receivedQuantity > 0
          ? formatPdfQty(line.receivedQuantity)
          : completed || partial
            ? "0"
            : "";
      return {
        cells: {
          n: String(index + 1),
          sku: line.itemSku || "—",
          desc: [
            line.itemName,
            line.itemId ? catalogModelLabel(line.itemModel) : "Fuera de catálogo · no entra a inventario",
            pending > 0 && line.receivedQuantity > 0
              ? `Aún pendiente: ${formatPdfQty(pending)}`
              : "",
          ],
          pedido: formatPdfQty(line.quantity),
          recibido: receivedText,
          lote: lotText || (completed ? "—" : ""),
        },
        styles: {
          recibido:
            line.receivedQuantity >= line.quantity
              ? "success"
              : line.receivedQuantity > 0
                ? "bold"
                : "muted",
        },
      };
    })
  );

  cursor.ensure(8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_INK);
  const units = order.items.reduce((sum, line) => sum + line.quantity, 0);
  const receivedUnits = order.items.reduce((sum, line) => sum + line.receivedQuantity, 0);
  doc.text(
    `${order.items.length} partida(s) · Pedido ${formatPdfQty(units)} · Recibido ${formatPdfQty(receivedUnits)}`,
    PDF_MARGIN + cursor.contentW,
    cursor.y + 2,
    { align: "right" }
  );
  cursor.y += 8;

  drawChecks(cursor, [
    { label: "Empaque íntegro", done: completed },
    { label: "Cantidades coinciden con la OC", done: completed },
    { label: "Lotes y caducidades capturados", done: completed && lots.some((lot) => lot.lotNumber) },
    { label: "Factura o remisión anexa", done: completed && order.invoices.length > 0 },
    { label: "Material conforme / sin daño", done: completed },
    { label: "Ingresado a inventario", done: completed },
  ]);

  if (!completed) {
    drawParagraph(
      cursor,
      "Cómo completar este documento",
      "Al llegar el material, anota en Recibido la cantidad de cada partida y el lote o caducidad. Si un producto llega en más de un lote, escribe uno por renglón. Marca la verificación, firma quien entrega y quien recibe, y captura la entrada en Pedidos → Recibir."
    );
  }

  drawSignatures(cursor, [
    { title: "Entrega (proveedor)", name: order.supplierName },
    {
      title: "Recibe (almacén)",
      name: completed ? receiver?.fullName || order.createdBy : "",
    },
    { title: "Vo.Bo. compras", name: "" },
  ]);

  drawBrandedFooter(doc);
  await deliverPdf(
    doc,
    `${order.orderNumber}-recepcion-material.pdf`,
    options.output ?? "print"
  );
}
