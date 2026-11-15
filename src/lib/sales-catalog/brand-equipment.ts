import { normalizeBrand } from "@/lib/inventory/brands";
import { normalizeKey } from "@/lib/equipment-grouping";
import type { CatalogDocument } from "./types";

/** Marcas de distribuidores autorizados (y las que ya se manejan en la operación). */
export const AUTHORIZED_SALES_BRANDS = [
  "Dräger",
  "Hill-Rom / Baxter",
  "Philips",
  "Welch Allyn",
  "Masimo",
  "Fisher & Paykel",
  "3M",
  "ASP",
  "B. Braun",
  "seca",
  "Mortara",
] as const;

export type AuthorizedSalesBrand = (typeof AUTHORIZED_SALES_BRANDS)[number];

export type SalesEquipmentEntry = {
  id: string;
  brand: AuthorizedSalesBrand | string;
  productLine: string;
  model: string;
  name: string;
  aliases: string[];
  tags: string[];
};

function entry(
  brand: AuthorizedSalesBrand | string,
  productLine: string,
  model: string,
  name: string,
  aliases: string[] = [],
  tags: string[] = []
): SalesEquipmentEntry {
  return {
    id: `${normalizeKey(normalizeBrand(brand))}|${normalizeKey(model || name)}`,
    brand,
    productLine,
    model,
    name,
    aliases,
    tags,
  };
}

/**
 * Índice comercial curado: mayoría de equipos que MAS maneja o puede cotizar
 * con las marcas autorizadas (no es el catálogo completo del fabricante).
 */
