/** Separador de grupo (FNC1) que los lectores envían en códigos GS1. */
const GS = "\u001d";

export type Gs1Data = {
  gtin?: string;
  lot?: string;
  serial?: string;
  /** Fecha de caducidad ISO (YYYY-MM-DD). */
  expiry?: string;
  productionDate?: string;
  quantity?: string;
  ais: Record<string, string>;
};

export type ParsedScan = {
  raw: string;
  /** Código limpio (sin prefijos de simbología ni caracteres de control). */
  code: string;
  gs1: Gs1Data | null;
  /** Valores a buscar en productos, en orden de prioridad. */
  candidates: string[];
};

/** AIs de longitud fija (sin contar el AI). */
const FIXED_LENGTH: Record<string, number> = {
  "00": 18,
  "01": 14,
  "02": 14,
  "11": 6,
  "12": 6,
  "13": 6,
  "15": 6,
  "16": 6,
  "17": 6,
  "20": 2,
};

/** AIs de longitud variable conocidos (máximo de caracteres). */
const VARIABLE_LENGTH: Record<string, number> = {
  "10": 20,
  "21": 20,
  "22": 20,
  "30": 8,
  "37": 8,
  "240": 30,
  "241": 30,
  "250": 30,
  "400": 30,
};

function cleanRaw(raw: string) {
  return raw
    .replace(/\r|\n|\t/g, "")
    .replace(/^\](?:d2|C1|Q3|e0|d1|Q1|E0|A0)/, "")
    .trim();
}

export function normalizeBarcode(value: string) {
  return cleanRaw(value).replace(new RegExp(GS, "g"), "").trim();
}

export function normalizeBarcodeList(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const code = normalizeBarcode(value);
    const key = code.toLowerCase();
    if (!code || seen.has(key)) continue;
    seen.add(key);
    result.push(code);
  }
  return result;
}

function gs1Date(value: string) {
  if (!/^\d{6}$/.test(value)) return undefined;
  const yy = Number(value.slice(0, 2));
  const mm = Number(value.slice(2, 4));
  let dd = Number(value.slice(4, 6));
  if (mm < 1 || mm > 12) return undefined;
  const year = yy >= 51 ? 1900 + yy : 2000 + yy;
  if (dd === 0) dd = new Date(year, mm, 0).getDate();
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function aiAt(data: string, index: number) {
  const two = data.slice(index, index + 2);
  if (two in FIXED_LENGTH || two in VARIABLE_LENGTH) return two;
  const three = data.slice(index, index + 3);
  if (three in VARIABLE_LENGTH) return three;
  return null;
}

function parseParenthesized(data: string) {
  const ais: Record<string, string> = {};
  const pattern = /\((\d{2,4})\)([^()]*)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(data))) {
    ais[match[1]] = match[2].replace(new RegExp(GS, "g"), "").trim();
  }
  return Object.keys(ais).length ? ais : null;
}

function parseConcatenated(data: string) {
  const ais: Record<string, string> = {};
  let index = 0;
  while (index < data.length) {
    if (data[index] === GS) {
      index += 1;
      continue;
    }
    const ai = aiAt(data, index);
    if (!ai) return Object.keys(ais).length ? ais : null;
    index += ai.length;
    const fixed = FIXED_LENGTH[ai];
    if (fixed) {
      const value = data.slice(index, index + fixed);
      if (value.length < fixed) return null;
      ais[ai] = value;
      index += fixed;
      continue;
    }
    const max = VARIABLE_LENGTH[ai];
    const gsIndex = data.indexOf(GS, index);
    let end = gsIndex === -1 ? data.length : gsIndex;
    if (end - index > max) end = index + max;
    ais[ai] = data.slice(index, end);
    index = end;
  }
  return Object.keys(ais).length ? ais : null;
}

/**
 * Códigos Dräger / Hill-Rom sin FNC1: "21" + serie + ("93" + ref) o ref MS/HR…
 * Ej. 21S2SRC109693MS32997-12 → serie S2SRC1096, ref MS32997-12
 * Ej. 21HRP004355736HR900 → serie HRP004355736, modelo HR900
 * Ej. 21HRP004355736 → serie HRP… (cama Centuris / HR900 sin sufijo de modelo)
 */
function parseEmbeddedSerialPart(data: string): Record<string, string> | null {
  const compact = data.replace(new RegExp(GS, "g"), "");
  const with93 = /^21([A-Za-z0-9._-]{4,30})93([A-Za-z0-9._-]{3,30})$/.exec(compact);
  if (with93) return { "21": with93[1], "241": with93[2] };
  // Serie + modelo corto al final (…HR900 / …LI900B1), sin comerse series HRP…
  const withModel =
    /^21(HRP\d{6,20}|[A-Za-z0-9._-]{4,24})((?:HR|LI|CS)\d{2,6}[A-Za-z0-9._-]{0,8}|MS[A-Za-z0-9._-]{2,24}|PN[A-Za-z0-9._-]{2,24}|P\/N[A-Za-z0-9._-]{2,24})$/i.exec(
      compact
    );
  if (withModel) return { "21": withModel[1], "241": withModel[2] };
  const withRef = /^21([A-Za-z0-9._-]{4,24})((?:MS|PN|P\/N)[A-Za-z0-9._-]{2,24})$/i.exec(
    compact
  );
  if (withRef) return { "21": withRef[1], "241": withRef[2] };
  const hrpOnly = /^21(HRP\d{6,20})$/i.exec(compact);
  if (hrpOnly) return { "21": hrpOnly[1], "241": "HR900" };
  return null;
}

