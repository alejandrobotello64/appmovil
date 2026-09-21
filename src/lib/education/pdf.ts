import { jsPDF } from "jspdf";
import { COMPANY_BRAND } from "@/lib/brand/company";
import { drawBrandedFooter, drawBrandedHeader } from "@/lib/brand/pdf";
import {
  trainingShiftLabel,
  type EducationTraining,
} from "@/lib/education/types";

function formatDate(value: string) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

async function loadImageDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function ensureSpace(doc: jsPDF, y: number, need = 24) {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + need < pageH - 16) return y;
  doc.addPage();
  return 18;
}

/** Genera y descarga la hoja de asistencia / capacitación con branding MAS. */
export async function downloadTrainingPdf(training: EducationTraining) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  let y = await drawBrandedHeader(doc, {
    title: "Hoja de asistencia · Capacitación",
    folio: training.folio,
    rightLines: [
      training.trainingDate ? `Fecha: ${formatDate(training.trainingDate)}` : "",
    ].filter(Boolean),
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(training.name || "Capacitación", margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);

  const metaLeft = [
    training.clientName ? `Cliente: ${training.clientName}` : undefined,
    training.location ? `Lugar: ${training.location}` : undefined,
    training.instructor ? `Instructor: ${training.instructor}` : undefined,
  ].filter(Boolean) as string[];

  const metaRight = [
    training.durationHours != null
      ? `Duración: ${training.durationHours} h`
      : undefined,
    `Asistentes: ${training.attendees.length}`,
  ].filter(Boolean) as string[];

  const metaRows = Math.max(metaLeft.length, metaRight.length, 1);
  for (let i = 0; i < metaRows; i++) {
    if (metaLeft[i]) doc.text(metaLeft[i], margin, y + i * 4.5);
    if (metaRight[i]) doc.text(metaRight[i], pageW / 2, y + i * 4.5);
  }
  y += metaRows * 4.5 + 6;

  if (training.notes) {
    y = ensureSpace(doc, y, 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text("Notas", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    const noteLines = doc.splitTextToSize(training.notes, pageW - margin * 2);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4 + 4;
  }

  y = ensureSpace(doc, y, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(`Asistentes (${training.attendees.length})`, margin, y);
  y += 6;

  doc.setFillColor(245, 247, 252);
  doc.rect(margin, y - 4, pageW - margin * 2, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("#", margin + 1, y);
  doc.text("Nombre", margin + 8, y);
  doc.text("Puesto", margin + 70, y);
  doc.text("Turno", margin + 110, y);
  doc.text("Firma", pageW - margin - 28, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);

  if (!training.attendees.length) {
    doc.text("Sin asistentes registrados.", margin + 1, y);
    y += 8;
  } else {
    for (let idx = 0; idx < training.attendees.length; idx++) {
      const attendee = training.attendees[idx];
      y = ensureSpace(doc, y, 14);
      doc.text(String(idx + 1), margin + 1, y);
      doc.text((attendee.fullName || "—").slice(0, 32), margin + 8, y);
      doc.text((attendee.jobTitle || "—").slice(0, 24), margin + 70, y);
      doc.text(trainingShiftLabel(attendee.shift), margin + 110, y);

      if (attendee.signatureUrl) {
        const sig = await loadImageDataUrl(attendee.signatureUrl);
        if (sig) {
          try {
            const format = sig.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
            doc.addImage(sig, format, pageW - margin - 32, y - 6, 28, 10);
          } catch {
            doc.line(pageW - margin - 32, y + 1, pageW - margin, y + 1);
          }
        } else {
          doc.setDrawColor(180, 180, 180);
          doc.line(pageW - margin - 32, y + 1, pageW - margin, y + 1);
        }
      } else {
        doc.setDrawColor(180, 180, 180);
        doc.line(pageW - margin - 32, y + 1, pageW - margin, y + 1);
      }
      y += 12;
    }
  }

  if (training.photos.length) {
    y = ensureSpace(doc, y, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text("Evidencia fotográfica", margin, y);
    y += 6;

    let x = margin;
    const thumbW = 55;
    const thumbH = 40;
    for (const photo of training.photos.slice(0, 6)) {
      const dataUrl = await loadImageDataUrl(photo.fileUrl);
      if (!dataUrl) continue;
      if (x + thumbW > pageW - margin) {
        x = margin;
        y += thumbH + 8;
      }
      y = ensureSpace(doc, y, thumbH + 10);
      try {
        const format = dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
        doc.addImage(dataUrl, format, x, y, thumbW, thumbH);
        if (photo.caption) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6);
          doc.setTextColor(90, 90, 90);
          doc.text(photo.caption.slice(0, 40), x, y + thumbH + 3);
        }
      } catch {
        // imagen opcional
      }
      x += thumbW + 6;
    }
    if (x > margin) y += thumbH + 10;
  }

  y = ensureSpace(doc, y, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text("_______________________________", margin, y + 12);
  doc.text("Firma instructor", margin, y + 17);
  doc.text("_______________________________", pageW / 2 + 10, y + 12);
  doc.text("Vo.Bo. cliente / responsable", pageW / 2 + 10, y + 17);

  drawBrandedFooter(
    doc,
    `${COMPANY_BRAND.legalName} · ${COMPANY_BRAND.email || COMPANY_BRAND.address}`
  );
  doc.save(`${training.folio || "capacitacion"}-asistencia.pdf`);
}
