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

export type PdfImage = { dataUrl: string; format: "PNG" | "JPEG" };

export async function loadCompanySealDataUrl(): Promise<PdfImage | null> {
  const png = await fetchAsDataUrl(COMPANY_BRAND.sealPath);
  if (png) return { dataUrl: png, format: formatFromDataUrl(png) };
  return null;
}

/** Dibuja el sello ajustado (sin deformar) y centrado dentro del área indicada. */
export function drawSealImage(
  doc: jsPDF,
  seal: PdfImage,
  x: number,
  y: number,
  w: number,
  h: number
) {
  try {
    const props = doc.getImageProperties(seal.dataUrl);
    const ratio = props.width && props.height ? props.width / props.height : 1;
    let drawW = w;
    let drawH = w / ratio;
    if (drawH > h) {
      drawH = h;
      drawW = h * ratio;
    }
    doc.addImage(
      seal.dataUrl,
      seal.format,
      x + (w - drawW) / 2,
      y + (h - drawH) / 2,
      drawW,
      drawH
    );
    return true;
  } catch {
    return false;
  }
}

/** Sello de la empresa alineado a la derecha, con leyenda; devuelve la Y siguiente. */
export async function drawCompanySealBlock(doc: jsPDF, y: number): Promise<number> {
  const seal = await loadCompanySealDataUrl();
  if (!seal) return y;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const w = 48;
  const h = 34;
  if (y + h + 8 > pageH - 14) {
    doc.addPage();
    y = 18;
  }
  const x = pageW - margin - w;
  drawSealImage(doc, seal, x, y, w, h);
  doc.setDrawColor(190, 190, 198);
  doc.line(x, y + h + 1.5, x + w, y + h + 1.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(110, 110, 110);
  doc.text("Sello de Medical Advanced Supplies", x + w / 2, y + h + 5, { align: "center" });
  return y + h + 10;
}

type BrandedHeaderOptions = {
  title: string;
  folio?: string;
  rightLines?: string[];
  margin?: number;
  documentCode?: string;
};

/** Dibuja el encabezado con datos fiscales, folio, logo ISO y barra de título; devuelve la Y siguiente. */
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

  const top = 10;
  const blockH = 25;

  let hasLogo = false;
  if (logo) {
    try {
      doc.addImage(logo.dataUrl, logo.format, margin, top + 1, 22, 22);
      hasLogo = true;
    } catch {
      hasLogo = false;
    }
  }

  const isoHeight = 21;
  let isoWidth = 0;
  if (iso) {
    try {
      const props = doc.getImageProperties(iso.dataUrl);
      const ratio = props.width && props.height ? props.width / props.height : 1;
      isoWidth = isoHeight * ratio;
      doc.addImage(
        iso.dataUrl,
        iso.format,
        pageW - margin - isoWidth,
        top + (blockH - isoHeight) / 2,
        isoWidth,
        isoHeight
      );
    } catch {
      isoWidth = 0;
    }
  }

  const infoW = 42;
  const infoRight = isoWidth ? pageW - margin - isoWidth - 3 : pageW - margin;
  const infoX = infoRight - infoW;
  const textX = hasLogo ? margin + 26 : margin;
  const textMaxW = infoX - textX - 4;

  if (hasLogo) {
    doc.setDrawColor(222, 226, 240);
    doc.line(margin + 24, top + 1, margin + 24, top + blockH - 1);
  }

  let nameSize = 13;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(nameSize);
  while (nameSize > 9 && doc.getTextWidth(COMPANY_BRAND.fiscalName) > textMaxW) {
    nameSize -= 0.5;
    doc.setFontSize(nameSize);
  }
  doc.setTextColor(59, 70, 165);
  doc.text(COMPANY_BRAND.fiscalName, textX, top + 4.5);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 150, 210);
  doc.text(COMPANY_BRAND.tagline, textX, top + 8.8);

  const labelled = (label: string, value: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(59, 70, 165);
    doc.text(label, textX, y);
    const labelW = doc.getTextWidth(`${label} `);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(value, textX + labelW, y);
  };

  labelled("RFC:", COMPANY_BRAND.rfc, top + 13);
  labelled("Domicilio:", COMPANY_BRAND.addressLines[0], top + 16.6);
  doc.text(
    COMPANY_BRAND.addressLines[1],
    textX + doc.getTextWidth("Domicilio: "),
    top + 19.8
  );
  labelled(
    "Tel.",
    [COMPANY_BRAND.phone, COMPANY_BRAND.email].filter(Boolean).join("   ·   "),
    top + 23.4
  );

  doc.setFillColor(243, 245, 251);
  doc.setDrawColor(210, 216, 236);
  doc.roundedRect(infoX, top, infoW, blockH, 1.5, 1.5, "FD");
  doc.setFillColor(59, 70, 165);
  doc.rect(infoX, top + 1.5, 1.2, blockH - 3, "F");

  const infoCx = infoX + infoW / 2 + 0.6;
  const infoLines = (options.rightLines ?? []).slice(0, 2);
  let infoY = top + (blockH - (8.8 + 3.6 * infoLines.length)) / 2 + 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(110, 110, 110);
  doc.text(options.folio ? "FOLIO" : "DOCUMENTO", infoCx, infoY, { align: "center" });
  infoY += 4.6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(options.folio || documentCode, infoCx, infoY, { align: "center" });
  infoY += 4.2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(`${COMPANY_BRAND.isoLabel} · Cód. ${documentCode}`, infoCx, infoY, {
    align: "center",
  });
  for (const line of infoLines) {
    infoY += 3.6;
    doc.text(line, infoCx, infoY, { align: "center" });
  }

  const barY = top + blockH + 3;
  doc.setFillColor(59, 70, 165);
  doc.roundedRect(margin, barY, pageW - margin * 2, 7, 1.2, 1.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(options.title.toUpperCase(), margin + 3.5, barY + 4.8);

  return barY + 14;
}

/** Datos fiscales en una línea, para pies de página o notas. */
export function companyFiscalLine() {
  return [
    COMPANY_BRAND.fiscalName,
    `RFC ${COMPANY_BRAND.rfc}`,
    COMPANY_BRAND.address,
    COMPANY_BRAND.phone ? `Tel. ${COMPANY_BRAND.phone}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
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
      pageH - 8
    );
    doc.text(`Página ${i} de ${pages}`, pageW - 14, pageH - 8, {
      align: "right",
    });
    doc.setFontSize(6.5);
    doc.setTextColor(140, 140, 140);
    doc.text(companyFiscalLine(), pageW / 2, pageH - 4.5, { align: "center" });
  }
}