/**
 * Aliases de catálogo solo para camas Centuris (series HRP… o modelo exacto).
 * No aplicar a refacciones tipo HR900126 / HR900B2044.
 */
export function hillRomBedAliases(serialOrModel: string) {
  const value = serialOrModel.trim();
  if (!value) return [] as string[];
  if (/^HRP\d{6,}$/i.test(value)) {
    return ["Centuris", "Centuris Pro", "LI900B1", "CS900B1"];
  }
  // Modelo de familia exacto (placa / AI 241), no n.º de parte HR900…
  if (/^(HR900|LI900|LI900B1|CS900|CS900B1)$/i.test(value)) {
    return ["Centuris", "Centuris Pro", "LI900B1", "CS900B1"];
  }
  return [] as string[];
}

/** True si el código parece n.º de parte/refacción Hill-Rom (HR900126, HR900B2044…). */
export function isHillRomPartNumber(value: string) {
  return /^HR900[A-Z0-9].+/i.test(value.trim());
}

/** Interpreta un código GS1 (DataMatrix / GS1-128) si lo es. */
export function parseGs1(raw: string): Gs1Data | null {
  const data = cleanRaw(raw);
  let ais: Record<string, string> | null = null;
  if (/^\(\d{2,4}\)/.test(data)) {
    ais = parseParenthesized(data);
  } else if (/^(01|02)\d{14}/.test(data) && data.length > 16) {
    ais = parseConcatenated(data);
  } else if (data.includes(GS) && /^\d{2}/.test(data)) {
    ais = parseConcatenated(data);
  } else if (/^21[A-Za-z0-9._-]{6,}/.test(data.replace(new RegExp(GS, "g"), ""))) {
    ais = parseEmbeddedSerialPart(data);
  }
  if (!ais) return null;
  const gtin = ais["01"] ?? ais["02"];
  if (!gtin && !ais["10"] && !ais["21"] && !ais["241"]) return null;
  return {
    gtin,
    lot: ais["10"],
    serial: ais["21"],
    expiry: ais["17"] ? gs1Date(ais["17"]) : undefined,
    productionDate: ais["11"] ? gs1Date(ais["11"]) : undefined,
    quantity: ais["30"] ?? ais["37"],
    ais,
  };
}

/** Variantes equivalentes de un GTIN (8/12/13/14 dígitos con o sin ceros). */
export function gtinVariants(value: string) {
  if (!/^\d{8,14}$/.test(value)) return [value];
  const stripped = value.replace(/^0+/, "");
  const variants = new Set<string>([value, stripped]);
  for (const length of [8, 12, 13, 14]) {
    if (stripped.length <= length) variants.add(stripped.padStart(length, "0"));
  }
  return [...variants].filter(Boolean);
}

/** Corrige el guion convertido en apóstrofo por distribución de teclado. */
function layoutVariants(value: string) {
  const variants = new Set([value]);
  if (value.includes("'")) variants.add(value.replace(/'/g, "-"));
  if (value.includes("?")) variants.add(value.replace(/\?/g, "_"));
  return [...variants];
}

export function parseScan(raw: string): ParsedScan {
  const gs1 = parseGs1(raw);
  const code = normalizeBarcode(raw);
  const candidates = new Set<string>();
  const add = (value?: string) => {
    if (!value) return;
    for (const variant of layoutVariants(value.trim())) {
      if (variant) candidates.add(variant);
    }
  };
  if (gs1?.gtin) gtinVariants(gs1.gtin).forEach(add);
  // Serie y n.º de parte embebidos (Dräger Vista / Hill-Rom HR…)
  add(gs1?.serial);
  add(gs1?.ais?.["241"]);
  add(code);
  if (code.startsWith("21") && code.length > 6) add(code.slice(2));
  if (/^\d{8,14}$/.test(code)) gtinVariants(code).forEach(add);
  // Camas Hill-Rom: solo series HRP… o modelo exacto HR900 (no refacciones HR900…)
  if (!isHillRomPartNumber(code) && !isHillRomPartNumber(code.replace(/^21/i, ""))) {
    for (const seed of [gs1?.serial, gs1?.ais?.["241"], code, code.replace(/^21/i, "")]) {
      for (const alias of hillRomBedAliases(seed ?? "")) add(alias);
    }
  }
  return { raw, code, gs1, candidates: [...candidates] };
}