export const SALES_EQUIPMENT_CATALOG: SalesEquipmentEntry[] = [
  // Dräger
  entry("Dräger", "Anestesia", "Atlan A350 XL", "Máquina de anestesia Atlan A350 XL", ["Atlan A350XL", "Atlan A350", "A350 XL"], ["quirófano", "anestesia"]),
  entry("Dräger", "Anestesia", "Atlan A300", "Máquina de anestesia Atlan A300", ["Atlan A300 XL", "A300"], ["quirófano", "anestesia"]),
  entry("Dräger", "Anestesia", "Fabius Plus XL", "Unidad de anestesia Fabius Plus XL", ["Fabius", "Fabius Plus"], ["quirófano", "anestesia"]),
  entry("Dräger", "Anestesia", "Vapor 2000", "Vaporizador Vapor 2000", ["VAPOR 2000"], ["quirófano", "anestesia"]),
  entry("Dräger", "Anestesia", "D-Vapor", "Vaporizador D-Vapor (desflurano)", ["D Vapor"], ["quirófano", "anestesia"]),
  entry("Dräger", "Anestesia", "Scio Four Oxi", "Módulo de gases Scio Four Oxi", ["Scio Four"], ["quirófano", "gases"]),
  entry("Dräger", "Monitoreo", "Vista 120 C", "Monitor de signos vitales Vista 120 C", ["Vista 120", "Vista 120S"], ["UCI", "monitoreo"]),
  entry("Dräger", "Monitoreo", "Infinity M540", "Monitor Infinity M540", ["M540", "Infinity"], ["UCI", "monitoreo"]),
  entry("Dräger", "Iluminación", "Polaris 100/200", "Lámpara quirúrgica Polaris 100/200", ["Polaris", "Polaris Pro"], ["quirófano", "iluminación"]),
  entry("Dräger", "Iluminación", "Polaris Pro Plus", "Lámpara quirúrgica Polaris Pro Plus", ["Polaris Pro Plus doble"], ["quirófano", "iluminación"]),
  entry("Dräger", "Ventilación", "Babylog VN600", "Ventilador neonatal Babylog VN600", ["Babylog"], ["neonatal", "UCI"]),

  // Hill-Rom / Baxter
  entry("Hill-Rom / Baxter", "Camas hospitalarias", "Centuris Pro", "Cama clínica Centuris Pro", ["Centuris"], ["cama", "piso"]),
  entry("Hill-Rom / Baxter", "Camas hospitalarias", "Progressa", "Cama de cuidados intensivos Progressa", ["Progresa"], ["UCI", "cama"]),
  entry("Hill-Rom / Baxter", "Camas hospitalarias", "Accella", "Cama hospitalaria Accella", ["Accela"], ["cama", "piso"]),
  entry("Hill-Rom / Baxter", "Camas obstétricas", "Affinity 4", "Cama obstétrica Affinity 4", ["Affinity", "P3700"], ["parto", "obstetricia"]),
  entry("Hill-Rom / Baxter", "Camillas", "P8040", "Camilla radiotransparente P8040", ["P 8040"], ["urgencias", "camilla"]),
  entry("Hill-Rom / Baxter", "Mesa quirúrgica", "PST500", "Mesa de cirugía PST500", ["PST 500"], ["quirófano"]),

  // Philips
  entry("Philips", "Monitoreo", "IntelliVue MX550", "Monitor de paciente IntelliVue MX550", ["MX550", "IntelliVue"], ["UCI", "monitoreo"]),
  entry("Philips", "Monitoreo", "IntelliVue MX100/X3", "Monitor IntelliVue MX100 / X3", ["MX100", "X3", "MX100/X3"], ["transporte", "monitoreo"]),
  entry("Philips", "Desfibrilación", "Efficia DFM100", "Desfibrilador Efficia DFM100", ["DFM100", "EFFICIA"], ["urgencias", "desfibrilador"]),
  entry("Philips", "Monitoreo fetal", "Avalon FM20/FM30", "Monitor fetal Avalon FM20/FM30", ["Avalon", "FM20", "FM30"], ["obstetricia", "fetal"]),

  // Welch Allyn
  entry("Welch Allyn", "Diagnóstico", "7670-10", "Esfigmomanómetro aneroide 7670-10", ["7670"], ["diagnóstico", "TA"]),
  entry("Welch Allyn", "Diagnóstico", "DS44", "Esfigmomanómetro aneroide DS44", [], ["diagnóstico", "pediátrico"]),
  entry("Welch Allyn", "Monitoreo", "Connex Spot Monitor", "Monitor de signos vitales Connex Spot", ["Connex", "Spot", "Vital Signs"], ["piso", "monitoreo"]),
  entry("Welch Allyn", "Cardiología", "CardioPerfect", "Sistema ECG CardioPerfect", ["Cardioperfect", "Exercise ECG"], ["cardiología", "ECG"]),

  // Masimo
  entry("Masimo", "Monitoreo", "Radical-7", "Oxímetro Radical-7", ["Radical 7", "Radical7"], ["UCI", "SpO2"]),
  entry("Masimo", "Monitoreo", "Root", "Plataforma Root", [], ["UCI", "monitoreo"]),
  entry("Masimo", "Monitoreo", "Rad-G", "Oxímetro Rad-G", ["Rad G"], ["portátil", "SpO2"]),
  entry("Masimo", "Monitoreo", "SedLine", "Monitor de sedación SedLine", ["SedLine Sedation"], ["anestesia", "EEG"]),
  entry("Masimo", "Monitoreo", "O3", "Oxímetro regional O3", ["O3 Regional"], ["UCI", "rSO2"]),
  entry("Masimo", "Monitoreo", "EMMA", "Capnógrafo EMMA", ["EMMA Kit"], ["capnografía", "portátil"]),
  entry("Masimo", "Monitoreo", "MightySat", "Oxímetro MightySat", [], ["portátil", "SpO2"]),

  // Fisher & Paykel
  entry("Fisher & Paykel", "Alto flujo", "Airvo 2", "Sistema de alto flujo Airvo 2", ["AIRVO", "Airvo2"], ["respiratorio", "alto flujo"]),

  // 3M
  entry("3M", "Manejo térmico", "Bair Hugger", "Sistema de calentamiento Bair Hugger", ["BairHugger"], ["quirófano", "térmico"]),

  // ASP
  entry("ASP", "Esterilización", "STERRAD 100NX", "Sistema de esterilización STERRAD 100NX", ["Sterrad", "100NX"], ["esterilización", "quirófano"]),
  entry("ASP", "Esterilización", "STERRAD NX", "Sistema de esterilización STERRAD NX", ["Sterrad NX"], ["esterilización"]),

  // B. Braun
  entry("B. Braun", "Infusión", "Infusomat Space", "Bomba de infusión Infusomat Space", ["Infusomat", "Space"], ["infusión", "UCI"]),
  entry("B. Braun", "Infusión", "Perfusor Space", "Bomba de jeringa Perfusor Space", ["Perfusor"], ["infusión", "UCI"]),

  // seca
  entry("seca", "Medición", "seca 284", "Estación de medición seca 284", ["284"], ["antropometría", "consulta"]),
  entry("seca", "Medición", "seca 874", "Báscula plana seca 874", ["874"], ["peso", "consulta"]),

  // Mortara
  entry("Mortara", "Cardiología", "ELI 280", "Electrocardiógrafo ELI 280", ["ELI280", "Eli 280"], ["cardiología", "ECG"]),
  entry("Mortara", "Cardiología", "ELI 150c", "Electrocardiógrafo ELI 150c", ["ELI150", "Eli 150"], ["cardiología", "ECG"]),
];

