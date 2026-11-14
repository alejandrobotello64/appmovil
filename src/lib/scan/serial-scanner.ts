"use client";

/**
 * Lector de códigos en modo serie (COM), como el módulo integrado de la Dell
 * Latitude 7220 Rugged. Usa Web Serial (Chrome / Edge). La conexión vive fuera de
 * React para mantenerse abierta al cambiar de pantalla.
 *
 * Entiende dos formatos:
 * - Texto: el código seguido de CR/LF (o un silencio breve).
 * - SSI de Zebra: paquetes binarios que el escáner reenvía (pitando) hasta recibir ACK.
 */

type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
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
  baudRate: number;
  bytesReceived: number;
  /** Últimos bytes recibidos en hexadecimal (diagnóstico). */
  lastBytes: string;
  lastCode: string;
  protocol: "" | "texto" | "SSI";
};

export const SERIAL_BAUD_RATES = [9600, 19200, 38400, 57600, 115200] as const;

const REMEMBER_KEY = "mas-serial-scanner";
const BAUD_KEY = "mas-serial-baud";
const DEFAULT_BAUD = 9600;
/** Si el lector no manda CR/LF, la lectura termina tras este silencio. */
const IDLE_MS = 120;

/** Opcodes SSI que envía el escáner. */
const SSI_DECODE_DATA = 0xf3;
const SSI_EVENT = 0xf6;
const SSI_FROM_SCANNER = new Set([SSI_DECODE_DATA, SSI_EVENT, 0xd0, 0xd1, 0xa4, 0xc6]);
const SSI_SOURCE_DECODER = 0x00;
const SSI_SOURCE_HOST = 0x04;
const SSI_CMD_ACK = 0xd0;
const SSI_START_DECODE = 0xe4;
const SSI_STATUS_CONTINUATION = 0x02;

const UNSUPPORTED: SerialScannerState = {
  status: "unsupported",
  error: "",
  baudRate: DEFAULT_BAUD,
  bytesReceived: 0,
  lastBytes: "",
  lastCode: "",
  protocol: "",
};

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

function storageGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* almacenamiento no disponible */
  }
}

function storedBaud() {
  const value = Number(storageGet(BAUD_KEY));
  return (SERIAL_BAUD_RATES as readonly number[]).includes(value) ? value : DEFAULT_BAUD;
}

function openErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/open/i.test(message) || (error instanceof DOMException && error.name === "NetworkError")) {
    return "El puerto del lector está ocupado. Cierra el Barcode Scanner de Dell Rugged Control Center (o cualquier otro programa que lo use) e intenta de nuevo.";
  }
  return message || "No se pudo abrir el lector.";
}

function toHex(bytes: ArrayLike<number>) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

/** Deja solo texto imprimible (conserva GS, separador de GS1). */
function cleanText(bytes: number[]) {
  const text = new TextDecoder().decode(new Uint8Array(bytes));
  return text.replace(/[\u0000-\u001c\u001e\u001f\u007f]/g, "").trim();
}

function emit(code: string, protocol: SerialScannerState["protocol"]) {
  if (!code) return;
  setState({ lastCode: code, protocol });
  scanHandler?.(code);
}

function ssiPacket(opcode: number) {
  const body = [0x04, opcode, SSI_SOURCE_HOST, 0x00];
  const sum = body.reduce((total, byte) => total + byte, 0);
  const checksum = (0x10000 - sum) & 0xffff;
  return new Uint8Array([...body, checksum >> 8, checksum & 0xff]);
}

async function write(bytes: Uint8Array) {
  const writable = port?.writable;
  if (!writable) return;
  const writer = writable.getWriter();
  try {
    await writer.write(bytes);
  } finally {
    writer.releaseLock();
  }
}

