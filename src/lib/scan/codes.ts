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
  // Uso interno del fabricante (Dräger AI 93 = REF-rev, etc.)
  "90": 30,
  "91": 30,
  "92": 30,
  "93": 30,
  "94": 30,
  "95": 30,
  "96": 30,
  "97": 30,
  "98": 30,
  "99": 30,
};

/** Normaliza separadores FNC1/GS que la cámara o apps suelen devolver como texto. */
function normalizeGroupSeparators(raw: string) {
  return raw
    .replace(/\{GS\}|<GS>|\[GS\]|\u241d/gi, GS)
    // FNC1 (232) que a veces llega como Latin-1 sin convertir a GS.
    .replace(/\u00e8/g, GS);
}

/**
 * Compacta lecturas con espacios entre AIs
 * ("01 0123… 10 LOT 17 251231") → concatenado usable por parseConcatenated.
 */
function collapseSpacedGs1(data: string) {
  if (!/\s/.test(data)) return data;
  // Formato con paréntesis: quitar solo espacios.
  if (/\(\d{2,4}\)/.test(data)) return data.replace(/\s+/g, "");

  const spaced = data.replace(/\s+/g, " ").trim();
  // "01 01234567890128 10 LOTABC 17 251231 11 240115"
  if (
    /^(?:\(?\d{2,4}\)?\s+\S+)(?:\s+\(?\d{2,4}\)?\s+\S+)+$/.test(spaced) ||
    /^(?:01|02|10|11|17|15|13|21|240|241)\s+\S+/.test(spaced)
  ) {
    const tokens = spaced.split(" ");
    let out = "";
    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i].replace(/[()]/g, "");
      if (/^\d{2,4}$/.test(token) && (token in FIXED_LENGTH || token in VARIABLE_LENGTH)) {
        const ai = token;
        i += 1;
        const fixed = FIXED_LENGTH[ai];
        if (fixed) {
          const digits = (tokens[i] ?? "").replace(/\D/g, "");
          if (digits.length >= fixed) {
            out += ai + digits.slice(0, fixed);
            i += 1;
            continue;
          }
        }
        // Variable: siguiente token(s) hasta el próximo AI.
        const parts: string[] = [];
        while (i < tokens.length) {
          const next = tokens[i].replace(/[()]/g, "");
          if (
            /^\d{2,4}$/.test(next) &&
            (next in FIXED_LENGTH || next in VARIABLE_LENGTH) &&
            parts.length > 0
          ) {
            break;
          }
          parts.push(tokens[i]);
          i += 1;
        }
        out += ai + parts.join("");
        continue;
      }
      out += tokens[i];
      i += 1;
    }
    if (out.length > 8) return out;
  }
  // Último recurso: quitar espacios si el resto parece GS1 dígitos/letras.
  const compact = data.replace(/\s+/g, "");
  if (/^(01|02)\d{14}/.test(compact) || /^(10|11|17|15|240|241)/.test(compact)) {
    return compact;
  }
  return data;
}

function cleanRaw(raw: string) {
  return collapseSpacedGs1(
    normalizeGroupSeparators(raw)
      .replace(/\r|\n|\t/g, "")
      .replace(/^\](?:d2|C1|Q3|e0|d1|Q1|E0|A0)/i, "")
      .trim()
  );
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
  const daysInMonth = new Date(year, mm, 0).getDate();
  // dd=00 = último día del mes (GS1); rechazar días imposibles (evita 17 dentro de refs).
  if (dd === 0) dd = daysInMonth;
  if (dd < 1 || dd > daysInMonth) return undefined;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** Fechas humanas / GS1 flexibles → ISO (YYYY-MM-DD). */
function parseFlexibleDate(raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  const gs1 = gs1Date(value);
  if (gs1) return gs1;
  // YYYYMMDD / YYYY-MM-DD / YYYY/MM/DD
  let match = /^(\d{4})[./-]?(\d{2})[./-]?(\d{2})$/.exec(value);
  if (match) {
    const [, y, m, d] = match;
    const stamp = gs1Date(`${y.slice(2)}${m}${d}`);
    if (stamp) return stamp;
  }
  // DD/MM/YYYY o DD-MM-YY
  match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(value);
  if (match) {
    const dd = match[1].padStart(2, "0");
    const mm = match[2].padStart(2, "0");
    let yyyy = match[3];
    if (yyyy.length === 2) yyyy = String(Number(yyyy) >= 51 ? 1900 + Number(yyyy) : 2000 + Number(yyyy));
    return gs1Date(`${yyyy.slice(2)}${mm}${dd}`);
  }
  // MM/YYYY o MM-YY (último día del mes = caducidad típica)
  match = /^(\d{1,2})[./-](\d{2,4})$/.exec(value);
  if (match) {
    const mm = match[1].padStart(2, "0");
    let yyyy = match[2];
    if (yyyy.length === 2) yyyy = String(Number(yyyy) >= 51 ? 1900 + Number(yyyy) : 2000 + Number(yyyy));
    return gs1Date(`${yyyy.slice(2)}${mm}00`);
  }
  return undefined;
}

