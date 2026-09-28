export const DOC_AREAS = ["ventas", "biomedica", "almacen"] as const;

export type DocArea = (typeof DOC_AREAS)[number];

export const CATALOG_DOC_TYPES = [
  { id: "brochure", label: "Brochure", areas: ["ventas"] },
  { id: "folleto", label: "Folleto", areas: ["ventas"] },
  { id: "presentacion", label: "Presentación", areas: ["ventas"] },
  { id: "manual", label: "Manual de usuario", areas: ["biomedica"] },
  { id: "manual_servicio", label: "Manual de servicio", areas: ["biomedica"] },
  { id: "ficha_tecnica", label: "Ficha técnica", areas: ["biomedica"] },
  {
    id: "boletin_servicio",
    label: "Boletín / nota de servicio",
    areas: ["biomedica"],
  },
  {
    id: "procedimiento",
    label: "Procedimiento de mantenimiento",
    areas: ["biomedica"],
  },
  { id: "diagrama", label: "Diagrama / esquema", areas: ["biomedica"] },
  {
    id: "registro_sanitario",
    label: "Registro sanitario",
    areas: ["almacen"],
  },
  {
    id: "prorroga_registro",
    label: "Prórroga / modificación de registro",
    areas: ["almacen"],
  },
  { id: "certificado", label: "Certificado", areas: ["almacen"] },
  {
    id: "otro",
    label: "Otro documento",
    areas: ["ventas", "biomedica", "almacen"],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  areas: readonly DocArea[];
}[];

export type CatalogDocType = (typeof CATALOG_DOC_TYPES)[number]["id"];

export function docTypesForArea(area: DocArea) {
  return CATALOG_DOC_TYPES.filter((type) =>
    (type.areas as readonly DocArea[]).includes(area)
  );
}

export function isDocArea(value: unknown): value is DocArea {
  return DOC_AREAS.includes(value as DocArea);
}

/** Tipos cuya vigencia conviene vigilar (se vencen o se actualizan). */
export const CATALOG_TYPES_WITH_VALIDITY: CatalogDocType[] = [
  "certificado",
  "registro_sanitario",
  "prorroga_registro",
];

export type CatalogDocument = {
  id: string;
  area: DocArea;
  title: string;
  docType: CatalogDocType;
  brand: string;
  productLine: string;
  model: string;
  description: string;
  tags: string[];
  version: string;
  validUntil: string;
  filePath: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CatalogDocumentInput = {
  title: string;
  docType: CatalogDocType;
  brand?: string;
  productLine?: string;
  model?: string;
  description?: string;
  tags?: string[];
  version?: string;
  validUntil?: string;
};

export function catalogDocTypeLabel(type: string) {
  return CATALOG_DOC_TYPES.find((item) => item.id === type)?.label ?? type;
}

export function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,;\n]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

export function formatFileSize(bytes: number) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export type FileKind = "pdf" | "image" | "video" | "sheet" | "doc" | "slides" | "other";

export function fileKind(doc: Pick<CatalogDocument, "mimeType" | "fileName">): FileKind {
  const mime = doc.mimeType.toLowerCase();
  const ext = doc.fileName.toLowerCase().split(".").pop() ?? "";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (["xls", "xlsx", "csv"].includes(ext)) return "sheet";
  if (["doc", "docx", "odt", "rtf", "txt"].includes(ext)) return "doc";
  if (["ppt", "pptx", "odp", "key"].includes(ext)) return "slides";
  return "other";
}