export function salesEquipmentKey(brand: string, model: string) {
  return `equipo:${normalizeKey(normalizeBrand(brand))}|${normalizeKey(model)}`;
}

export function catalogEntryKey(entry: SalesEquipmentEntry) {
  return salesEquipmentKey(entry.brand, entry.model || entry.name);
}

/** Texto buscable de una ficha (sin acentos, minúsculas). */
export function equipmentSearchText(entry: SalesEquipmentEntry) {
  return normalizeKey(
    [entry.brand, entry.productLine, entry.model, entry.name, ...entry.aliases, ...entry.tags].join(" ")
  );
}

export function documentSearchText(doc: CatalogDocument) {
  return normalizeKey(
    [
      doc.title,
      doc.brand,
      doc.productLine,
      doc.model,
      doc.description,
      doc.version,
      doc.fileName,
      ...doc.tags,
    ].join(" ")
  );
}

/** Varios términos: todos deben aparecer en el texto. */
export function matchesBroadSearch(haystack: string, query: string) {
  const terms = normalizeKey(query).split(" ").filter(Boolean);
  if (!terms.length) return true;
  const text = normalizeKey(haystack);
  return terms.every((term) => text.includes(term));
}

/** ¿El documento corresponde a esta ficha del índice? */
export function documentMatchesEntry(doc: CatalogDocument, entry: SalesEquipmentEntry) {
  const docBrand = normalizeKey(normalizeBrand(doc.brand));
  const entryBrand = normalizeKey(normalizeBrand(entry.brand));
  if (docBrand !== entryBrand) return false;

  const docModel = normalizeKey(doc.model);
  const entryModel = normalizeKey(entry.model);
  if (docModel && entryModel && docModel === entryModel) return true;

  const haystack = normalizeKey(
    [doc.model, doc.title, doc.productLine, ...doc.tags].join(" ")
  );
  if (!haystack) return false;
  if (entryModel && haystack.includes(entryModel)) return true;
  return entry.aliases.some((alias) => {
    const key = normalizeKey(alias);
    return Boolean(key) && haystack.includes(key);
  });
}

export function groupCatalogByBrand(entries: SalesEquipmentEntry[]) {
  const order = new Map(AUTHORIZED_SALES_BRANDS.map((brand, index) => [brand, index]));
  const map = new Map<string, SalesEquipmentEntry[]>();
  for (const entry of entries) {
    const brand = normalizeBrand(entry.brand) || entry.brand;
    map.set(brand, [...(map.get(brand) ?? []), entry]);
  }
  return [...map.entries()]
    .sort(
      (a, b) =>
        (order.get(a[0] as AuthorizedSalesBrand) ?? 99) -
          (order.get(b[0] as AuthorizedSalesBrand) ?? 99) || a[0].localeCompare(b[0], "es")
    )
    .map(([brand, items]) => ({
      brand,
      lines: groupByLine(items),
      count: items.length,
    }));
}

function groupByLine(entries: SalesEquipmentEntry[]) {
  const map = new Map<string, SalesEquipmentEntry[]>();
  for (const entry of entries) {
    map.set(entry.productLine, [...(map.get(entry.productLine) ?? []), entry]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "es"))
    .map(([productLine, items]) => ({
      productLine,
      items: [...items].sort((a, b) => a.name.localeCompare(b.name, "es")),
    }));
}
