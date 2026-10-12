#!/usr/bin/env node
/**
 * Builds supabase/seed_cedros_verified.sql from the Cedros verified workbook.
 * Unique n.º de parte only. Existing catalog part numbers are skipped at insert time.
 */
import { writeFileSync } from "node:fs";
import XLSX from "xlsx";

const SOURCE =
  process.argv[2] ||
  "/home/ubuntu/.cursor/projects/workspace/uploads/INVENTARIO_GENERAL_CEDROS_VERIFICADO_8fa2.xlsx";
const OUT = process.argv[3] || new URL("../supabase/seed_cedros_verified.sql", import.meta.url);

const SHEET_BRAND = {
  ASP: "ASP",
  DRAGER: "Dräger",
  PHILIPS: "Philips",
  MASIMO: "Masimo",
  WA: "Welch Allyn",
  "3M": "3M",
};

const CAMBIO = /^(UNIFICADA|SIN CAMBIO|RELLENADA|CAMBIO)$/i;

function stripAccents(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normHeader(value) {
  return stripAccents(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function cellText(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) return String(value);
    if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
    return String(value);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).replace(/\u00a0/g, " ").trim();
}

function partNumber(value) {
  const text = cellText(value);
  if (!text || /^(n\/?a|na|-)$/i.test(text)) return "";
  if (/^\d+\.0+$/.test(text)) return text.replace(/\.0+$/, "");
  return text;
}

function headerIndex(header, aliases) {
  const wanted = new Set(aliases.map(normHeader));
  for (let i = 0; i < header.length; i += 1) {
    if (wanted.has(normHeader(header[i]))) return i;
  }
  return -1;
}

function at(row, index) {
  if (index < 0) return "";
  return cellText(row[index]);
}

function pickName(header, row) {
  const producto = at(row, headerIndex(header, ["producto"])) ||
    at(row, headerIndex(header, ["descripcion"]));
  const verIdx = headerIndex(header, ["descripcion_verificada"]);
  const camIdx = headerIndex(header, ["cambio"]);
  const v0 = at(row, verIdx);
  const v1 = at(row, verIdx + 1);
  const c0 = at(row, camIdx);
  const c1 = at(row, camIdx + 1);
  let verified = "";
  if (CAMBIO.test(c1) && v1 && !CAMBIO.test(v1)) verified = v1;
  else if (CAMBIO.test(c0) && v0 && !CAMBIO.test(v0)) verified = v0;
  else if (CAMBIO.test(v1) && v0 && !CAMBIO.test(v0)) verified = v0;
  else if (v0 && !CAMBIO.test(v0)) verified = v0;
  else if (v1 && !CAMBIO.test(v1)) verified = v1;
  const name = (verified || producto).replace(/\s+/g, " ").trim();
  return name;
}

function niceName(value) {
  const text = value.replace(/\s+/g, " ").trim();
  const letters = text.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  if (letters.length < 8) return text;
  const upper = [...letters].filter(
    (ch) => ch === ch.toUpperCase() && ch !== ch.toLowerCase()
  ).length;
  if (upper / letters.length < 0.85) return text;
  return text.toLowerCase().replace(/(^|[\s(/,-])([a-záéíóúüñ])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

function parseUnit(presentation) {
  const raw = stripAccents(presentation).toLowerCase();
  if (/caja|box/.test(raw)) return "caja";
  if (/paquete|bolsa|bag/.test(raw)) return "paquete";
  if (/rollo|roll/.test(raw)) return "rollo";
  if (/frasco/.test(raw)) return "frasco";
  if (/par\b/.test(raw)) return "par";
  return "pieza";
}

function hasExpiry(value) {
  const text = cellText(value);
  if (!text || /^(n\/?a|na|-)$/i.test(text)) return false;
  return /\d{4}/.test(text);
}

function classify({ presentation, name, comments, caducidad }) {
  const pres = stripAccents(presentation).toLowerCase();
  const blob = stripAccents(`${presentation} ${name} ${comments}`).toLowerCase();
  if (
    /\bequipo/.test(pres) ||
    /desfibril|\bd-vapor\b|vista 120|monitor de signos|monitor de paciente/.test(
      blob
    )
  ) {
    return "equipos";
  }
  if (/\binsumo\b/.test(blob) || hasExpiry(caducidad)) return "insumos";
  if (
    /cassette|indicador|indicator|integrador|papel|paper|tyvek|pouch|wrap|coban|venda|hisopo|tegaderm|electrodo|circuito|ventstar|mask litestar|mascarilla|cast padding|esteri gas|browie|bowie|steam|waterlock|sample line|transpore|durapore|attest|comply|cinta|tape/.test(
      blob
    )
  ) {
    return "insumos";
  }
  if (/refacc|repuest/.test(blob)) return "refacciones";
  return "accesorios";
}

function sqlStr(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

const workbook = XLSX.readFile(SOURCE, { cellDates: true });
const products = new Map();

for (const sheetName of workbook.SheetNames) {
  const brand = SHEET_BRAND[sheetName];
  if (!brand) continue;
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  });
  if (matrix.length < 2) continue;
  const header = matrix[0];
  const partIdx = headerIndex(header, ["no_de_parte", "n_de_parte", "no_parte"]);
  const presIdx = headerIndex(header, ["presentacion"]);
  const commentIdx = headerIndex(header, ["comentarios", "notas", "estado"]);
  const cadIdx = headerIndex(header, [
    "caducidad",
    "caducidad_fabricacion",
    "caducidad_fabricacion",
  ]);

  for (let i = 1; i < matrix.length; i += 1) {
    const row = matrix[i];
    const part = partNumber(row[partIdx]);
    if (!part) continue;
    const name = niceName(pickName(header, row));
    if (!name || /^(n\/?a|na|-)$/i.test(name)) continue;
    const presentation = at(row, presIdx);
    const comments = at(row, commentIdx);
    const caducidad = at(row, cadIdx);
    const key = part.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!key) continue;
    const next = {
      part,
      name,
      brand,
      category: classify({ presentation, name, comments, caducidad }),
      unit: parseUnit(presentation),
      description: presentation ? `Presentación: ${presentation}` : "",
      notes: comments && !CAMBIO.test(comments) ? comments : "",
    };
    const prev = products.get(key);
    if (!prev) {
      products.set(key, next);
      continue;
    }
    if (next.name.length > prev.name.length) prev.name = next.name;
    if (!prev.description && next.description) prev.description = next.description;
  }
}

const rows = [...products.values()].sort((a, b) =>
  a.brand.localeCompare(b.brand, "es") || a.part.localeCompare(b.part, "es")
);

const values = rows
  .map(
    (row) =>
      `  (${sqlStr(row.part)}, ${sqlStr(row.name)}, ${sqlStr(row.brand)}, ${sqlStr(row.category)}, ${sqlStr(row.unit)}, ${sqlStr(row.description)}, ${sqlStr(row.notes)})`
  )
  .join(",\n");

const sql = `-- Productos del inventario Cedros verificado que aún no están en el catálogo.
-- Empareja por n.º de parte normalizado: si el código ya existe, NO se modifica.
-- Las altas nuevas llevan color_tag = rojo. Existencia 0 (entra por movimientos).

begin;

create temporary table cedros_verified (
  part_number text not null,
  name text not null,
  brand text not null,
  category text not null,
  unit text not null,
  description text not null default '',
  notes text not null default ''
);

insert into cedros_verified (part_number, name, brand, category, unit, description, notes) values
${values};

with existing_parts as (
  select regexp_replace(upper(trim(part_number)), '[^A-Z0-9]', '', 'g') as part_key
  from public.inventory_items
  where coalesce(trim(part_number), '') <> ''
),
fresh as (
  select
    v.*,
    case v.category
      when 'insumos' then 'INSUMOS'
      when 'accesorios' then 'ACCESORIOS'
      when 'refacciones' then 'REFACCIONES'
      when 'equipos' then 'EQUIPO'
      when 'medicamentos' then 'MEDICAMENTOS'
      when 'reactivos' then 'REACTIVOS'
      else 'OTROS'
    end as sku_prefix,
    row_number() over (partition by v.category order by v.brand, v.part_number, v.name) as rn
  from cedros_verified v
  where regexp_replace(upper(trim(v.part_number)), '[^A-Z0-9]', '', 'g') <> ''
    and not exists (
      select 1
      from existing_parts e
      where e.part_key = regexp_replace(upper(trim(v.part_number)), '[^A-Z0-9]', '', 'g')
    )
),
seq as (
  select prefix, coalesce(max(seq), 0) as max_seq
  from (
    select
      split_part(sku, '-', 1) as prefix,
      substring(sku from '[0-9]+$')::int as seq
    from public.inventory_items
    where sku ~ '^(INSUMOS|ACCESORIOS|REFACCIONES|EQUIPO|MEDICAMENTOS|REACTIVOS|OTROS)-[0-9]{6}$'
  ) s
  group by prefix
)
insert into public.inventory_items (
  sku,
  name,
  category,
  item_kind,
  description,
  quantity,
  min_stock,
  unit,
  location,
  brand,
  color_tag,
  model,
  serial_number,
  unit_price,
  supplier,
  notes,
  is_active,
  part_number,
  manufacturer,
  subcategory
)
select
  f.sku_prefix || '-' || lpad((coalesce(seq.max_seq, 0) + f.rn)::text, 6, '0'),
  f.name,
  f.category,
  case when f.category = 'equipos' then 'equipo' else 'producto' end,
  f.description,
  0,
  0,
  f.unit,
  '',
  f.brand,
  'rojo',
  '',
  '',
  0,
  '',
  f.notes,
  true,
  f.part_number,
  f.brand,
  ''
from fresh f
left join seq on seq.prefix = f.sku_prefix;

update public.inventory_items
set
  image_path = 'catalog/photo/' || id::text,
  image_url = '/catalog/photo/' || id::text
where color_tag = 'rojo'
  and coalesce(image_url, '') = '';

commit;

notify pgrst, 'reload schema';
`;

writeFileSync(OUT, sql);
console.log(`Wrote ${rows.length} unique Cedros parts to ${OUT}`);
