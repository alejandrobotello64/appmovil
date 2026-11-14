"use client";

/**
 * Lector de códigos en modo serie (COM), como el módulo integrado de la Dell
 * Latitude 7220 Rugged. Usa Web Serial (Chrome / Edge). La conexión vive fuera de
 * React para mantenerse abierta al cambiar de pantalla.
 */

type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
};

type SerialLike = {
  getPorts(): Promise<SerialPortLike[]>;
  requestPort(): Promise<SerialPortLike>;
  addEventListener(type: "connect" | "disconnect", listener: (event: Event) => void): void;
};

export type SerialScannerStatus = "unsupported" | "disconnected" | "connecting" | "connected";

export type SerialScannerState = {
  status: SerialScannerStatus;
  error: string;
};

const REMEMBER_KEY = "mas-serial-scanner";
/** Si el lector no manda CR/LF, la lectura termina tras este silencio. */
const IDLE_MS = 100;

const UNSUPPORTED: SerialScannerState = { status: "unsupported", error: "" };

let state: SerialScannerState = UNSUPPORTED;
let initialized = false;
let port: SerialPortLike | null = null;
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let stopping = false;
let scanHandler: ((code: string) => void) | null = null;
const listeners = new Set<() => void>();

function serialApi(): SerialLike | null {
  if (typeof navigator === "undefined" || !("serial" in navigator)) return null;
  return (navigator as unknown as { serial: SerialLike }).serial;
}

function setState(next: Partial<SerialScannerState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function remember(value: boolean) {
  try {
    if (value) window.localStorage.setItem(REMEMBER_KEY, "1");
    else window.localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}

function remembered() {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

function openErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/open/i.test(message) || error instanceof DOMException && error.name === "NetworkError") {
    return "El puerto del lector está ocupado. Cierra el Barcode Scanner de Dell Rugged Control Center (o cualquier otro programa que lo use) e intenta de nuevo.";
  }
  return message || "No se pudo abrir el lector.";
}

function emit(code: string) {
  const value = code.replace(/[\r\n]+/g, "").trim();
  if (value) scanHandler?.(value);
}

async function readLoop(current: SerialPortLike) {
  const decoder = new TextDecoder();
  let buffer = "";
  let idleTimer = 0;
  const flush = () => {
    const code = buffer;
    buffer = "";
    emit(code);
  };

  while (current.readable && !stopping) {
    reader = current.readable.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let index = buffer.search(/[\r\n]/);
        while (index >= 0) {
          const line = buffer.slice(0, index);
          buffer = buffer.slice(index + 1);
          emit(line);
          index = buffer.search(/[\r\n]/);
        }
        window.clearTimeout(idleTimer);
        if (buffer) idleTimer = window.setTimeout(flush, IDLE_MS);
      }
    } catch {
      break;
    } finally {
      reader?.releaseLock();
      reader = null;
    }
  }
  window.clearTimeout(idleTimer);
  if (port === current) {
    port = null;
    await current.close().catch(() => undefined);
    setState({ status: "disconnected" });
  }
}

async function start(next: SerialPortLike) {
  if (port) return;
  setState({ status: "connecting", error: "" });
  try {
    await next.open({ baudRate: 115200 });
  } catch (error) {
    setState({ status: "disconnected", error: openErrorMessage(error) });
    return;
  }
  stopping = false;
  port = next;
  remember(true);
  setState({ status: "connected", error: "" });
  void readLoop(next);
}

function initialize() {
  if (initialized) return;
  initialized = true;
  const serial = serialApi();
  if (!serial) return;
  state = { status: "disconnected", error: "" };
  serial.addEventListener("connect", () => {
    if (!port && remembered()) {
      void serial.getPorts().then((ports) => (ports[0] ? start(ports[0]) : undefined));
    }
  });
  if (remembered()) {
    void serial.getPorts().then((ports) => (ports[0] ? start(ports[0]) : undefined));
  }
}

export function subscribeSerialScanner(listener: () => void) {
  initialize();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSerialScannerState() {
  initialize();
  return state;
}

export function getServerSerialScannerState() {
  return UNSUPPORTED;
}

/** Registra quién recibe los códigos leídos (solo uno a la vez). */
export function setSerialScanHandler(handler: (code: string) => void) {
  scanHandler = handler;
  return () => {
    if (scanHandler === handler) scanHandler = null;
  };
}

/** Pide al usuario elegir el puerto del lector (requiere un clic). */
export async function connectSerialScanner() {
  const serial = serialApi();
  if (!serial || port) return;
  let selected: SerialPortLike;
  try {
    selected = await serial.requestPort();
  } catch {
    return;
  }
  await start(selected);
}

export async function disconnectSerialScanner() {
  const current = port;
  remember(false);
  if (!current) return;
  stopping = true;
  port = null;
  await reader?.cancel().catch(() => undefined);
  await current.close().catch(() => undefined);
  setState({ status: "disconnected", error: "" });
}
