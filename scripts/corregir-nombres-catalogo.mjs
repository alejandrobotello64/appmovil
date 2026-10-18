#!/usr/bin/env node
/**
 * Corrige nombres (y marcas Dräger) del catálogo. No toca SKU, existencias ni precios.
 *
 *   node scripts/corregir-nombres-catalogo.mjs [--dry-run] [--cloud]
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const cloud = args.includes("--cloud");

/** Correcciones puntuales de nombre por SKU. */
const NAME_BY_SKU = {
  "ACCESORIOS-000001": "Válvula de espiración, PatientSys",
  "ACCESORIOS-000002": "Adaptador de calentador de tubo",
  "ACCESORIOS-000005": "Probe 3, skin temp, reusable",
  "ACCESORIOS-000028": "Red LNC M20-04 LNCS Patient Cable 4ft.",
  "ACCESORIOS-000029":
    "Accessory handheld lock for use with Radical 7 Color Screen signal extraction pulse oximeter",
  "ACCESORIOS-000038":
    "Accessory handheld lock key for use with Radical 7 Color Screen signal extraction pulse oximeter",
  "ACCESORIOS-000041": "Sábana térmica adulto",
  "ACCESORIOS-000042": "Manta térmica pediátrica",
  "ACCESORIOS-000047": "NIBP cuff, child",
  "ACCESORIOS-000050": "Power cord USA/J 10 A 3m GR RoHS",
  "ACCESORIOS-000055": "Bolsa de respiración 2.3 L, silicona",
  "ACCESORIOS-000057": "Bolsa de respiración 1.5 L, silicona",
  "ACCESORIOS-000058": "Mounting plate roll stand",
  "ACCESORIOS-000061": "Sonda de temperatura cutánea (skin temp probe)",
  "ACCESORIOS-000064": "IBP transducer adapter cable, Baxter/Edwards, 2m",
  "ACCESORIOS-000068": "NIBP cuff, child",
  "ACCESORIOS-000078": "SpO2 extension cable, 2m, reusable",
  "ACCESORIOS-000086": "Brazalete pediátrico",
  "ACCESORIOS-000087": "ECG 3-lead single pin AHA 1 m",
  "ACCESORIOS-000100": "Pasatubos para incubadora 8000, reutilizable",
  "ACCESORIOS-000101": "Fluorescent lamp, blue (Leuchtstofflampe, blau)",
  "ACCESORIOS-000103": "Hose grommet large",
  "ACCESORIOS-000104": "Latiguillos de 5 SG electrocardiograma genérico",
  "ACCESORIOS-000110": "Dedal SpO2 genérico",
  "ACCESORIOS-000113": "SHP UNT EtCO2 module white",
  "ACCESORIOS-000116": "EtCO2 airway adapter adult",
  "ACCESORIOS-000119": "MIB cable Nivus/Julian CO2 genérico",
  "ACCESORIOS-000134": "Reusable bipolar cord, 12 ft (3.6m) genérico",
  "ACCESORIOS-000136": "In-line injection temp. probe",
  "ACCESORIOS-000142": "Infinity ID WaterLock 2",
  "ACCESORIOS-000158": "Thumb adapter for acceleration transduction",
  "ACCESORIOS-000159": "Acceleration transducer",
  "ACCESORIOS-000161": "Spirolog flow sensor",
  "ACCESORIOS-000163": "Pieza en Y con abertura de aspiración",
  "ACCESORIOS-000164": "Test lung (Testlunge)",
  "ACCESORIOS-000170": "Pulmón de prueba silicona N con tubo flexible",
  "ACCESORIOS-000172": "Tapón sellante (sealing plug)",
  "ACCESORIOS-000173": "Accessories nebuliser BO 8000",
  "ACCESORIOS-000175": "Juego de fijación para humidificador",
  "ACCESORIOS-000181": "ID expiration valve complete",
  "ACCESORIOS-000184": "Válvula espiratoria Infinity ID reutilizable (Babylog VN500)",
  "ACCESORIOS-000187": "Válvula espiratoria ID reutilizable (Evita Infinity V500)",
  "ACCESORIOS-000188": "Válvula espiratoria ID completa",
  "ACCESORIOS-000193": "Adaptador de calentador de tubo",
  "ACCESORIOS-000194": "Humidifier MR850JSU 115V",
  "ACCESORIOS-000203": "Kit mandatory minute ventilation",
  "ACCESORIOS-000207": "Kit cylinder wrench",
  "ACCESORIOS-000208": "Cable de interfaz",
  "ACCESORIOS-000212": "Sensor de temperatura para MR850",
  "ACCESORIOS-000217": "Manguera para brazalete genérico",
  "ACCESORIOS-000218": "Cable de corriente para bomba genérico",
  "ACCESORIOS-000219": "Troncal de SpO2 genérico",
  "ACCESORIOS-000220":
    "AAMI compatible direct-connect ECG cable, 3 leads snap, adult/pediatric, AHA",
  "ACCESORIOS-000222": "Dedal SpO2 de pulsioximetría genérico",
  "ACCESORIOS-000224": "Cable ECG 3m/10 ft, AAMI genérico",
  "ACCESORIOS-000229": "Latiguillos de 3 SG electrocardiograma genérico",
  "ACCESORIOS-000230": "Latiguillos SG electrocardiograma genérico",
  "ACCESORIOS-000234": "Manguera NIBP genérico",
  "ACCESORIOS-000235": "Medibus.X 3m accessory kit",
  "ACCESORIOS-000246": "Manguera de extensión adulto 3.7m",
  "ACCESORIOS-000247": "Adaptador de calentador de tubo",
  "ACCESORIOS-000250": "Adaptador en T adulto con tapón, caja 5",
  "ACCESORIOS-000251": "Adaptador en T neonatal con tapón, caja 5",
  "ACCESORIOS-000263": "Mask LiteStar 2 w/o hook",
  "ACCESORIOS-000264": "Mask LiteStar 5 w/o hook",
  "ACCESORIOS-000265": "Pulmón de prueba para comprobación de equipo",
  "ACCESORIOS-000272": "Cable ECG 5 derivaciones telemetría AHA 70cm",
  "ACCESORIOS-000283": "Sensor SpO2 Dräger reutilizable",
  "ACCESORIOS-000292": "Monolead 6 AHA/US, 3 m",
  "ACCESORIOS-000301": "Monolead 5 chest AHA, 1.5 m",
  "ACCESORIOS-000304": "SpO2 interm cbl Masimo LNOP, 3m",
  "ACCESORIOS-000315": "TOF hand sensor, ped. SW1,7",
  "ACCESORIOS-000318": "O2 sensor, Bio-Med 10006",
  "ACCESORIOS-000321": "Sonda de temperatura cutánea reutilizable",
  "ACCESORIOS-000323": "Sonda de temperatura cutánea",
  "ACCESORIOS-000332": "Sonda de temperatura cutánea",
  "ACCESORIOS-000337": "Sensor de temperatura genérico",
  "ACCESORIOS-000338": "Sensor de SpO2 genérico",
  "ACCESORIOS-000339": "Cable troncal genérico",
  "ACCESORIOS-000366": "IntelliVue NMT patient cable",
  "ACCESORIOS-000367": "Manguito NBP pediátrico",
  "ACCESORIOS-000370": "Manguera interconexión de presión neonatal",
  "ACCESORIOS-000374": "Sensor SpO2 de dedo adulto, pediátrico reutilizable",
  "ACCESORIOS-000376": "Sensor SpO2 adulto pediátrico reutilizable",
  "ACCESORIOS-000378": "Manguito pediátrico Comfort Care",
  "ACCESORIOS-000380": "Cable interconexión de presión neonatal",
  "ACCESORIOS-000385": "Tocógrafo",
  "ACCESORIOS-000386": "Rollo de cable sólido CMR azul",
  "ACCESORIOS-000391": "Esfigmomanómetro",
  "ACCESORIOS-000392": "Cuff, WA, soft, small adult",
  "ACCESORIOS-000393": "Espéculo pediátrico",
  "ACCESORIOS-000398": "Hoja de laringoscopio #0 recta",
  "ACCESORIOS-000399": "Hoja de laringoscopio #2 recta",
  "ACCESORIOS-000400": "Hoja de laringoscopio #2 recta",
  "ACCESORIOS-000401": "Hoja de laringoscopio #3",
  "ACCESORIOS-000402": "Hoja de laringoscopio #4",
  "ACCESORIOS-000403": "Hoja de laringoscopio #00 recta",
  "ACCESORIOS-000404": "#1 Mac F/O laryngoscope",
  "ACCESORIOS-000405": "Hoja de laringoscopio #2 recta",
  "ACCESORIOS-000406": "Hoja de laringoscopio #3 curvo",
  "ACCESORIOS-000408": "BP fitting, M locking",
  "ACCESORIOS-000409": "Accessory/component",
  "ACCESORIOS-000410": "Estuche de diagnóstico Pocket LED (3.5V HAL coaxial ophth/oto)",
  "ACCESORIOS-000414": "Batería recargable 3 celdas",
  "ACCESORIOS-000415": "Estuche de diagnóstico",
  "EQUIPO-000015": "Bair Hugger Warming Unit (usado)",
  "EQUIPO-000016": "Bair Hugger Rolling Cart (usado)",
  "EQUIPO-000020": "Instrucciones de uso para monitor de paciente IntelliVue MX100/X3",
  "EQUIPO-000021": "Paletas water resistant",
  "INSUMOS-000015": "VERISURE Bowie-Dick Test Pack",
  "INSUMOS-000025": "O3 Sensor rSO2 infantil/neonatal 25/caja",
  "INSUMOS-000026": "O3 Sensor rSO2 pediatric adhesive 25/caja",
  "INSUMOS-000041": "VentStar Anesthesia (N) 180. 25/caja",
  "INSUMOS-000044": "Maxi hisopo con 5.2 ml",
  "INSUMOS-000045": "Esterilización con gas",
  "INSUMOS-000046": "Paquete para la prueba tipo Bowie-Dick",
  "INSUMOS-000047": "Integrador químico por vapor",
  "INSUMOS-000055": "Venda elástica Coban",
  "INSUMOS-000058": "Tegaderm Film",
  "INSUMOS-000059": "Tegaderm apósito de fijación",
  "INSUMOS-000062": "Película protectora sin ardor 3M",
  "INSUMOS-000065": "Apósito transparente estéril con cojín absorbente",
  "INSUMOS-000067": "Steri-Gas",
  "INSUMOS-000068": "Manta térmica pediátrica",
  "INSUMOS-000069": "Manta térmica",
  "INSUMOS-000071": "Steri-Gas",
  "INSUMOS-000089": "SoftBed Isolette",
  "INSUMOS-000097": "Mascarilla de silicona tamaño 4, adulto pequeño reutilizable",
  "INSUMOS-000108": "Oxygen sensor kit",
  "INSUMOS-000110": "Sonda de temperatura cutánea",
  "INSUMOS-000117": "Papel térmico químico",
  "INSUMOS-000124": "Papel ECG CP1200 (cardiopulmonar) caja 1000 hjs",
  "REFACCIONES-000006":
    "Accessory handheld lock for use with Radical 7 Color Screen signal extraction pulse oximeter",
  "REFACCIONES-000007":
    "Full Rainbow License Rainbow Parameter Installation tool Includes Measurements: SpCO, SpMet, SpHb, SpOC, Pi Delta 3D Alarm, Desat Index 3D alarm, Pleth Variability Index (PVi)",
  "REFACCIONES-000008":
    "Field Upgrader Rainbow Parameter Installation Tool Pleth Variability Index (PVi)",
};

