export type DocumentPreview = {
  id: number;
  title: string;
  fileName: string;
  url: string;
  mime: string;
  revoke: boolean;
  blob?: Blob;
};

export type PreviewKind = "pdf" | "image" | "video" | "text" | "other";

export type PrintResult =
  | { ok: true; via: "dialog" | "share" }
  | { ok: false; reason: "cancelled" | "too-large" | "unavailable" }
  | { ok: false; reason: "retry"; blob: Blob };

type Listener = (preview: DocumentPreview | null) => void;

const SHARE_BYTE_LIMIT = 40 * 1024 * 1024;

let current: DocumentPreview | null = null;
let seq = 0;
const listeners = new Set<Listener>();

export function subscribeDocumentPreview(listener: Listener) {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  for (const listener of listeners) listener(current);
}

export function closeDocumentPreview() {
  if (current?.revoke) URL.revokeObjectURL(current.url);
  current = null;
  emit();
}

export function openDocumentPreview(input: {
  title: string;
  url: string;
  fileName?: string;
  mime?: string;
  revoke?: boolean;
  blob?: Blob;
}) {
  if (current?.revoke && current.url !== input.url) {
    URL.revokeObjectURL(current.url);
  }
  const fromUrl = fileNameFromUrl(input.url);
  const fileName = input.fileName?.trim() || fromUrl || input.title.trim() || "documento";
  current = {
    id: ++seq,
    title: input.title.trim() || fileName,
    fileName,
    url: input.url,
    mime: resolveMime(input.mime, fileName, fromUrl),
    revoke: Boolean(input.revoke),
    blob: input.blob,
  };
  emit();
}

export function previewKind(mime: string, fileName: string): PreviewKind {
  const type = mime.toLowerCase();
  const ext = extension(fileName);
  if (type === "application/pdf" || ext === "pdf") return "pdf";
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext)) {
    return "image";
  }
  if (type.startsWith("video/") || ["mp4", "webm", "mov"].includes(ext)) return "video";
  if (
    type.startsWith("text/") ||
    type.includes("xml") ||
    type.includes("json") ||
    ["xml", "txt", "csv", "json"].includes(ext)
  ) {
    return "text";
  }
  return "other";
}

export function canPrintPreview(mime: string, fileName: string) {
  const kind = previewKind(mime, fileName);
  return kind === "pdf" || kind === "image";
}

function extension(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

function fileNameFromUrl(url: string) {
  try {
    const path = new URL(url, "http://local").pathname;
    return decodeURIComponent(path.split("/").pop() || "");
  } catch {
    return "";
  }
}

function resolveMime(mime: string | undefined, fileName: string, fromUrl: string) {
  const explicit = mime?.trim() ?? "";
  if (explicit && explicit !== "application/octet-stream") return explicit;
  const fromName = mimeFromName(fileName);
  if (fromName !== "application/octet-stream") return fromName;
  return mimeFromName(fromUrl);
}

function mimeFromName(name: string) {
  const ext = extension(name);
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "xml") return "application/xml";
  if (ext === "txt") return "text/plain";
  if (ext === "csv") return "text/csv";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  return "application/octet-stream";
}

function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char] ?? char;
  });
}

function safeFileName(name: string, kind: PreviewKind) {
  const base = name.trim() || "documento";
  if (kind === "pdf" && !base.toLowerCase().endsWith(".pdf")) return `${base}.pdf`;
  return base;
}

function byteSize(response: Response) {
  const range = response.headers.get("content-range");
  const match = range?.match(/\/(\d+)\s*$/);
  if (match) return Number(match[1]);
  return Number(response.headers.get("content-length") || "0");
}

