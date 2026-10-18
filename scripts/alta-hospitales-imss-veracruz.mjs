#!/usr/bin/env node
/**
 * Alta de hospitales IMSS Veracruz, equipos instalados y una OS preventiva por equipo.
 *
 * Usage:
 *   node scripts/alta-hospitales-imss-veracruz.mjs [--dry-run] [--cloud]
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CREATED_BY = "Alejandro Botello";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const cloud = args.includes("--cloud");

const HOSPITALS = [
  {
    key: "coatzacoalcos",
    name: "HGZ No. 36 IMSS Coatzacoalcos",
    city: "Coatzacoalcos",
    state: "Veracruz",
    address: "Coatzacoalcos, Veracruz",
    notes: "Alta desde inventario de equipos IMSS Veracruz.",
  },
  {
    key: "minatitlan",
    name: "HGZMF 32 IMSS Minatitlán",
    city: "Minatitlán",
    state: "Veracruz",
    address: "Minatitlán, Veracruz",
    notes: "Alta desde inventario de equipos IMSS Veracruz.",
  },
  {
    key: "cosamaloapan",
    name: "HGZMF 35 IMSS Cosamaloapan de Carpio",
    city: "Cosamaloapan",
    state: "Veracruz",
    address: "Cosamaloapan de Carpio, Veracruz",
    notes: "Alta desde inventario de equipos IMSS Veracruz.",
  },
  {
    key: "cordoba",
    name: "HGZ No. 8 IMSS Córdoba",
    city: "Córdoba",
    state: "Veracruz",
    address: "Córdoba, Veracruz",
    notes: "Alta desde inventario de equipos IMSS Veracruz.",
  },
  {
    key: "orizaba",
    name: "HGR IMSS Orizaba",
    city: "Orizaba",
    state: "Veracruz",
    address: "Orizaba, Veracruz",
    notes: "Alta desde inventario de equipos IMSS Veracruz.",
  },
];

const EQUIPMENT = [
  ["coatzacoalcos", "Anestesia", "Dräger", "Atlan A350XL", "ASRJ-0355"],
  ["coatzacoalcos", "Monitor", "Philips", "IntelliVue MX550", "DE7180AYUR"],
  ["coatzacoalcos", "Anestesia", "Dräger", "Atlan A350XL", "ASTB-0233"],
  ["coatzacoalcos", "Monitor", "Philips", "IntelliVue MX550", "DE7770CCGE"],
  ["coatzacoalcos", "Anestesia", "Dräger", "Atlan A350XL", "ASUB-0019"],
  ["coatzacoalcos", "Monitor", "Philips", "IntelliVue MX550", "DE7580AYTJ"],
  ["coatzacoalcos", "Anestesia", "Dräger", "Atlan A350XL", "ASUB-0020"],
  ["coatzacoalcos", "Monitor", "Philips", "IntelliVue MX550", "DE7770CCGH"],
  ["coatzacoalcos", "Anestesia", "Dräger", "Atlan A350XL", "ASUB-0049"],
  ["coatzacoalcos", "Monitor", "Philips", "IntelliVue MX550", "DE7580AYTK"],
  ["coatzacoalcos", "Anestesia", "Dräger", "Atlan A350XL", "ASUB-0053"],
  ["coatzacoalcos", "Monitor", "Philips", "IntelliVue MX550", "DE7770CCG7"],
  ["minatitlan", "Anestesia", "Dräger", "Atlan A350XL", "ASUA-0198"],
  ["minatitlan", "Monitor", "Dräger", "Vista 120S", "S25NE3570"],
  ["minatitlan", "Anestesia", "Dräger", "Atlan A350XL", "ASUA-0490"],
  ["minatitlan", "Monitor", "Dräger", "Vista 120S", "S25NH1746"],
  ["minatitlan", "Anestesia", "Dräger", "Atlan A350XL", "ASUA-0491"],
  ["minatitlan", "Monitor", "Dräger", "Vista 120S", "S25NH1295"],
  ["cosamaloapan", "Anestesia", "Dräger", "Atlan A300", "ASUA-0492"],
  ["cosamaloapan", "Monitor", "Philips", "IntelliVue MX550", "DE7580ATW2"],
  ["cosamaloapan", "Vaporizador", "Dräger", "Vapor 2000", "ASUB-0651"],
  ["cosamaloapan", "Anestesia", "Dräger", "Atlan A300", "ASUA-0493"],
  ["cosamaloapan", "Monitor", "Philips", "IntelliVue MX550", "DE7580AYVE"],
  ["cosamaloapan", "Vaporizador", "Dräger", "Vapor 2000", "ASUB-0652"],
  ["cosamaloapan", "Anestesia", "Dräger", "Atlan A300", "ASUA-0494"],
  ["cosamaloapan", "Monitor", "Philips", "IntelliVue MX550", "DE7580AYW0"],
  ["cosamaloapan", "Vaporizador", "Dräger", "Vapor 2000", "ASUB-0653"],
  ["cosamaloapan", "Anestesia", "Dräger", "Atlan A300", "ASUA-0495"],
  ["cosamaloapan", "Monitor", "Philips", "IntelliVue MX550", "DE7580AYVH"],
  ["cosamaloapan", "Vaporizador", "Dräger", "Vapor 2000", "ASUB-0654"],
  ["cordoba", "Anestesia", "Dräger", "Atlan A350XL", "ASUA-0195"],
  ["cordoba", "Monitor", "Philips", "IntelliVue MX550", "DE7580AYVC"],
  ["cordoba", "Anestesia", "Dräger", "Atlan A350XL", "ASUA-0197"],
  ["cordoba", "Monitor", "Philips", "IntelliVue MX550", "DE7580AYVW"],
  ["cordoba", "Anestesia", "Dräger", "Atlan A350XL", "ASUA-0196"],
  ["cordoba", "Monitor", "Philips", "IntelliVue MX550", "DE7580AYW3"],
  ["orizaba", "Anestesia", "Dräger", "Atlan A350XL", "ASSH-0090"],
  ["orizaba", "Monitor", "Philips", "IntelliVue MX550", "DE671L3624"],
  ["orizaba", "Anestesia", "Dräger", "Atlan A300", "ASUA-0189"],
  ["orizaba", "Monitor", "Philips", "IntelliVue MX550", "DE758AYVZ"],
  ["orizaba", "Anestesia", "Dräger", "Atlan A300", "ASUA-0190"],
  ["orizaba", "Monitor", "Philips", "IntelliVue MX550", "DE7580AYYE"],
  ["orizaba", "Anestesia", "Dräger", "Atlan A300", "ASUA-0191"],
  ["orizaba", "Monitor", "Philips", "IntelliVue MX550", "DE7580AYB"],
  ["orizaba", "Anestesia", "Dräger", "Atlan A300", "ASUA-0192"],
  ["orizaba", "Monitor", "Philips", "IntelliVue MX550", "DE7580AYVD"],
  ["orizaba", "Anestesia", "Dräger", "Atlan A300", "ASUA-0193"],
  ["orizaba", "Monitor", "Philips", "IntelliVue MX550", "DE7580AYVA"],
  ["orizaba", "Anestesia", "Dräger", "Atlan A300", "ASUA-0194"],
  ["orizaba", "Monitor", "Philips", "IntelliVue MX550", "DE7580AYVF"],
];

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

function equipmentMeta(tipo) {
  if (tipo === "Anestesia") {
    return {
      name: "Máquina de anestesia",
      kind: "ventilador",
      verify: "Maquina de Anestesia",
      functionTest: "Pruebas Maquina de Anestesia",
    };
  }
  if (tipo === "Monitor") {
    return {
      name: "Monitor de signos vitales",
      kind: "monitor",
      verify: "Monitor de Signos Vitales",
      functionTest: "Pruebas Monitor de signos vitales",
    };
  }
  return {
    name: "Vaporizador",
    kind: "general",
    verify: "Vaporizador",
    functionTest: "",
  };
}

function nextServiceDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function promisedDate() {
  const date = new Date();
  date.setDate(date.getDate() + 15);
  return date.toISOString();
}

function nextFolio(existing) {
  const year = new Date().getFullYear();
  const prefix = `OS-${year}-`;
  let max = 0;
  for (const folio of existing) {
    if (!String(folio).startsWith(prefix)) continue;
    const n = Number(String(folio).slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return (seq) => `${prefix}${String(max + seq).padStart(4, "0")}`;
}

async function applyTemplate(base, key, orderId, template, listKind) {
  if (!template) return 0;
  const points = await rest(
    base,
    key,
    "GET",
    `/rest/v1/service_checklist_template_points?template_id=eq.${template.id}&select=id,label,unit,min_value,max_value,sort_order&order=sort_order`
  );
  if (!points?.length) return 0;
  await rest(
    base,
    key,
    "POST",
    "/rest/v1/service_order_checklist",
    points.map((point, index) => ({
      service_order_id: orderId,
      template_point_id: point.id,
      label: point.label,
      list_kind: listKind,
      unit: point.unit ?? "",
      min_value: point.min_value,
      max_value: point.max_value,
      measured_value: "",
      result: "pendiente",
      sort_order: Number(point.sort_order ?? index),
    }))
  );
  const patch =
    listKind === "funcionamiento"
      ? { function_test_template_id: template.id }
      : { checklist_template_id: template.id };
  await rest(base, key, "PATCH", `/rest/v1/service_orders?id=eq.${orderId}`, patch);
  return points.length;
}

async function main() {
  const env = loadEnv();
  const { url: base, key } = envForTarget(env);
  if (!base || !key) throw new Error("Faltan URL/anon de Supabase.");

  const templates = await restAll(
    base,
    key,
    "/rest/v1/service_checklist_templates?select=id,name,list_kind,is_active&is_active=eq.true"
  );
  const byTemplateName = new Map(templates.map((row) => [row.name, row]));

  const clients = await restAll(base, key, "/rest/v1/clients?select=id,name,city,state");
  const equipmentRows = await restAll(
    base,
    key,
    "/rest/v1/client_equipment?select=id,client_id,serial_number,name,brand,model"
  );
  const orders = await restAll(
    base,
    key,
    "/rest/v1/service_orders?select=id,folio,equipment_id,equipment_serial,client_id"
  );

  const clientByName = new Map(clients.map((row) => [String(row.name).trim().toLowerCase(), row]));
  const equipmentBySerial = new Map(
    equipmentRows.map((row) => [String(row.serial_number).trim().toUpperCase(), row])
  );
  const orderBySerial = new Set(
    orders
      .map((row) => String(row.equipment_serial || "").trim().toUpperCase())
      .filter(Boolean)
  );
  const makeFolio = nextFolio(orders.map((row) => row.folio));

  const stats = {
    hospitalsCreated: 0,
    hospitalsExisting: 0,
    equipmentCreated: 0,
    equipmentExisting: 0,
    ordersCreated: 0,
    ordersExisting: 0,
    errors: 0,
  };

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          target: cloud ? "cloud" : "local",
          hospitals: HOSPITALS.length,
          equipment: EQUIPMENT.length,
          existingClients: clients.length,
          existingEquipment: equipmentRows.length,
          existingOrders: orders.length,
          sample: EQUIPMENT.slice(0, 3),
        },
        null,
        2
      )
    );
    return;
  }

  const hospitalIds = new Map();
  for (const hospital of HOSPITALS) {
    const existing = clientByName.get(hospital.name.toLowerCase());
    if (existing) {
      hospitalIds.set(hospital.key, existing.id);
      stats.hospitalsExisting += 1;
      continue;
    }
    try {
      const created = await rest(base, key, "POST", "/rest/v1/clients", {
        name: hospital.name,
        contact_name: "Biomédica / Conservación",
        email: "",
        phone: "",
        rfc: "",
        address: hospital.address,
        city: hospital.city,
        state: hospital.state,
        notes: hospital.notes,
        is_active: true,
      });
      const id = created?.[0]?.id || created?.id;
      hospitalIds.set(hospital.key, id);
      clientByName.set(hospital.name.toLowerCase(), { id, name: hospital.name });
      stats.hospitalsCreated += 1;
    } catch (error) {
      stats.errors += 1;
      console.warn(`hospital ${hospital.name}: ${error.message}`);
    }
  }

  let folioSeq = 0;
  for (const [hospitalKey, tipo, brand, model, serial] of EQUIPMENT) {
    const clientId = hospitalIds.get(hospitalKey);
    const hospital = HOSPITALS.find((row) => row.key === hospitalKey);
    if (!clientId || !hospital) {
      stats.errors += 1;
      console.warn(`sin hospital para ${serial}`);
      continue;
    }
    const meta = equipmentMeta(tipo);
    const serialKey = serial.trim().toUpperCase();
    let equipment = equipmentBySerial.get(serialKey);
    if (!equipment) {
      try {
        const created = await rest(base, key, "POST", "/rest/v1/client_equipment", {
          client_id: clientId,
          name: meta.name,
          brand,
          model,
          serial_number: serial,
          location: hospital.name,
          status: "operativo",
          equipment_kind: meta.kind,
          installed_at: null,
          notes: `Inventario IMSS Veracruz · ${tipo}`,
        });
        equipment = created?.[0] || created;
        equipmentBySerial.set(serialKey, equipment);
        stats.equipmentCreated += 1;
      } catch (error) {
        stats.errors += 1;
        console.warn(`equipo ${serial}: ${error.message}`);
        continue;
      }
    } else {
      stats.equipmentExisting += 1;
    }

    if (orderBySerial.has(serialKey)) {
      stats.ordersExisting += 1;
      continue;
    }

    folioSeq += 1;
    const folio = makeFolio(folioSeq);
    try {
      const created = await rest(base, key, "POST", "/rest/v1/service_orders", {
        folio,
        order_kind: "servicio",
        status: "recibido",
        priority: "normal",
        service_type: "preventivo",
        client_id: clientId,
        client_name: hospital.name,
        contact_name: "Biomédica / Conservación",
        contact_phone: "",
        contact_email: "",
        equipment_id: equipment.id,
        equipment_name: meta.name,
        equipment_brand: brand,
        equipment_model: model,
        equipment_serial: serial,
        equipment_location: hospital.name,
        technician: "",
        advisor: CREATED_BY,
        reception_at: new Date().toISOString(),
        promised_at: promisedDate(),
        next_service_at: nextServiceDate(),
        fault_reported: `Servicio preventivo anual · ${meta.name} ${brand} ${model} · SN ${serial}`,
        general_observations: "Alta masiva desde inventario de equipos IMSS Veracruz.",
        created_by: CREATED_BY,
        tax_rate: 16,
        tax_exempt: false,
        discount: 0,
        discount_percent: 0,
        subtotal: 0,
        tax_amount: 0,
        total: 0,
      });
      const order = created?.[0] || created;
      await rest(base, key, "POST", "/rest/v1/service_order_events", {
        service_order_id: order.id,
        event_type: "creacion",
        message: `Orden creada · ${folio}`,
        is_internal: true,
        created_by: CREATED_BY,
      });
      const verify = byTemplateName.get(meta.verify);
      const tests = meta.functionTest ? byTemplateName.get(meta.functionTest) : null;
      await applyTemplate(base, key, order.id, verify, "verificacion");
      await applyTemplate(base, key, order.id, tests, "funcionamiento");
      orderBySerial.add(serialKey);
      stats.ordersCreated += 1;
      if (stats.ordersCreated % 10 === 0) {
        console.log(`progress OS ${stats.ordersCreated}/${EQUIPMENT.length}`);
      }
    } catch (error) {
      stats.errors += 1;
      folioSeq -= 1;
      console.warn(`OS ${serial}: ${error.message}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        target: cloud ? "cloud" : "local",
        ...stats,
        equipmentListed: EQUIPMENT.length,
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