function loadEnv() {
  const env = { ...process.env };
  const file = join(ROOT, ".env.local");
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

function envForTarget(env) {
  if (cloud) {
    return {
      url: env.CLOUD_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL,
      key: env.CLOUD_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
  }
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
    key: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

async function rest(base, key, method, path, body, extraHeaders = {}) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...extraHeaders,
  };
  const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || text || res.statusText;
    throw new Error(`${method} ${path} ${res.status}: ${msg}`);
  }
  return data;
}

async function restAll(base, key, path) {
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const chunk = await rest(base, key, "GET", path, null, {
      Range: `${from}-${from + page - 1}`,
    });
    if (Array.isArray(chunk)) rows.push(...chunk);
    if (!Array.isArray(chunk) || chunk.length < page) break;
  }
  return rows;
}

function fold(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeBrand(brand) {
  const trimmed = String(brand ?? "").trim();
  if (!trimmed) return trimmed;
  if (fold(trimmed) === "drager") return "Dräger";
  return trimmed;
}

async function main() {
  const env = loadEnv();
  const { url: base, key } = envForTarget(env);
  if (!base || !key) throw new Error("Faltan URL/anon de Supabase.");

  const items = await restAll(
    base,
    key,
    "/rest/v1/inventory_items?select=id,sku,name,brand&order=sku"
  );

  const changes = [];
  for (const item of items) {
    const nextName = NAME_BY_SKU[item.sku];
    const nextBrand = normalizeBrand(item.brand);
    const patch = {};
    if (nextName && nextName !== item.name) patch.name = nextName;
    if (nextBrand !== (item.brand ?? "")) patch.brand = nextBrand;
    if (Object.keys(patch).length) {
      changes.push({ sku: item.sku, from: { name: item.name, brand: item.brand }, patch });
    }
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          target: cloud ? "cloud" : "local",
          catalog: items.length,
          changes: changes.length,
          sample: changes.slice(0, 12),
        },
        null,
        2
      )
    );
    return;
  }

  let updated = 0;
  let errors = 0;
  for (const change of changes) {
    try {
      await rest(
        base,
        key,
        "PATCH",
        `/rest/v1/inventory_items?sku=eq.${encodeURIComponent(change.sku)}`,
        change.patch
      );
      updated += 1;
    } catch (error) {
      errors += 1;
      console.warn(`${change.sku}: ${error.message}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        target: cloud ? "cloud" : "local",
        catalog: items.length,
        updated,
        errors,
        names: changes.filter((c) => c.patch.name).length,
        brands: changes.filter((c) => c.patch.brand).length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
