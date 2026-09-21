-- Calibración en órdenes de servicio: plantillas por tipo de equipo + mediciones

alter table public.client_equipment
  add column if not exists equipment_kind text not null default 'general';

create table if not exists public.service_calibration_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  equipment_kind text not null default 'general',
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.service_calibration_template_params (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.service_calibration_templates(id) on delete cascade,
  label text not null,
  unit text not null default '',
  nominal_value text not null default '',
  min_value numeric(14,4),
  max_value numeric(14,4),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.service_orders
  add column if not exists calibration_template_id uuid
    references public.service_calibration_templates(id) on delete set null,
  add column if not exists calibration_performed_at timestamptz,
  add column if not exists calibration_instrument text not null default '',
  add column if not exists calibration_certificate text not null default '',
  add column if not exists calibration_overall text not null default 'pendiente'
    check (calibration_overall in ('pendiente', 'aprobada', 'rechazada', 'parcial')),
  add column if not exists calibration_notes text not null default '';

create table if not exists public.service_order_calibration_items (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  template_param_id uuid references public.service_calibration_template_params(id) on delete set null,
  label text not null,
  unit text not null default '',
  nominal_value text not null default '',
  measured_value text not null default '',
  min_value numeric(14,4),
  max_value numeric(14,4),
  result text not null default 'pendiente'
    check (result in ('pendiente', 'dentro', 'fuera', 'no_aplica')),
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists service_calibration_params_tpl_idx
  on public.service_calibration_template_params (template_id, sort_order);
create index if not exists service_order_calibration_items_order_idx
  on public.service_order_calibration_items (service_order_id, sort_order);

grant select, insert, update, delete on public.service_calibration_templates to anon, authenticated;
grant select, insert, update, delete on public.service_calibration_template_params to anon, authenticated;
grant select, insert, update, delete on public.service_order_calibration_items to anon, authenticated;

-- Inferir tipo en equipos existentes
update public.client_equipment set equipment_kind = case
  when lower(name || ' ' || brand || ' ' || model) ~ 'ventil|respir' then 'ventilador'
  when lower(name || ' ' || brand || ' ' || model) ~ 'desfibr|dea' then 'desfibrilador'
  when lower(name || ' ' || brand || ' ' || model) ~ 'bomba|infus' then 'bomba_infusion'
  when lower(name || ' ' || brand || ' ' || model) ~ 'monitor|multipar|spo2' then 'monitor'
  when lower(name || ' ' || brand || ' ' || model) ~ 'autocl|esteril' then 'autoclave'
  when lower(name || ' ' || brand || ' ' || model) ~ 'ecg|electrocard' then 'ecg'
  when lower(name || ' ' || brand || ' ' || model) ~ 'rayos|ultrason|imagen' then 'imagen'
  else 'general'
end
where equipment_kind = 'general' or equipment_kind is null or equipment_kind = '';

-- Plantillas de calibración por tipo de equipo
with tpl as (
  insert into public.service_calibration_templates (code, name, equipment_kind, description)
  values
    ('cal_general', 'Calibración general', 'general', 'Parámetros básicos de funcionamiento'),
    ('cal_monitor', 'Calibración · Monitor multiparámetro', 'monitor', 'SpO2, FC, NIBP y temperatura'),
    ('cal_ventilador', 'Calibración · Ventilador mecánico', 'ventilador', 'Volúmenes, presiones y FiO2'),
    ('cal_desfibrilador', 'Calibración · Desfibrilador', 'desfibrilador', 'Energía entregada y tiempos'),
    ('cal_bomba', 'Calibración · Bomba de infusión', 'bomba_infusion', 'Flujos y volumen total'),
    ('cal_autoclave', 'Calibración · Autoclave', 'autoclave', 'Temperatura, presión y ciclo'),
    ('cal_ecg', 'Calibración · Electrocardiógrafo', 'ecg', 'Velocidad y amplitud de calibración'),
    ('cal_imagen', 'Calibración · Imagenología', 'imagen', 'Parámetros generales de imagen')
  on conflict (code) do update set
    name = excluded.name,
    equipment_kind = excluded.equipment_kind,
    description = excluded.description,
    is_active = true
  returning id, code
),
pts(code, sort_order, label, unit, nominal_value, min_value, max_value) as (
  values
    -- general
    ('cal_general', 1, 'Tensión de alimentación', 'V', '120', 110::numeric, 130::numeric),
    ('cal_general', 2, 'Corriente de fuga a tierra', 'µA', '<100', 0::numeric, 100::numeric),
    ('cal_general', 3, 'Resistencia de puesta a tierra', 'Ω', '<0.5', 0::numeric, 0.5::numeric),
    -- monitor
    ('cal_monitor', 1, 'SpO2 simulado', '%', '98', 96::numeric, 100::numeric),
    ('cal_monitor', 2, 'Frecuencia cardiaca baja', 'lpm', '60', 58::numeric, 62::numeric),
    ('cal_monitor', 3, 'Frecuencia cardiaca alta', 'lpm', '180', 176::numeric, 184::numeric),
    ('cal_monitor', 4, 'NIBP sistólica', 'mmHg', '120', 114::numeric, 126::numeric),
    ('cal_monitor', 5, 'NIBP diastólica', 'mmHg', '80', 74::numeric, 86::numeric),
    ('cal_monitor', 6, 'Temperatura', '°C', '37.0', 36.7::numeric, 37.3::numeric),
    -- ventilador
    ('cal_ventilador', 1, 'Volumen tidal', 'ml', '500', 475::numeric, 525::numeric),
    ('cal_ventilador', 2, 'Frecuencia respiratoria', 'rpm', '12', 11::numeric, 13::numeric),
    ('cal_ventilador', 3, 'PEEP', 'cmH2O', '5', 4::numeric, 6::numeric),
    ('cal_ventilador', 4, 'FiO2 aire ambiente', '%', '21', 20::numeric, 23::numeric),
    ('cal_ventilador', 5, 'FiO2 oxígeno', '%', '100', 97::numeric, 100::numeric),
    ('cal_ventilador', 6, 'Presión pico', 'cmH2O', '20', 18::numeric, 22::numeric),
    -- desfibrilador
    ('cal_desfibrilador', 1, 'Energía 50 J', 'J', '50', 45::numeric, 55::numeric),
    ('cal_desfibrilador', 2, 'Energía 100 J', 'J', '100', 90::numeric, 110::numeric),
    ('cal_desfibrilador', 3, 'Energía 200 J', 'J', '200', 180::numeric, 220::numeric),
    ('cal_desfibrilador', 4, 'Tiempo de carga a 200 J', 's', '<15', 0::numeric, 15::numeric),
    ('cal_desfibrilador', 5, 'Impedancia de prueba', 'Ω', '50', 45::numeric, 55::numeric),
    -- bomba
    ('cal_bomba', 1, 'Flujo 50 ml/h', 'ml/h', '50', 47.5::numeric, 52.5::numeric),
    ('cal_bomba', 2, 'Flujo 100 ml/h', 'ml/h', '100', 95::numeric, 105::numeric),
    ('cal_bomba', 3, 'Flujo 200 ml/h', 'ml/h', '200', 190::numeric, 210::numeric),
    ('cal_bomba', 4, 'Volumen total 50 ml', 'ml', '50', 48::numeric, 52::numeric),
    ('cal_bomba', 5, 'Oclusión / alarma de presión', 'psi', 'según mfr.', null::numeric, null::numeric),
    -- autoclave
    ('cal_autoclave', 1, 'Temperatura ciclo 121 °C', '°C', '121', 119::numeric, 123::numeric),
    ('cal_autoclave', 2, 'Temperatura ciclo 134 °C', '°C', '134', 132::numeric, 136::numeric),
    ('cal_autoclave', 3, 'Presión de cámara', 'bar', '2.1', 1.9::numeric, 2.3::numeric),
    ('cal_autoclave', 4, 'Tiempo de esterilización', 'min', '15', 14::numeric, 16::numeric),
    -- ecg
    ('cal_ecg', 1, 'Velocidad de papel', 'mm/s', '25', 24::numeric, 26::numeric),
    ('cal_ecg', 2, 'Amplitud de calibración 1 mV', 'mm', '10', 9.5::numeric, 10.5::numeric),
    ('cal_ecg', 3, 'Frecuencia de muestreo / filtro', 'Hz', '150', null::numeric, null::numeric),
    -- imagen
    ('cal_imagen', 1, 'kV de referencia', 'kV', 'según protocolo', null::numeric, null::numeric),
    ('cal_imagen', 2, 'mA de referencia', 'mA', 'según protocolo', null::numeric, null::numeric),
    ('cal_imagen', 3, 'Colimación / campo', 'cm', 'según protocolo', null::numeric, null::numeric)
)
insert into public.service_calibration_template_params (
  template_id, label, unit, nominal_value, min_value, max_value, sort_order
)
select t.id, p.label, p.unit, p.nominal_value, p.min_value, p.max_value, p.sort_order
from pts p
join tpl t on t.code = p.code
where not exists (
  select 1
  from public.service_calibration_template_params existing
  where existing.template_id = t.id and existing.label = p.label
);