/**
 * Si el lote trae sufijos EXP/CAD/MFG pegados (común cuando falta FNC1),
 * separa lote y fechas.
 */
function splitLotDateSuffix(lot: string): {
  lot: string;
  expiry?: string;
  productionDate?: string;
} {
  let remaining = lot.trim();
  let expiry: string | undefined;
  let productionDate: string | undefined;

  const expMatch =
    /^(.*?)(?:EXP|CAD(?:UC(?:IDAD)?)?|USE\s*BY|BEST(?:\s*BEFORE)?|BB)[.\s:/_-]*([0-9./-]{6,10})$/i.exec(
      remaining
    );
  if (expMatch) {
    const date = parseFlexibleDate(expMatch[2]);
    if (date) {
      expiry = date;
      remaining = expMatch[1].replace(/[-_/.\s]+$/, "");
    }
  }

  const mfgMatch =
    /^(.*?)(?:MFG|MFD|FAB(?:RIC(?:ATION|ACIÓN)?)?|PROD(?:UCTION|UCCION)?)[.\s:/_-]*([0-9./-]{6,10})$/i.exec(
      remaining
    );
  if (mfgMatch) {
    const date = parseFlexibleDate(mfgMatch[2]);
    if (date) {
      productionDate = date;
      remaining = mfgMatch[1].replace(/[-_/.\s]+$/, "");
    }
  }

  return { lot: remaining || lot.trim(), expiry, productionDate };
}

