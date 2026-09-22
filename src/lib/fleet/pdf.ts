import { jsPDF } from "jspdf";
import { drawBrandedFooter, drawBrandedHeader } from "@/lib/brand/pdf";
import {
  vehicleServiceStatusLabel,
  vehicleServiceTypeLabel,
  type VehicleService,
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
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

/** PDF de registro de servicio a vehículo de la empresa. */
export async function downloadVehicleServicePdf(service: VehicleService) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = await drawBrandedHeader(doc, {
    title: "Registro de servicio · Flotilla empresarial",
    folio: service.folio,
    rightLines: [`Estatus: ${vehicleServiceStatusLabel(service.status)}`],
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(service.title || vehicleServiceTypeLabel(service.serviceType), margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Vehículo", margin, y);
  doc.text("Taller / técnico", pageW / 2, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);

  const left = [
    `${service.vehiclePlate} · ${service.vehicleCode}`,
    service.vehicleLabel || undefined,
    service.odometerKm != null ? `Od├│metro: ${service.odometerKm} km` : undefined,
  ].filter(Boolean) as string[];
  const right = [
    service.workshop || undefined,
    service.technician ? `T├®cnico: ${service.technician}` : undefined,
    service.requestedBy ? `Solicitó: ${service.requestedBy}` : undefined,
  ].filter(Boolean) as string[];

  const n = Math.max(left.length, right.length, 1);
  for (let i = 0; i < n; i++) {
    if (left[i]) doc.text(left[i], margin, y + i * 4.5);
    if (right[i]) doc.text(right[i], pageW / 2, y + i * 4.5);
  }
  y += n * 4.5 + 6;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Fechas", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  doc.text(
    `Programado: ${formatDate(service.scheduledAt)} · Inicio: ${formatDate(service.startedAt)} · Fin: ${formatDate(service.completedAt)}`,
    margin,
    y
  );
  y += 8;

  if (service.description) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Descripción del trabajo", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(service.description, 180);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 4;
  }

  if (service.lines.length) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Conceptos", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const line of service.lines) {
      const amount = Number(line.quantity) * Number(line.unitCost);
      doc.text(`• ${line.description}`, margin, y);
      doc.text(
        `${line.quantity} × ${money(line.unitCost)} = ${money(amount)}`,
        pageW - margin,
        y,
        { align: "right" }
      );
      y += 4.5;
    }
    y += 3;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Mano de obra: ${money(service.laborCost)}`, pageW - margin, y, {
    align: "right",
  });
  y += 5;
  doc.text(`Refacciones: ${money(service.partsCost)}`, pageW - margin, y, {
    align: "right",
  });
  y += 5;
  doc.text(`Otros: ${money(service.otherCost)}`, pageW - margin, y, {
    align: "right",
  });
  y += 6;
  doc.setFontSize(12);
  doc.text(`Total: ${money(service.totalCost)}`, pageW - margin, y, {
    align: "right",
  });

  if (service.notes) {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text("Notas", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const notes = doc.splitTextToSize(service.notes, 180);
    doc.text(notes, margin, y);
  }

  drawBrandedFooter(doc);
  doc.save(`${service.folio}-servicio-flotilla.pdf`);
}
