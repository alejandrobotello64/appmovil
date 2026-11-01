const IMAGE_NAME = /\.(jpe?g|png|webp|gif|heic|heif|bmp|avif)$/i;

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  bmp: "image/bmp",
  avif: "image/avif",
  pdf: "application/pdf",
  xml: "application/xml",
};

function extension(name: string) {
  const clean = name.split("?")[0] ?? name;
  const base = clean.split("/").pop() ?? clean;
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export function isReceiptImageName(name: string) {
  return IMAGE_NAME.test(name.split("?")[0] ?? name);
}

export function isImageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  if (file.type === "application/pdf" || file.type.includes("xml")) return false;
  return isReceiptImageName(file.name);
}

/** A camera file sometimes arrives without a type or extension. Keep real images as they are. */
export function ensureTicketPhoto(file: File) {
  if (isImageFile(file)) return file;
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^\w\-]+/g, "_") || "ticket";
  return new File([file], `${base}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
}

export function isPdfFile(file: File) {
  if (file.type === "application/pdf") return true;
  if (file.type.startsWith("image/")) return false;
  return file.name.toLowerCase().endsWith(".pdf");
}

/** Some phone cameras omit the MIME type. Storage still needs one. */
export function receiptContentType(file: File) {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  return MIME_BY_EXT[extension(file.name)] ?? (isImageFile(file) ? "image/jpeg" : "application/octet-stream");
}

export function receiptDisplay(path: string, url: string) {
  const source = path || url;
  const rawName = (source.split("?")[0] ?? source).split("/").pop() ?? "";
  let storedName = rawName;
  try {
    storedName = decodeURIComponent(rawName);
  } catch {
    storedName = rawName;
  }
  const ext = extension(storedName);
  const image = isReceiptImageName(storedName);
  const fileName = storedName.replace(/^\d+-/, "") || (image ? "ticket.jpg" : "comprobante.pdf");
  return {
    image,
    fileName,
    mime: MIME_BY_EXT[ext] ?? (image ? "image/jpeg" : "application/pdf"),
    label: image ? "Foto del ticket" : "Comprobante",
  };
}
