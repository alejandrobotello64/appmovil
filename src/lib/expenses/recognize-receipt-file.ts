"use server";

import { extractText } from "unpdf";
import { isImageFile, isPdfFile } from "./receipt-file";
import { recognizeExpenseReceipt, recognizeExpenseText, type ReceiptFill } from "./receipt-recognition";

export type ReceiptReadResult = { fill: ReceiptFill } | { error: string };

function isXml(file: File) {
  return file.type.includes("xml") || file.name.toLowerCase().endsWith(".xml");
}

/** Lee un XML de CFDI o el texto de un PDF y devuelve los datos del gasto. */
export async function recognizeReceiptUpload(formData: FormData): Promise<ReceiptReadResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No se recibió el archivo." };
  if (isImageFile(file)) {
    return { error: "Una foto no se puede leer. Sube el XML o un PDF con texto, o captura los datos." };
  }

  try {
    if (isXml(file)) return { fill: recognizeExpenseReceipt(await file.text()) };
    if (isPdfFile(file)) {
      const extracted = await extractText(new Uint8Array(await file.arrayBuffer()), { mergePages: true });
      return { fill: recognizeExpenseText(extracted.text) };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo leer el archivo." };
  }

  return { error: "Sube el XML del CFDI o un PDF con texto." };
}
