import { supabase } from "@/lib/supabase/client";
import {
  isDocArea,
  type CatalogDocType,
  type CatalogDocument,
  type CatalogDocumentInput,
  type DocArea,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const CATALOG_BUCKET = "sales-catalog";
export const CATALOG_MAX_FILE_BYTES = 50 * 1024 * 1024;

function mapDocument(row: Record<string, unknown>): CatalogDocument {
  return {
    id: String(row.id),
    area: isDocArea(row.area) ? row.area : "ventas",
    title: String(row.title ?? ""),
    docType: String(row.doc_type ?? "otro") as CatalogDocType,
    brand: String(row.brand ?? ""),
    productLine: String(row.product_line ?? ""),
    model: String(row.model ?? ""),
    description: String(row.description ?? ""),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    version: String(row.version ?? ""),
    validUntil: row.valid_until ? String(row.valid_until) : "",
    filePath: String(row.file_path ?? ""),
    fileUrl: String(row.file_url ?? ""),
    fileName: String(row.file_name ?? ""),
    fileSize: Number(row.file_size ?? 0),
    mimeType: String(row.mime_type ?? ""),
    uploadedBy: String(row.uploaded_by ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapInput(input: CatalogDocumentInput) {
  return {
    title: input.title.trim(),
    doc_type: input.docType,
    brand: (input.brand ?? "").trim(),
    product_line: (input.productLine ?? "").trim(),
    model: (input.model ?? "").trim(),
    description: (input.description ?? "").trim(),
    tags: input.tags ?? [],
    version: (input.version ?? "").trim(),
    valid_until: input.validUntil || null,
  };
}

export async function getCatalogDocuments(
  area: DocArea
): Promise<CatalogDocument[]> {
  const { data, error } = await db
    .from("sales_catalog_documents")
    .select("*")
    .eq("area", area)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapDocument);
}

export async function uploadCatalogDocument(
  input: CatalogDocumentInput & {
    area: DocArea;
    file: File;
    uploadedBy?: string;
  }
): Promise<CatalogDocument> {
  if (input.file.size > CATALOG_MAX_FILE_BYTES) {
    throw new Error("El archivo supera el límite de 50 MB.");
  }
  const safeName = input.file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${input.area}/${input.docType}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(CATALOG_BUCKET)
    .upload(path, input.file, {
      upsert: false,
      contentType: input.file.type || undefined,
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicData } = supabase.storage
    .from(CATALOG_BUCKET)
    .getPublicUrl(path);

  const { data, error } = await db
    .from("sales_catalog_documents")
    .insert({
      ...mapInput({ ...input, title: input.title.trim() || input.file.name }),
      area: input.area,
      file_path: path,
      file_url: publicData.publicUrl,
      file_name: input.file.name,
      file_size: input.file.size,
      mime_type: input.file.type || "",
      uploaded_by: (input.uploadedBy ?? "").trim(),
    })
    .select("*")
    .single();
  if (error) {
    await supabase.storage.from(CATALOG_BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return mapDocument(data);
}

export async function updateCatalogDocument(
  id: string,
  input: CatalogDocumentInput
): Promise<CatalogDocument> {
  if (!input.title.trim()) throw new Error("El título es obligatorio.");
  const { data, error } = await db
    .from("sales_catalog_documents")
    .update({ ...mapInput(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapDocument(data);
}

export async function deleteCatalogDocument(doc: CatalogDocument): Promise<void> {
  if (doc.filePath) {
    await supabase.storage.from(CATALOG_BUCKET).remove([doc.filePath]);
  }
  const { error } = await db
    .from("sales_catalog_documents")
    .delete()
    .eq("id", doc.id);
  if (error) throw new Error(error.message);
}