/** LOT / EXP / MFG impresos junto al código (texto legible). */
function parseHumanReadableHints(raw: string): {
  lot?: string;
  expiry?: string;
  productionDate?: string;
} {
  const text = raw.replace(/\r|\n/g, " ");
  const lot =
    /\b(?:LOT|LOTE|BATCH|LOT\s*NO\.?|L\.?\s*N\.?)\s*[:#.]?\s*([A-Za-z0-9][A-Za-z0-9._/-]{1,24})/i.exec(
      text
    )?.[1];
  const expiryRaw =
    /\b(?:EXP|CAD(?:UCIDAD)?|USE\s*BY|BEST\s*BEFORE|EXPIR(?:Y|ES)?)\s*[:#.]?\s*([0-9]{1,4}[./-][0-9]{1,4}(?:[./-][0-9]{1,4})?|[0-9]{6,8})/i.exec(
      text
    )?.[1];
  const mfgRaw =
    /\b(?:MFG|MFD|FAB(?:RICACIÓN)?|PROD(?:UCTION)?|MANUF)\s*[:#.]?\s*([0-9]{1,4}[./-][0-9]{1,4}(?:[./-][0-9]{1,4})?|[0-9]{6,8})/i.exec(
      text
    )?.[1];
  return {
    lot: lot?.trim(),
    expiry: expiryRaw ? parseFlexibleDate(expiryRaw) : undefined,
    productionDate: mfgRaw ? parseFlexibleDate(mfgRaw) : undefined,
  };
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

/** Tras una fecha GS1: fin, FNC1, AI conocido o AI interno 9x (p. ej. Dräger 93). */
function looksLikeAiAfterDate(data: string, after: number) {
  if (after >= data.length || data[after] === GS) return true;
  if (aiAt(data, after) !== null) return true;
  // AIs de 2 dígitos aún no catalogados: no dejar que el lote se coma la fecha.
  const nextTwo = data.slice(after, after + 2);
  return /^\d{2}$/.test(nextTwo) && after + 2 < data.length;
}

/**
 * Sin FNC1, los AI de longitud variable se comen a los siguientes.
 * - 240/241: se comen 11/17/10
 * - 10 (lote): se come 11/17 y también 240/241/93 (p. ej. etiqueta
 *   (01)(11)(17)(10)250418(240)MP00303-11 → sin GS el lote tragaba la ref)
 * - 21 (serie): puede ir seguido de lote/fecha/ref
 * Etiqueta Dräger típica: (01)(10)lote-con-guion(11)fab(93)ref-rev
 */
function nextAiBoundary(data: string, start: number, max: number, currentAi: string) {
  const gsIndex = data.indexOf(GS, start);
  let hardEnd = gsIndex === -1 ? data.length : gsIndex;
  if (hardEnd - start > max) hardEnd = start + max;

  const splitOnDates = [
    "10",
    "21",
    "22",
    "240",
    "241",
    "250",
    "400",
    "90",
    "91",
    "92",
    "93",
    "94",
    "95",
    "96",
    "97",
    "98",
    "99",
  ].includes(currentAi);
  // Incluye "10": el lote numérico (p. ej. 250418) no debe tragarse (240)MP00303-11.
  const splitOnLotSerialRef = [
    "10",
    "21",
    "22",
    "240",
    "241",
    "250",
    "400",
    "90",
    "91",
    "92",
    "93",
    "94",
    "95",
    "96",
    "97",
    "98",
    "99",
  ].includes(currentAi);
  if (!splitOnDates && !splitOnLotSerialRef) return hardEnd;

  // Refs de catálogo (p. ej. 2870173) suelen tener ≥5 chars; evita cortar a mitad del n.º.
  const minLen = currentAi === "240" || currentAi === "241" ? 5 : 1;
  for (let i = start + minLen; i < hardEnd; i++) {
    const two = data.slice(i, i + 2);
    const three = data.slice(i, i + 3);

    if (splitOnDates && ["11", "12", "13", "15", "16", "17"].includes(two)) {
      const stamp = data.slice(i + 2, i + 8);
      if (/^\d{6}$/.test(stamp) && gs1Date(stamp) && looksLikeAiAfterDate(data, i + 8)) {
        return i;
      }
    }
    if (!splitOnLotSerialRef) continue;
    // No cortar un AI 10 contra otro "10" espurio dentro del mismo lote.
    if (currentAi !== "10" && two === "10" && /^[A-Za-z0-9]/.test(data[i + 2] ?? "")) {
      return i;
    }
    if (two === "21" && data.length - (i + 2) >= 4) return i;
    if (/^9\d$/.test(two) && data.length - (i + 2) >= 3) return i;
    if (
      (three === "240" || three === "241" || three === "250" || three === "400") &&
      data.length - (i + 3) >= 3
    ) {
      // Tras 240/241 la ref suele empezar con letra o dígito (MP00303-11, 2870173…).
      const refStart = data[i + 3] ?? "";
      if (/[A-Za-z0-9]/.test(refStart)) return i;
    }
  }
  return hardEnd;
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
    const end = nextAiBoundary(data, index, max, ai);
    if (end <= index) return Object.keys(ais).length ? ais : null;
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
  const human = parseHumanReadableHints(raw);
  let ais: Record<string, string> | null = null;
  if (/^\(\d{2,4}\)/.test(data)) {
    ais = parseParenthesized(data);
  } else if (/^(01|02)\d{14}/.test(data) && data.length > 16) {
    ais = parseConcatenated(data);
  } else if (data.includes(GS) && /^\d{2}/.test(data)) {
    ais = parseConcatenated(data);
  } else if (
    // DataMatrix a veces llega sin GTIN inicial (solo 240/10/11/17…)
    // Lotes suelen empezar con letra (10LOT…), no solo dígito.
    /^(240|241|10|11|17|15|16|13)[\dA-Za-z]/.test(data) &&
    data.length >= 8
  ) {
    ais = parseConcatenated(data);
  } else if (/^21[A-Za-z0-9._-]{6,}/.test(data.replace(new RegExp(GS, "g"), ""))) {
    ais = parseEmbeddedSerialPart(data);
  }
  if (!ais) {
    // Sin estructura GS1: aún podemos recuperar lote/fechas del texto legible.
    if (!human.lot && !human.expiry && !human.productionDate) return null;
    return {
      lot: human.lot,
      expiry: human.expiry,
      productionDate: human.productionDate,
      ais: {},
    };
  }
  const gtin = ais["01"] ?? ais["02"];
  if (!gtin && !ais["10"] && !ais["21"] && !ais["240"] && !ais["241"] && !human.lot) {
    return null;
  }

  let lot = ais["10"] || human.lot;
  let expiry =
    (ais["17"] ? gs1Date(ais["17"]) : undefined) ||
    (ais["15"] ? gs1Date(ais["15"]) : undefined) ||
    (ais["16"] ? gs1Date(ais["16"]) : undefined) ||
    human.expiry;
  let productionDate =
    (ais["11"] ? gs1Date(ais["11"]) : undefined) ||
    (ais["13"] ? gs1Date(ais["13"]) : undefined) ||
    human.productionDate;

  if (lot) {
    const split = splitLotDateSuffix(lot);
    lot = split.lot || lot;
    if (!expiry && split.expiry) expiry = split.expiry;
    if (!productionDate && split.productionDate) productionDate = split.productionDate;
  }

  return {
    gtin,
    lot,
    serial: ais["21"],
    expiry,
    productionDate,
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
  // Serie y n.º de parte embebidos (Dräger Vista / AI 240/241/93 / Hill-Rom HR…)
  add(gs1?.serial);
  add(gs1?.lot);
  add(gs1?.ais?.["240"]);
  add(gs1?.ais?.["241"]);
  // AI 240/93 con revisión: "MP00303-11" / "2870173-14" → también busca el REF base.
  for (const key of ["240", "241", "93"] as const) {
    const ref = gs1?.ais?.[key];
    add(ref);
    if (ref?.includes("-")) add(ref.split("-")[0]);
  }
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
