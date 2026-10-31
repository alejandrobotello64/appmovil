import { EXPENSE_CATEGORIES, type ExpenseCategoryId } from "./types";

export type ReceiptFill = {
  taxType: string;
  category: ExpenseCategoryId | null;
  concept: string;
  supplierName: string;
  supplierRfc: string;
  invoiceNumber: string;
  cfdiUuid: string;
  expenseDate: string;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
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

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function money(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return roundMoney(parsed);
}

function blankFill(): ReceiptFill {
  return {
    taxType: "",
    category: null,
    concept: "",
    supplierName: "",
    supplierRfc: "",
    invoiceNumber: "",
    cfdiUuid: "",
    expenseDate: "",
    subtotal: null,
    tax: null,
    total: null,
  };
}

/** Un renglón que solo nombra un impuesto no debe ganar la categoría ni el concepto. */
function isTaxOnlyConcept(description: string) {
  const n = stripAccents(description).replace(/[^a-z0-9.%]+/g, " ").replace(/\s+/g, " ").trim();
  if (!n) return false;
  const product =
    /(noche|noches|habitacion|hotel|alimento|comida|gasolina|diesel|magna|premium|vuelo|taxi|caseta|peaje|estacionamiento|renta|energia|telefono|papeleria|servicio)/.test(
      n,
    );
  if (product && !/^impuesto\b/.test(n)) return false;
  if (/^(impuesto|ish|ieps|iva|isr)\b/.test(n) && !product) return true;
  return false;
}

function winningCategory(votes: Map<ExpenseCategoryId, number>) {
  let category: ExpenseCategoryId | null = null;
  let best = 0;
  for (const [id, weight] of votes) {
    if (weight > best) {
      category = id;
      best = weight;
    }
  }
  return category;
}

function localTaxName(raw: string) {
  const n = stripAccents(raw);
  if (/hosped|\bish\b/.test(n)) return "Impuesto sobre hospedaje";
  if (/\bieps\b/.test(n)) return "IEPS";
  if (/predial/.test(n)) return "Predial";
  if (/nomina/.test(n)) return "Impuesto sobre nómina";
  if (/saneamiento/.test(n)) return "Derechos de saneamiento";
  if (/cedular/.test(n)) return "Impuesto cedular";
  const trimmed = raw.replace(/\s+/g, " ").trim();
  return trimmed || "Impuesto local";
}

/** TasadeTraslado local suele venir ya en porciento (3); si es 0.03, es decimal. */
function localPercentLabel(rate: string) {
  const value = Number(rate);
  if (!Number.isFinite(value) || value <= 0) return "";
  const percent = value <= 1 ? value * 100 : value;
  const rounded = Math.round(percent * 10) / 10;
  return ` ${Number.isInteger(rounded) ? rounded.toFixed(0) : String(rounded)}%`;
}

function localTaxLabel(attrs: Record<string, string>, retained: boolean) {
  const raw = retained ? (attrs.implocretenido ?? "") : (attrs.imploctrasladado ?? "");
  const name = localTaxName(raw);
  const rate = localPercentLabel(retained ? (attrs.tasaderetencion ?? "") : (attrs.tasadetraslado ?? ""));
  return retained ? `${name} retenido${rate}` : `${name}${rate}`;
}

function attrMax(xml: string, tag: string, attr: string): number | null {
  let found = false;
  let max = 0;
  for (const body of tagBodies(xml, tag)) {
    const value = money(readAttrs(body)[attr]);
    if (value == null) continue;
    found = true;
    if (value > max) max = value;
  }
  return found ? max : null;
}

function localTrasladoTotal(xml: string) {
  const stated = attrMax(xml, "ImpuestosLocales", "totaldetraslados");
  if (stated != null) return stated;
  let sum = 0;
  let any = false;
  for (const body of tagBodies(xml, "TrasladosLocales")) {
    const value = money(readAttrs(body).importe);
    if (value == null) continue;
    sum += value;
    any = true;
  }
  return any ? roundMoney(sum) : 0;
}

function collectTaxLabels(xml: string) {
  const labels = new Set<string>();
  for (const body of tagBodies(xml, "Traslado")) {
    const label = taxLabel(readAttrs(body), false);
    if (label) labels.add(label);
  }
  for (const body of tagBodies(xml, "Retencion")) {
    const label = taxLabel(readAttrs(body), true);
    if (label) labels.add(label);
  }
  for (const body of tagBodies(xml, "TrasladosLocales")) {
    const label = localTaxLabel(readAttrs(body), false);
    if (label) labels.add(label);
  }
  for (const body of tagBodies(xml, "RetencionesLocales")) {
    const label = localTaxLabel(readAttrs(body), true);
    if (label) labels.add(label);
  }
  return [...labels].join(", ");
}

/** Lee un CFDI 3.3 o 4.0, incluidos IEPS e impuestos locales como el de hospedaje. */
export function recognizeExpenseReceipt(xml: string): ReceiptFill {
  if (!/<(?:[\w.-]+:)?Comprobante\b/i.test(xml)) {
    throw new Error("El archivo no es un CFDI.");
  }

  const comprobante = readAttrs(tagBodies(xml, "Comprobante")[0] ?? "");
  const emisor = readAttrs(tagBodies(xml, "Emisor")[0] ?? "");
  const timbre = tagBodies(xml, "TimbreFiscalDigital").map(readAttrs).find((attrs) => attrs.uuid);

  const concepts: string[] = [];
  const votes = new Map<ExpenseCategoryId, number>();
  for (const body of tagBodies(xml, "Concepto")) {
    const attrs = readAttrs(body);
    const description = (attrs.descripcion ?? "").replace(/\s+/g, " ").trim();
    if (isTaxOnlyConcept(description)) continue;
    if (description) concepts.push(description);
    const fromClave = categoryFromClave(attrs.claveprodserv ?? "");
    const fromText = categoryFromText(`${description} ${attrs.claveprodserv ?? ""}`);
    const category = fromClave ?? fromText;
    if (!category || !isCategory(category)) continue;
    const weight = Math.abs(money(attrs.importe) ?? 1) || 1;
    votes.set(category, (votes.get(category) ?? 0) + weight);
  }
  if (votes.size === 0) {
    const loose = categoryFromText(concepts.join(" ") || xml);
    if (loose) votes.set(loose, 1);
  }

  const serie = (comprobante.serie ?? "").trim();
  const folio = (comprobante.folio ?? "").trim();
  const subtotal = money(comprobante.subtotal);
  const total = money(comprobante.total);
  const discount = money(comprobante.descuento) ?? 0;
  const federalTax = attrMax(xml, "Impuestos", "totalimpuestostrasladados");
  const localTax = localTrasladoTotal(xml);
  const retentions =
    (attrMax(xml, "Impuestos", "totalimpuestosretenidos") ?? 0) +
    (attrMax(xml, "ImpuestosLocales", "totalderetenciones") ?? 0);
  let tax: number | null = null;
  if (federalTax != null || localTax > 0) tax = roundMoney((federalTax ?? 0) + localTax);
  else if (subtotal != null && total != null) tax = roundMoney(Math.max(0, total - subtotal + discount + retentions));

  const fecha = comprobante.fecha ?? "";
  const expenseDate = /^\d{4}-\d{2}-\d{2}/.test(fecha) ? fecha.slice(0, 10) : "";

  return {
    taxType: collectTaxLabels(xml),
    category: winningCategory(votes),
    concept: concepts.join(" · ").slice(0, 180),
    supplierName: (emisor.nombre ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    supplierRfc: (emisor.rfc ?? "").toUpperCase(),
    invoiceNumber: serie && folio ? `${serie}-${folio}` : serie || folio,
    cfdiUuid: (timbre?.uuid ?? "").toUpperCase(),
    expenseDate,
    subtotal,
    tax,
    total,
  };
}

function parseMoneyText(raw: string): number | null {
  let value = raw.replace(/[$\s]/g, "");
  if (!value) return null;
  if (value.includes(",") && value.includes(".")) {
    if (value.lastIndexOf(",") > value.lastIndexOf(".")) value = value.replace(/\./g, "").replace(",", ".");
    else value = value.replace(/,/g, "");
  } else if (value.includes(",")) {
    value = /,\d{1,2}$/.test(value) ? value.replace(",", ".") : value.replace(/,/g, "");
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return roundMoney(parsed);
}

function lastMoney(line: string): number | null {
  const withoutRate = line.replace(/\d+(?:[.,]\d+)?\s*%/g, " ");
  const nums = [
    ...withoutRate.matchAll(/(\d{1,3}(?:[,\s]\d{3})+(?:[.,]\d{1,2})|\d+[.,]\d{2}|\d{1,3}(?:,\d{3})+)/g),
  ];
  if (nums.length > 0) return parseMoneyText(nums[nums.length - 1][1]);
  const plain = [...withoutRate.matchAll(/\b(\d{2,9})\b/g)];
  if (plain.length === 0) return null;
  return parseMoneyText(plain[plain.length - 1][1]);
}

function amountOnLabel(lines: string[], label: RegExp, reject?: RegExp) {
  for (const line of lines) {
    const normalized = stripAccents(line);
    if (!label.test(normalized)) continue;
    if (reject?.test(normalized)) continue;
    const amount = lastMoney(line);
    if (amount != null) return amount;
  }
  return null;
}

function normalizeDate(value: string) {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = value.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (local) return `${local[3]}-${local[2]}-${local[1]}`;
  return "";
}

function looksLikeCompany(line: string) {
  return /\b(s\.?\s?a\.?|sapi|de\s+c\.?\s?v\.?|s\.?\s?de\s+r\.?\s?l|sociedad)\b/i.test(line);
}

const PDF_HEADER =
  /rfc|folio|fecha|uuid|emisor|receptor|regimen|codigo postal|moneda|metodo|forma de pago|uso cfdi|subtotal|total|sello|certificado|lugar de expedicion|\bcp\b|domicilio/;

function conceptFromLines(lines: string[]) {
  for (const line of lines) {
    const labeled = line.match(/^(?:descripci[oó]n|concepto)\s*[:\-]\s*(.+)$/i)?.[1]?.trim();
    if (labeled && !isTaxOnlyConcept(labeled)) return labeled.replace(/\s+/g, " ").slice(0, 180);
  }
  const candidates = lines.filter((line) => {
    if (line.length < 6 || line.length > 140) return false;
    if (PDF_HEADER.test(stripAccents(line))) return false;
    if (isTaxOnlyConcept(line) || looksLikeCompany(line)) return false;
    return /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{4}/.test(line);
  });
  return (candidates.find((line) => categoryFromText(line)) ?? candidates[0] ?? "").replace(/\s+/g, " ").slice(0, 180);
}

type TextTax = { label: string; amount: number | null; retained: boolean };

function taxesFromLines(lines: string[]): TextTax[] {
  const found: TextTax[] = [];
  for (const line of lines) {
    const n = stripAccents(line);
    if (!/\b(iva|ieps|isr|ish|predial|nomina|saneamiento|cedular|impuesto)\b/.test(n)) continue;
    if (/\bhospedaje\b/.test(n) && !/\b(impuesto|ish)\b/.test(n)) continue;
    if (/\bsubtotal\b/.test(n) || (/^\s*total\b/.test(n) && !/impuesto/.test(n))) continue;
    const rate = n.match(/(\d+(?:[.,]\d+)?)\s*%/);
    const pct = rate ? localPercentLabel(rate[1].replace(",", ".")) : "";
    const amount = lastMoney(line);
    const retained = /retenid/.test(n);
    let label = "";
    if (/\bieps\b/.test(n)) label = `IEPS${pct}`;
    else if (/\biva\b/.test(n) && /exento/.test(n)) label = "IVA exento";
    else if (/\biva\b/.test(n)) label = retained ? `IVA retenido${pct}` : `IVA${pct}`;
    else if (/\bisr\b/.test(n)) label = retained || !/traslad/.test(n) ? `ISR retenido${pct}` : `ISR${pct}`;
    else if (/hospedaje|\bish\b/.test(n)) label = `Impuesto sobre hospedaje${pct}`;
    else if (/predial/.test(n)) label = `Predial${pct}`;
    else if (/nomina/.test(n)) label = `Impuesto sobre nómina${pct}`;
    else if (/saneamiento/.test(n)) label = `Derechos de saneamiento${pct}`;
    else if (/cedular/.test(n)) label = `Impuesto cedular${pct}`;
    if (!label || found.some((item) => item.label === label)) continue;
    found.push({ label, amount: label.endsWith("exento") ? 0 : amount, retained });
  }
  return found;
}

/** Lee el texto de un PDF de factura o ticket. Una foto no llega aquí. */
export function recognizeExpenseText(text: string): ReceiptFill {
  const letters = text.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9]/g, "");
  if (letters.length < 40) {
    throw new Error("El PDF no tiene texto. Si es un escaneo o una foto, captura los datos o sube el XML.");
  }

  const lines = text
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const flat = lines.join("\n");
  const fill = blankFill();

  fill.cfdiUuid = (
    flat.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/)?.[0] ?? ""
  ).toUpperCase();

  const labeledRfc = flat.match(/rfc(?:\s+del)?(?:\s+emisor)?\s*[:\-]?\s*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i);
  fill.supplierRfc = (labeledRfc?.[1] ?? flat.match(/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/i)?.[0] ?? "").toUpperCase();

  const labeledName = flat.match(
    /(?:raz[oó]n social|nombre(?:\s+del\s+emisor)?|emisor)\s*[:\-]\s*([^\n]{3,120})/i,
  );
  if (labeledName) {
    fill.supplierName = labeledName[1].split(/\s+(?:rfc|folio|r[eé]gimen)\b/i)[0]?.replace(/\s+/g, " ").trim().slice(0, 120) ?? "";
  } else if (fill.supplierRfc) {
    const rfcLine = lines.findIndex((line) => line.toUpperCase().includes(fill.supplierRfc));
    const previous = rfcLine > 0 ? lines[rfcLine - 1] : "";
    if (previous && !PDF_HEADER.test(stripAccents(previous))) fill.supplierName = previous.slice(0, 120);
  }

  const serieFolio = flat.match(
    /serie\s*(?:y|&|\/)?\s*folio\s*[:#\-]?\s*([A-Z0-9]{1,10})(?:\s*[- ]\s*([A-Z0-9]{1,15}))?/i,
  );
  if (serieFolio && !/fiscal/i.test(serieFolio[0])) {
    fill.invoiceNumber = serieFolio[2] ? `${serieFolio[1]}-${serieFolio[2]}` : serieFolio[1];
  } else {
    const folio = flat.match(/\bfolio(?!\s+fiscal)\s*[:#\-]\s*([A-Z0-9][A-Z0-9-]{0,20})/i);
    fill.invoiceNumber = folio?.[1] ?? "";
  }

  const date = flat.match(
    /fecha(?:\s+de\s+(?:emisi[oó]n|expedici[oó]n))?\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})/i,
  );
  fill.expenseDate = date ? normalizeDate(date[1]) : "";

  fill.concept = conceptFromLines(lines);
  fill.category = categoryFromText(fill.concept) ?? categoryFromText(flat);
  fill.subtotal = amountOnLabel(lines, /\bsub\s*-?\s*total\b/);
  fill.total = amountOnLabel(
    lines,
    /\btotal\b/,
    /sub\s*-?\s*total|impuesto|\biva\b|\bieps\b|\bisr\b|hospedaje|\bish\b/,
  );

  const taxes = taxesFromLines(lines);
  fill.taxType = taxes.map((item) => item.label).join(", ");
  const trasladoSum = roundMoney(
    taxes.reduce((sum, item) => sum + (!item.retained && item.amount ? item.amount : 0), 0),
  );
  const retentionSum = roundMoney(
    taxes.reduce((sum, item) => sum + (item.retained && item.amount ? item.amount : 0), 0),
  );
  const formula =
    fill.subtotal != null && fill.total != null
      ? roundMoney(Math.max(0, fill.total - fill.subtotal + retentionSum))
      : null;
  if (trasladoSum > 0 && formula != null && formula > trasladoSum + 0.009) fill.tax = formula;
  else if (trasladoSum > 0) fill.tax = trasladoSum;
  else fill.tax = formula;

  return fill;
}
