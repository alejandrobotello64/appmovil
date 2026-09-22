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

function formatFromDataUrl(dataUrl: string): "PNG" | "JPEG" {
  if (
    dataUrl.startsWith("data:image/jpeg") ||
    dataUrl.startsWith("data:image/jpg")
  ) {
    return "JPEG";
  }
  return "PNG";
}

export async function loadCompanyLogoDataUrl(): Promise<{
  dataUrl: string;
  format: "PNG" | "JPEG";
} | null> {
  const png = await fetchAsDataUrl(COMPANY_BRAND.logoPath);
  if (png) return { dataUrl: png, format: formatFromDataUrl(png) };
  const jpg = await fetchAsDataUrl(COMPANY_BRAND.logoAltPath);
  if (jpg) return { dataUrl: jpg, format: formatFromDataUrl(jpg) };
  return null;
}

export async function loadIsoLogoDataUrl(): Promise<{
  dataUrl: string;
  format: "PNG" | "JPEG";
} | null> {
  const png = await fetchAsDataUrl(COMPANY_BRAND.isoLogoPath);
  if (png) return { dataUrl: png, format: formatFromDataUrl(png) };
  return null;
}

type BrandedHeaderOptions = {
  title: string;
  folio?: string;
  rightLines?: string[];
  margin?: number;
  documentCode?: string;
};

/** Dibuja barra de marca + logos MAS/ISO + código de formato y devuelve la Y siguiente. */
export async function drawBrandedHeader(
  doc: jsPDF,
  options: BrandedHeaderOptions
): Promise<number> {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = options.margin ?? 14;
  const documentCode = options.documentCode ?? COMPANY_BRAND.documentCode;

  doc.setFillColor(0, 191, 255);
  doc.rect(0, 0, pageW, 4, "F");
  doc.setFillColor(59, 70, 165);
  doc.rect(0, 4, pageW, 2, "F");

  const [logo, iso] = await Promise.all([
    loadCompanyLogoDataUrl(),
    loadIsoLogoDataUrl(),
  ]);

  let hasLogo = false;
  if (logo) {
    try {
      doc.addImage(logo.dataUrl, logo.format, margin, 10, 18, 18);
      hasLogo = true;
    } catch {
      hasLogo = false;
    }
  }

  const isoSize = 18;
  let hasIso = false;
  if (iso) {
    try {
      doc.addImage(
        iso.dataUrl,
        iso.format,
        pageW - margin - isoSize,
        9,
        isoSize,
        isoSize
      );
      hasIso = true;
    } catch {
      hasIso = false;
    }
  }

  const textX = hasLogo ? margin + 22 : margin;
  const rightX = hasIso ? pageW - margin - isoSize - 3 : pageW - margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(59, 70, 165);
  doc.text(COMPANY_BRAND.legalName, textX, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(COMPANY_BRAND.tagline, textX, 20);
  doc.text(`${COMPANY_BRAND.isoLabel} · Cód. formato: ${documentCode}`, textX, 24.5);

  const contactBits = [
    COMPANY_BRAND.email,
    COMPANY_BRAND.phone,
    COMPANY_BRAND.address,
  ].filter(Boolean);
  if (contactBits.length) {
    doc.text(contactBits.join(" · "), textX, 29);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  if (options.folio) {
    doc.text(options.folio, rightX, 14, { align: "right" });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`Cód. ${documentCode}`, rightX, options.folio ? 19 : 14, {
    align: "right",
  });

  let rightY = options.folio ? 23.5 : 18.5;
  for (const line of options.rightLines ?? []) {
    doc.text(line, rightX, rightY, { align: "right" });
    rightY += 4;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(options.title, textX, 35);

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, 39, pageW - margin, 39);
  return 45;
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
        `${COMPANY_BRAND.legalName} · ${COMPANY_BRAND.isoLabel} · Cód. ${COMPANY_BRAND.documentCode}`,
      14,
      pageH - 7
    );
    doc.text(`Página ${i} de ${pages}`, pageW - 14, pageH - 7, {
      align: "right",
    });
  }
}
