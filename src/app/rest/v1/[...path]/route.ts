import { type NextRequest } from "next/server";

const UPSTREAM =
  process.env.SUPABASE_INTERNAL_URL ?? "http://127.0.0.1:54321";

const FORWARD_HEADERS = [
  "authorization",
  "apikey",
  "content-type",
  "prefer",
  "accept",
  "accept-profile",
  "content-profile",
  "range",
  "x-client-info",
  "profile",
] as const;

async function proxy(request: NextRequest, path: string[]) {
  const dest = new URL(`/rest/v1/${path.join("/")}`, UPSTREAM);
  dest.search = request.nextUrl.search;

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(dest, init);
  const outHeaders = new Headers(upstream.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("transfer-encoding");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