/** Intenta leer un paquete SSI completo al inicio del búfer. */
function takeSsiPacket(bytes: number[]): number[] | "incomplete" | null {
  const length = bytes[0];
  if (length < 4 || bytes.length < 2 || !SSI_FROM_SCANNER.has(bytes[1])) return null;
  if (bytes.length >= 3 && bytes[2] !== SSI_SOURCE_DECODER) return null;
  if (bytes.length < length + 2) return "incomplete";
  const sum = bytes.slice(0, length).reduce((total, byte) => total + byte, 0);
  const checksum = (bytes[length] << 8) | bytes[length + 1];
  if (((sum + checksum) & 0xffff) !== 0) return null;
  return bytes.splice(0, length + 2);
}

async function readLoop(current: SerialPortLike) {
  const bytes: number[] = [];
  let pendingSsi: number[] = [];
  let idleTimer = 0;

  const flushText = () => {
    const code = cleanText(bytes.splice(0, bytes.length));
    emit(code, "texto");
  };

  const process = () => {
    for (;;) {
      if (!bytes.length) return;
      const packet = takeSsiPacket(bytes);
      if (packet === "incomplete") return;
      if (packet) {
        const opcode = packet[1];
        if (opcode === SSI_DECODE_DATA || opcode === SSI_EVENT) void write(ssiPacket(SSI_CMD_ACK));
        if (opcode === SSI_DECODE_DATA) {
          const length = packet[0];
          pendingSsi.push(...packet.slice(5, length));
          if (!(packet[3] & SSI_STATUS_CONTINUATION)) {
            const code = cleanText(pendingSsi);
            pendingSsi = [];
            emit(code, "SSI");
          }
        }
        continue;
      }
      const end = bytes.findIndex((byte) => byte === 0x0d || byte === 0x0a);
      if (end < 0) return;
      const line = bytes.splice(0, end + 1);
      emit(cleanText(line), "texto");
    }
  };

  while (current.readable && !stopping) {
    reader = current.readable.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value?.length) continue;
        bytes.push(...value);
        setState({
          bytesReceived: state.bytesReceived + value.length,
          lastBytes: toHex(value.slice(-32)),
        });
        process();
        window.clearTimeout(idleTimer);
        if (bytes.length) idleTimer = window.setTimeout(flushText, IDLE_MS);
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
  const baudRate = storedBaud();
  setState({ status: "connecting", error: "", baudRate });
  try {
    await next.open({ baudRate });
  } catch (error) {
    setState({ status: "disconnected", error: openErrorMessage(error) });
    return;
  }
  await next.setSignals?.({ dataTerminalReady: true, requestToSend: true }).catch(() => undefined);
  stopping = false;
  port = next;
  storageSet(REMEMBER_KEY, "1");
  setState({ status: "connected", error: "", bytesReceived: 0, lastBytes: "", lastCode: "" });
  void readLoop(next);
}

function initialize() {
  if (initialized) return;
  initialized = true;
  const serial = serialApi();
  if (!serial) return;
  state = { ...UNSUPPORTED, status: "disconnected", baudRate: storedBaud() };
  const reconnect = () => {
    if (port || storageGet(REMEMBER_KEY) !== "1") return;
    void serial.getPorts().then((ports) => (ports[0] ? start(ports[0]) : undefined));
  };
  serial.addEventListener("connect", reconnect);
  reconnect();
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

async function closeCurrent() {
  const current = port;
  if (!current) return null;
  stopping = true;
  port = null;
  await reader?.cancel().catch(() => undefined);
  await new Promise((resolve) => window.setTimeout(resolve, 50));
  await current.close().catch(() => undefined);
  return current;
}

export async function disconnectSerialScanner() {
  storageSet(REMEMBER_KEY, null);
  await closeCurrent();
  setState({ status: "disconnected", error: "" });
}

/** Cambia la velocidad y, si está conectado, reabre el mismo puerto. */
export async function setSerialBaudRate(baudRate: number) {
  storageSet(BAUD_KEY, String(baudRate));
  setState({ baudRate });
  const current = await closeCurrent();
  if (current) await start(current);
}

/** Pide al escáner (SSI) que lea, como si se presionara el gatillo. */
export async function triggerSerialScanner() {
  await write(ssiPacket(SSI_START_DECODE)).catch(() => undefined);
}
