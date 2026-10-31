import { EXPENSE_CATEGORIES, type ExpenseCategoryId } from "./types";

export type ReceiptRecognition = {
  taxType: string;
  category: ExpenseCategoryId | null;
};

const TAX_NAMES: Record<string, string> = {
  "001": "ISR",
  "002": "IVA",
  "003": "IEPS",
};

/** Claves SAT más específicas primero. */
const CLAVE_CATEGORIES: Array<[string, ExpenseCategoryId]> = [
  ["901118", "hospedaje"],
  ["901015", "alimentos"],
  ["9010", "alimentos"],
  ["781115", "transporte_aereo"],
  ["781118", "transporte_terrestre"],
  ["781015", "transporte_terrestre"],
  ["781815", "renta_auto"],
  ["151015", "combustible"],
  ["781216", "casetas"],
  ["781817", "estacionamiento"],
  ["801315", "renta"],
  ["831016", "servicios"],
  ["831015", "servicios"],
  ["831116", "telefonia"],
  ["141115", "papeleria"],
  ["4412", "papeleria"],
  ["4713", "limpieza"],
  ["7215", "mantenimiento"],
  ["7210", "mantenimiento"],
  ["781022", "mensajeria"],
  ["811125", "software"],
  ["4323", "software"],
  ["8011", "honorarios"],
  ["8412", "comisiones_bancarias"],
  ["8210", "publicidad"],
  ["9316", "impuestos_derechos"],
];

const TEXT_CATEGORIES: Array<[RegExp, ExpenseCategoryId]> = [
  [/hosped|hotel|motel|hostal|alojamiento|habitacion/, "hospedaje"],
  [/vuelo|boleto de avion|aerolinea|transporte aereo/, "transporte_aereo"],
  [/renta de auto|arrendamiento de vehiculo|alquiler de auto|renta de vehiculo/, "renta_auto"],
  [/gasolina|diesel|combustible|magna|premium/, "combustible"],
  [/caseta|peaje/, "casetas"],
  [/estacionamiento/, "estacionamiento"],
  [/taxi|uber|didi|autobus|transporte terrestre/, "transporte_terrestre"],
  [/alimento|restaurant|restaurante|comida|consumo de alimentos/, "alimentos"],
  [/arrendamiento de inmueble|renta de local|renta de oficina|renta de bodega/, "renta"],
  [/energia electrica|servicio de luz|agua potable|gas natural|suministro de energia/, "servicios"],
  [/telefono|telefonia|internet|telecomunic/, "telefonia"],
  [/papeleria|utiles de oficina|toner|hoja bond/, "papeleria"],
  [/articulo de limpieza|servicio de limpieza|productos de limpieza/, "limpieza"],
  [/mantenimiento de instal|reparacion de instal/, "mantenimiento"],
  [/mensajeria|paqueteria|guia de envio/, "mensajeria"],
  [/software|licencia de uso|suscripcion/, "software"],
  [/honorarios|servicios profesionales/, "honorarios"],
  [/comision bancaria|comisiones bancarias/, "comisiones_bancarias"],
  [/publicidad|marketing/, "publicidad"],
  [/predial|tenencia|derechos|pago de impuestos/, "impuestos_derechos"],
];

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function tagBodies(xml: string, name: string) {
  const re = new RegExp(`<(?:[\\w.-]+:)?${name}\\b([^>]*)\\/?>`, "gi");
  const bodies: string[] = [];
  for (const match of xml.matchAll(re)) bodies.push(match[1] ?? "");
  return bodies;
}

function readAttrs(body: string) {
  const attrs: Record<string, string> = {};
  for (const match of body.matchAll(/([A-Za-z_][\w:.-]*)\s*=\s*"([^"]*)"/g)) {
    const key = match[1].split(":").pop()?.toLowerCase() ?? "";
    attrs[key] = match[2]
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }
  return attrs;
}

function percentLabel(rate: string) {
  const value = Number(rate);
  if (!Number.isFinite(value) || value <= 0) return "";
  const percent = value <= 1 ? Math.round(value * 1000) / 10 : value;
  const rounded = Math.round(percent * 10) / 10;
  return ` ${Number.isInteger(rounded) ? rounded.toFixed(0) : String(rounded)}%`;
}

function taxLabel(attrs: Record<string, string>, retained: boolean) {
  const code = attrs.impuesto ?? "";
  const name = TAX_NAMES[code] ?? (code ? `Impuesto ${code}` : "");
  if (!name) return "";
  const factor = (attrs.tipofactor ?? "").toLowerCase();
  if (factor === "exento") return `${name} exento`;
  const rate = factor === "cuota" ? "" : percentLabel(attrs.tasaocuota ?? "");
  return retained ? `${name} retenido${rate}` : `${name}${rate}`;
}

function categoryFromClave(clave: string): ExpenseCategoryId | null {
  const digits = clave.replace(/\D/g, "");
  if (!digits) return null;
  for (const [prefix, category] of CLAVE_CATEGORIES) {
    if (digits.startsWith(prefix)) return category;
  }
  return null;
}

function categoryFromText(text: string): ExpenseCategoryId | null {
  const normalized = stripAccents(text);
  for (const [pattern, category] of TEXT_CATEGORIES) {
    if (pattern.test(normalized)) return category;
  }
  return null;
}

function isCategory(id: string): id is ExpenseCategoryId {
  return EXPENSE_CATEGORIES.some((item) => item.id === id);
}

/** Del CFDI solo se leen el tipo de impuesto y la categoría del gasto. */
export function recognizeExpenseReceipt(xml: string): ReceiptRecognition {
  if (!/<(?:[\w.-]+:)?Comprobante\b/i.test(xml)) {
    throw new Error("El archivo no es un CFDI.");
  }

  const labels = new Set<string>();
  for (const body of tagBodies(xml, "Traslado")) {
    const label = taxLabel(readAttrs(body), false);
    if (label) labels.add(label);
  }
  for (const body of tagBodies(xml, "Retencion")) {
    const label = taxLabel(readAttrs(body), true);
    if (label) labels.add(label);
  }

  const votes = new Map<ExpenseCategoryId, number>();
  for (const body of tagBodies(xml, "Concepto")) {
    const attrs = readAttrs(body);
    const fromClave = categoryFromClave(attrs.claveprodserv ?? "");
    const fromText = categoryFromText(`${attrs.descripcion ?? ""} ${attrs.claveprodserv ?? ""}`);
    const category = fromClave ?? fromText;
    if (category && isCategory(category)) votes.set(category, (votes.get(category) ?? 0) + 1);
  }
  if (votes.size === 0) {
    const loose = categoryFromText(xml);
    if (loose) votes.set(loose, 1);
  }

  let category: ExpenseCategoryId | null = null;
  let best = 0;
  for (const [id, count] of votes) {
    if (count > best) {
      category = id;
      best = count;
    }
  }

  return {
    taxType: [...labels].join(", "),
    category,
  };
}
