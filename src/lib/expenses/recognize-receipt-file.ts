"use server";

import { extractText } from "unpdf";
import { recognizeExpenseReceipt, recognizeExpenseText, type ReceiptFill } from "./receipt-recognition";

export type ReceiptReadResult = { fill: ReceiptFill } | { error: string };

function isImage(file: File) {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
}

function isXml(file: File) {
  return file.type.includes("xml") || file.name.toLowerCase().endsWith(".xml");
}

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/** Lee un XML de CFDI o el texto de un PDF y devuelve los datos del gasto. */
export async function recognizeReceiptUpload(formData: FormData): Promise<ReceiptReadResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No se recibió el archivo." };
  if (isImage(file)) {
    return { error: "Una foto no se puede leer. Sube el XML o un PDF con texto, o captura los datos." };
  }

  try {
    if (isXml(file)) return { fill: recognizeExpenseReceipt(await file.text()) };
    if (isPdf(file)) {
      const extracted = await extractText(new Uint8Array(await file.arrayBuffer()), { mergePages: true });
      return { fill: recognizeExpenseText(extracted.text) };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo leer el archivo." };
  }

  return { error: "Sube el XML del CFDI o un PDF con texto." };
}
