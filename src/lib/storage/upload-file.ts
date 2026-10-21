import {
  getConfiguredSupabaseUrl,
  getSupabaseAnonKey,
  isLoopbackUrl,
  supabase,
} from "@/lib/supabase/client";

/** TUS exige múltiplos de 6 MB en Storage de Supabase. */
const TUS_CHUNK_BYTES = 6 * 1024 * 1024;
/** El plan Free de Supabase corta objetos de más de 50 MB; las partes van por debajo. */
export const STORAGE_PART_BYTES = 40 * 1024 * 1024;
const MANIFEST_NAME = "manifest.json";

export type StorageUploadProgress = {
  uploaded: number;
  total: number;
};

export type StorageUploadResult = {
  path: string;
  publicUrl: string;
  chunked: boolean;
};

type ChunkManifest = {
  v: 1;
  chunked: true;
  parts: number;
  fileName: string;
  mimeType: string;
  totalSize: number;
};

function publicUrl(bucket: string, path: string) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function storageEndpoint() {
  return `${getConfiguredSupabaseUrl().replace(/\/$/, "")}/storage/v1/upload/resumable`;
}

function canUseResumable(size: number) {
  return (
    typeof window !== "undefined" &&
    size > TUS_CHUNK_BYTES &&
    !isLoopbackUrl(getConfiguredSupabaseUrl())
  );
}

async function standardUpload(
  bucket: string,
  path: string,
  body: Blob,
  options?: { upsert?: boolean; contentType?: string }
) {
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    upsert: options?.upsert ?? false,
    contentType: options?.contentType || body.type || undefined,
  });
  if (error) throw new Error(error.message);
}

async function resumableUpload(
  bucket: string,
  path: string,
  body: Blob,
  options?: {
    upsert?: boolean;
    contentType?: string;
    onProgress?: (progress: StorageUploadProgress) => void;
  }
) {
  const tus = await import("tus-js-client");
  const key = getSupabaseAnonKey();
  const file =
    body instanceof File
      ? body
      : new File([body], path.split("/").pop() || "archivo", {
          type: options?.contentType || body.type || "application/octet-stream",
        });
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: storageEndpoint(),
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${key}`,
        apikey: key,
        "x-upsert": String(options?.upsert ?? false),
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: TUS_CHUNK_BYTES,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType:
          options?.contentType || file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      onError: (error) => reject(error),
      onProgress: (uploaded, total) => {
        options?.onProgress?.({ uploaded, total });
      },
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

async function uploadOneObject(
  bucket: string,
  path: string,
  body: Blob,
  options?: {
    upsert?: boolean;
    contentType?: string;
    onProgress?: (progress: StorageUploadProgress) => void;
  }
) {
  if (canUseResumable(body.size)) {
    try {
      await resumableUpload(bucket, path, body, options);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/\b404\b/.test(message)) {
        throw error instanceof Error
          ? error
          : new Error(message || "No se pudo subir el archivo.");
      }
    }
  }
  await standardUpload(bucket, path, body, options);
  options?.onProgress?.({ uploaded: body.size, total: body.size });
}

function partPath(folder: string, index: number) {
  return `${folder}/part-${String(index).padStart(4, "0")}`;
}

function isManifest(value: unknown): value is ChunkManifest {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return row.chunked === true && Number(row.parts) > 0;
}

/** Sube un archivo a Storage. Si pesa más de 40 MB se parte en varios objetos. */
export async function uploadStorageObject(options: {
  bucket: string;
  path: string;
  file: File;
  upsert?: boolean;
  contentType?: string;
  onProgress?: (progress: StorageUploadProgress) => void;
}): Promise<StorageUploadResult> {
  const { bucket, path, file } = options;
  const contentType = options.contentType || file.type || "application/octet-stream";

  if (file.size <= STORAGE_PART_BYTES) {
    await uploadOneObject(bucket, path, file, {
      upsert: options.upsert,
      contentType,
      onProgress: options.onProgress,
    });
    return { path, publicUrl: publicUrl(bucket, path), chunked: false };
  }

  const parts = Math.ceil(file.size / STORAGE_PART_BYTES);
  let uploaded = 0;
  for (let index = 0; index < parts; index += 1) {
    const start = index * STORAGE_PART_BYTES;
    const slice = file.slice(start, start + STORAGE_PART_BYTES, contentType);
    await uploadOneObject(bucket, partPath(path, index), slice, {
      upsert: options.upsert,
      contentType,
      onProgress: (progress) => {
        options.onProgress?.({
          uploaded: uploaded + progress.uploaded,
          total: file.size,
        });
      },
    });
    uploaded += slice.size;
    options.onProgress?.({ uploaded, total: file.size });
  }

  const manifest: ChunkManifest = {
    v: 1,
    chunked: true,
    parts,
    fileName: file.name,
    mimeType: contentType,
    totalSize: file.size,
  };
  const manifestBody = new Blob([JSON.stringify(manifest)], {
    type: "application/json",
  });
  await standardUpload(bucket, `${path}/${MANIFEST_NAME}`, manifestBody, {
    upsert: true,
    contentType: "application/json",
  });

  return {
    path,
    publicUrl: publicUrl(bucket, `${path}/${MANIFEST_NAME}`),
    chunked: true,
  };
}

export async function downloadStorageObject(options: {
  bucket: string;
  path: string;
  fileUrl: string;
}): Promise<Blob> {
  const response = await fetch(options.fileUrl);
  if (!response.ok) {
    throw new Error("No se pudo descargar el archivo.");
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json") && !options.fileUrl.includes(MANIFEST_NAME)) {
    return response.blob();
  }
  const parsed: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  if (!isManifest(parsed)) {
    return response.blob();
  }
  const chunks: Blob[] = [];
  for (let index = 0; index < parsed.parts; index += 1) {
    const url = publicUrl(options.bucket, partPath(options.path, index));
    const part = await fetch(url);
    if (!part.ok) {
      throw new Error(`Faltó la parte ${index + 1} de ${parsed.parts} del archivo.`);
    }
    chunks.push(await part.blob());
  }
  return new Blob(chunks, { type: parsed.mimeType || "application/octet-stream" });
}

export async function removeStorageObject(bucket: string, path: string) {
  const folder = await supabase.storage.from(bucket).list(path, { limit: 1000 });
  const children = (folder.data ?? [])
    .map((entry) => entry.name)
    .filter(Boolean)
    .map((name) => `${path}/${name}`);
  const targets = children.length ? children : [path];
  await supabase.storage.from(bucket).remove(targets);
}
