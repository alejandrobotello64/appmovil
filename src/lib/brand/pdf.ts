import { jsPDF } from "jspdf";
import { COMPANY_BRAND } from "./company";

async function fetchAsDataUrl(path: string): Promise<string | null> {
  try {
    const response = await fetch(path);
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

export async function loadCompanyLogoDataUrl(): Promise<{
  dataUrl: string;
  format: "PNG" | "JPEG";
} | null> {
  const png = await fetchAsDataUrl(COMPANY_BRAND.logoPath);
  if (png) return { dataUrl: png, format: "PNG" };
  const jpg = await fetchAsDataUrl(COMPANY_BRAND.logoAltPath);
  if (jpg) return { dataUrl: jpg, format: "JPEG" };
  return null;
}

type BrandedHeaderOptions = {
  title: string;
  folio?: string;
  rightLines?: string[];
  margin?: number;
};

/** Dibuja barra de marca + logo + nombre y devuelve la Y siguiente. */
export async function drawBrandedHeader(
  doc: jsPDF,
  options: BrandedHeaderOptions
): Promise<number> {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = options.margin ?? 14;

  doc.setFillColor(0, 191, 255);
  doc.rect(0, 0, pageW, 4, "F");
  doc.setFillColor(59, 70, 165);
  doc.rect(0, 4, pageW, 2, "F");

  const logo = await loadCompanyLogoDataUrl();
  let hasLogo = false;
  if (logo) {
    try {
      doc.addImage(logo.dataUrl, logo.format, margin, 10, 18, 18);
      hasLogo = true;
    } catch {
      hasLogo = false;
    }
  }

  const textX = hasLogo ? margin + 22 : margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(59, 70, 165);
  doc.text(COMPANY_BRAND.legalName, textX, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(COMPANY_BRAND.tagline, textX, 21);

  const contactBits = [
    COMPANY_BRAND.email,
    COMPANY_BRAND.phone,
    COMPANY_BRAND.address,
  ].filter(Boolean);
  if (contactBits.length) {
    doc.text(contactBits.join(" · "), textX, 25.5);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  if (options.folio) {
    doc.text(options.folio, pageW - margin, 16, { align: "right" });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(options.title, textX, 30);

  let rightY = 22;
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  for (const line of options.rightLines ?? []) {
    doc.text(line, pageW - margin, rightY, { align: "right" });
    rightY += 4.5;
  }

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, 34, pageW - margin, 34);
  return 40;
}

export function drawBrandedFooter(doc: jsPDF, note?: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 220, 220);
    doc.line(14, pageH - 12, pageW - 14, pageH - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
      note ||
        `${COMPANY_BRAND.legalName} · ${COMPANY_BRAND.email || COMPANY_BRAND.address}`,
      14,
      pageH - 7
    );
    doc.text(`Página ${i} de ${pages}`, pageW - 14, pageH - 7, {
      align: "right",
    });
  }
}