async function loadPreviewBlob(
  url: string
): Promise<{ blob: Blob | null; status: "ok" | "too-large" | "failed" }> {
  try {
    const probe = await fetch(url, { headers: { Range: "bytes=0-0" } });
    const total = byteSize(probe);
    if (total > SHARE_BYTE_LIMIT) {
      await probe.body?.cancel();
      return { blob: null, status: "too-large" };
    }
    if (probe.status === 206) {
      await probe.body?.cancel();
      if (!total) return { blob: null, status: "failed" };
      const full = await fetch(url);
      if (!full.ok) return { blob: null, status: "failed" };
      const blob = await full.blob();
      if (blob.size > SHARE_BYTE_LIMIT) return { blob: null, status: "too-large" };
      return { blob, status: "ok" };
    }
    const length = Number(probe.headers.get("content-length") || "0");
    if (!probe.ok || !length || length > SHARE_BYTE_LIMIT) {
      await probe.body?.cancel();
      return { blob: null, status: length > SHARE_BYTE_LIMIT ? "too-large" : "failed" };
    }
    const blob = await probe.blob();
    if (blob.size > SHARE_BYTE_LIMIT) return { blob: null, status: "too-large" };
    return { blob, status: "ok" };
  } catch {
    return { blob: null, status: "failed" };
  }
}

function printFrame(frame: HTMLIFrameElement | null | undefined) {
  const win = frame?.contentWindow;
  if (!win) return false;
  try {
    win.focus();
    win.print();
    return true;
  } catch {
    return false;
  }
}

function printImageUrl(url: string, title: string): Promise<boolean> {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.title = title;
    frame.style.cssText =
      "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) {
      frame.remove();
      resolve(false);
      return;
    }
    const safeTitle = escapeHtml(title);
    const safeUrl = escapeHtml(url);
    doc.open();
    doc.write(
      `<!doctype html><html><head><title>${safeTitle}</title><style>@page{margin:12mm}html,body{margin:0}img{max-width:100%;height:auto}</style></head><body><img alt="" src="${safeUrl}"></body></html>`
    );
    doc.close();
    const image = doc.querySelector("img");
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.setTimeout(() => frame.remove(), 60_000);
      resolve(ok);
    };
    const run = () => finish(printFrame(frame));
    if (!image) {
      finish(false);
      return;
    }
    if (image.complete) run();
    else {
      image.addEventListener("load", run, { once: true });
      image.addEventListener("error", () => finish(false), { once: true });
    }
  });
}

async function shareFile(file: File, title: string) {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (!nav.share || (nav.canShare && !nav.canShare({ files: [file] }))) {
    return "unavailable" as const;
  }
  try {
    await nav.share({ files: [file], title, text: title });
    return "shared" as const;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "cancelled" as const;
    return "unavailable" as const;
  }
}

export async function printDocumentPreview(
  preview: Pick<DocumentPreview, "url" | "title" | "fileName" | "mime" | "blob">,
  frame?: HTMLIFrameElement | null
): Promise<PrintResult> {
  const kind = previewKind(preview.mime, preview.fileName);
  const ios = isIos();

  if (kind === "image") {
    const printed = await printImageUrl(preview.url, preview.title);
    if (printed) return { ok: true, via: "dialog" };
  }

  if (ios && preview.blob && kind === "pdf") {
    const file = new File([preview.blob], safeFileName(preview.fileName, kind), {
      type: preview.blob.type || preview.mime || "application/pdf",
    });
    const shared = await shareFile(file, preview.title);
    if (shared === "shared") return { ok: true, via: "share" };
    if (shared === "cancelled") return { ok: false, reason: "cancelled" };
  }

  if (kind === "pdf" && preview.url.startsWith("blob:")) {
    if (printFrame(frame)) return { ok: true, via: "dialog" };
    return { ok: false, reason: "unavailable" };
  }

  if (kind !== "pdf") return { ok: false, reason: "unavailable" };
  if (preview.blob) return { ok: false, reason: "retry", blob: preview.blob };

  const loaded = await loadPreviewBlob(preview.url);
  if (loaded.status === "too-large") return { ok: false, reason: "too-large" };
  if (!loaded.blob) return { ok: false, reason: "unavailable" };
  return { ok: false, reason: "retry", blob: loaded.blob };
}

function clickDownload(url: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function downloadDocumentPreview(
  preview: Pick<DocumentPreview, "url" | "fileName" | "title" | "blob">
) {
  const name = preview.fileName || preview.title || "documento";
  if (preview.blob || preview.url.startsWith("blob:")) {
    clickDownload(preview.url, name);
    return;
  }
  const loaded = await loadPreviewBlob(preview.url);
  if (loaded.blob) {
    const url = URL.createObjectURL(loaded.blob);
    clickDownload(url, name);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  window.open(preview.url, "_blank", "noopener,noreferrer");
}
