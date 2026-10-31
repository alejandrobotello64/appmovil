import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";

const ROOT = path.join(process.cwd(), ".data", "storage");
const MAX_BYTES = 50 * 1024 * 1024;

function localStorageEnabled() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return /127\.0\.0\.1|localhost|0\.0\.0\.0/.test(url);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

function unavailable() {
  return json({ message: "Storage local no está activo.", statusCode: "404" }, 404);
}

/** Une segmentos ya decodificados y rechaza rutas que salgan de la carpeta. */
function resolveSafe(parts: string[]) {
  if (parts.some((part) => !part || part === "." || part === ".." || part.includes("\0"))) return null;
  const full = path.resolve(ROOT, ...parts);
  const root = path.resolve(ROOT);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

function metaPath(filePath: string) {
  return `${filePath}.__meta.json`;
}

async function readMeta(filePath: string) {
  try {
    const raw = await readFile(metaPath(filePath), "utf8");
    const parsed = JSON.parse(raw) as { mime?: string };
    return typeof parsed.mime === "string" && parsed.mime ? parsed.mime : "application/octet-stream";
  } catch {
    return "application/octet-stream";
  }
}

async function writeObject(filePath: string, bytes: Uint8Array, mime: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
  await writeFile(metaPath(filePath), JSON.stringify({ mime, size: bytes.byteLength }));
}

function findBytes(haystack: Uint8Array, needle: Uint8Array, from = 0) {
  for (let index = from; index <= haystack.length - needle.length; index += 1) {
    let matches = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[index + offset] !== needle[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) return index;
  }
  return -1;
}

/** Next no logra leer el FormData de estas subidas; se separa el archivo del cuerpo. */
function fileFromMultipart(body: Uint8Array, contentType: string) {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = (boundaryMatch?.[1] ?? boundaryMatch?.[2] ?? "").trim();
  if (!boundary) return null;
  const encoder = new TextEncoder();
  const start = encoder.encode(`--${boundary}`);
  const delimiter = encoder.encode(`\r\n--${boundary}`);
  const headerSep = encoder.encode("\r\n\r\n");
  let cursor = findBytes(body, start);
  if (cursor < 0) return null;
  cursor += start.length;
  while (cursor < body.length) {
    if (body[cursor] === 45 && body[cursor + 1] === 45) break;
    if (body[cursor] === 13 && body[cursor + 1] === 10) cursor += 2;
    const next = findBytes(body, delimiter, cursor);
    const part = body.subarray(cursor, next < 0 ? body.length : next);
    const split = findBytes(part, headerSep);
    if (split >= 0) {
      const header = new TextDecoder().decode(part.subarray(0, split));
      if (/filename=/i.test(header)) {
        const mime = /content-type:\s*([^\r\n]+)/i.exec(header)?.[1]?.trim() || "application/octet-stream";
        return { bytes: part.subarray(split + headerSep.length), mime };
      }
    }
    if (next < 0) break;
    cursor = next + delimiter.length;
  }
  return null;
}

async function readUpload(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (contentType.includes("multipart/form-data")) return fileFromMultipart(bytes, contentType);
  if (bytes.byteLength === 0) return null;
  return { bytes, mime: contentType.split(";")[0] || "application/octet-stream" };
}

async function listPrefix(bucket: string, prefix: string, search: string) {
  const relative = prefix.replace(/^\/+|\/+$/g, "");
  const parts = [bucket, ...relative.split("/").filter(Boolean)];
  const dir = resolveSafe(parts);
  if (!dir) return [];
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const needle = search.trim().toLowerCase();
  const rows = [];
  for (const name of names) {
    if (name.endsWith(".__meta.json")) continue;
    if (needle && !name.toLowerCase().includes(needle)) continue;
    const full = path.join(dir, name);
    const info = await stat(full).catch(() => null);
    if (!info) continue;
    const when = info.mtime.toISOString();
    if (info.isDirectory()) {
      rows.push({
        name,
        id: null,
        updated_at: when,
        created_at: when,
        last_accessed_at: when,
        metadata: null,
      });
      continue;
    }
    rows.push({
      name,
      id: randomUUID(),
      updated_at: when,
      created_at: when,
      last_accessed_at: when,
      metadata: {
        size: info.size,
        mimetype: await readMeta(full),
        cacheControl: "max-age=3600",
      },
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return rows;
}

async function sendFile(parts: string[]) {
  const filePath = resolveSafe(parts);
  if (!filePath) return json({ message: "Ruta inválida.", statusCode: "400" }, 400);
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return json({ message: "No encontrado.", statusCode: "404" }, 404);
    const bytes = await readFile(filePath);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": await readMeta(filePath),
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return json({ message: "No encontrado.", statusCode: "404" }, 404);
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function segments(context: RouteContext) {
  const { path: parts } = await context.params;
  return parts.map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!localStorageEnabled()) return unavailable();
  const parts = await segments(context);
  if (parts[0] !== "object") return unavailable();

  if (parts[1] === "list" && parts[2]) {
    const body = (await request.json().catch(() => ({}))) as { prefix?: string; search?: string };
    return json(await listPrefix(parts[2], body.prefix ?? "", body.search ?? ""));
  }

  const bucket = parts[1];
  const key = parts.slice(2);
  if (!bucket || key.length === 0) return json({ message: "Falta la ruta del archivo.", statusCode: "400" }, 400);
  const filePath = resolveSafe([bucket, ...key]);
  if (!filePath) return json({ message: "Ruta inválida.", statusCode: "400" }, 400);

  const upsert = request.headers.get("x-upsert") === "true";
  try {
    const existing = await stat(filePath);
    if (existing.isFile() && !upsert) {
      return json({ message: "El archivo ya existe.", statusCode: "409", error: "Duplicate" }, 400);
    }
  } catch {
    // todavía no existe
  }

  const upload = await readUpload(request);
  if (!upload || upload.bytes.byteLength === 0) {
    return json({ message: "El archivo llegó vacío.", statusCode: "400" }, 400);
  }
  if (upload.bytes.byteLength > MAX_BYTES) {
    return json({ message: "El archivo supera 50 MB.", statusCode: "413" }, 413);
  }

  await writeObject(filePath, upload.bytes, upload.mime);
  return json({ Id: randomUUID(), Key: `${bucket}/${key.join("/")}` });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return POST(request, context);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  if (!localStorageEnabled()) return unavailable();
  const parts = await segments(context);
  if (parts[0] !== "object") return unavailable();
  if (parts[1] === "public") return sendFile(parts.slice(2));
  return sendFile(parts.slice(1));
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  const response = await GET(request, context);
  return new NextResponse(null, { status: response.status, headers: response.headers });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!localStorageEnabled()) return unavailable();
  const parts = await segments(context);
  if (parts[0] !== "object" || !parts[1]) return unavailable();
  const body = (await request.json().catch(() => ({}))) as { prefixes?: unknown };
  const prefixes = Array.isArray(body.prefixes) ? body.prefixes : [];
  for (const prefix of prefixes) {
    const relative = typeof prefix === "string" ? prefix : "";
    const key = relative.split("/").filter(Boolean);
    const filePath = resolveSafe([parts[1], ...key]);
    if (!filePath) continue;
    await rm(filePath, { force: true }).catch(() => undefined);
    await rm(metaPath(filePath), { force: true }).catch(() => undefined);
  }
  return json([]);
}
