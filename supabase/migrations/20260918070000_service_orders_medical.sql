-- Órdenes de servicio técnico para equipos médicos

create table if not exists public.service_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  equipment_kind text not null default 'general',
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.service_checklist_template_points (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.service_checklist_templates(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  order_kind text not null default 'servicio'
    check (order_kind in ('cotizacion', 'servicio')),
  status text not null default 'borrador'
    check (status in (
      'borrador', 'cotizacion', 'recibido', 'diagnostico',
      'en_proceso', 'espera_refacciones', 'terminado',
      'entregado', 'cancelado'
    )),
  priority text not null default 'normal'
    check (priority in ('normal', 'urgente')),
  service_type text not null default 'mantenimiento'
    check (service_type in (
      'levantamiento', 'instalacion', 'mantenimiento',
      'reparacion', 'capacitacion', 'calibracion', 'otro'
    )),
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null default '',
  contact_name text not null default '',
  contact_phone text not null default '',
  contact_email text not null default '',
  equipment_id uuid references public.client_equipment(id) on delete set null,
  equipment_name text not null default '',
  equipment_brand text not null default '',
  equipment_model text not null default '',
  equipment_serial text not null default '',
  equipment_location text not null default '',
  delivered_by text not null default '',
  technician text not null default '',
  advisor text not null default '',
  checklist_template_id uuid references public.service_checklist_templates(id) on delete set null,
  reception_at timestamptz,
  promised_at timestamptz,
  delivered_at timestamptz,
  fault_reported text not null default '',
  general_observations text not null default '',
  diagnosis_notes text not null default '',
  service_notes text not null default '',
  authorized boolean not null default false,
  closed boolean not null default false,
  currency text not null default 'MXN',
  subtotal numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 16,
  tax_amount numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_order_lines (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  line_kind text not null default 'insumos'
    check (line_kind in (
      'insumos', 'refacciones', 'medicamentos', 'accesorios', 'mano_obra', 'otro'
    )),
  product_id uuid references public.inventory_items(id) on delete set null,
  description text not null default '',
  quantity numeric(14,2) not null default 1 check (quantity > 0),
  unit text not null default 'pza',
  unit_price numeric(14,2) not null default 0,
  line_status text not null default 'pendiente'
    check (line_status in (
      'pendiente', 'solicitado', 'disponible', 'instalado', 'no_aplica'
    )),
  sort_order integer not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.service_order_checklist (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  template_point_id uuid references public.service_checklist_template_points(id) on delete set null,
  label text not null,
  result text not null default 'pendiente'
    check (result in ('pendiente', 'bien', 'danado', 'no_tiene')),
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.service_order_images (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  stage text not null default 'recepcion'
    check (stage in (
      'recepcion', 'diagnostico', 'servicio', 'entrega', 'calidad', 'otro'
    )),
  caption text not null default '',
  file_path text not null default '',
  file_url text not null default '',
  uploaded_by text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.service_order_events (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  event_type text not null default 'nota',
  message text not null default '',
  is_internal boolean not null default true,
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists service_orders_status_idx on public.service_orders (status, updated_at desc);
create index if not exists service_orders_client_idx on public.service_orders (client_id);
create index if not exists service_orders_equipment_idx on public.service_orders (equipment_id);
create index if not exists service_order_lines_order_idx on public.service_order_lines (service_order_id);
create index if not exists service_order_checklist_order_idx on public.service_order_checklist (service_order_id);
create index if not exists service_order_images_order_idx on public.service_order_images (service_order_id);
create index if not exists service_order_events_order_idx on public.service_order_events (service_order_id, created_at desc);
create index if not exists service_checklist_points_tpl_idx on public.service_checklist_template_points (template_id, sort_order);

drop trigger if exists service_orders_set_updated_at on public.service_orders;
create trigger service_orders_set_updated_at
before update on public.service_orders
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('service-order-media', 'service-order-media', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'service_order_media_select'
  ) then
    create policy service_order_media_select on storage.objects
      for select using (bucket_id = 'service-order-media');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'service_order_media_insert'
  ) then
    create policy service_order_media_insert on storage.objects
      for insert with check (bucket_id = 'service-order-media');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'service_order_media_update'
  ) then
    create policy service_order_media_update on storage.objects
      for update using (bucket_id = 'service-order-media');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'service_order_media_delete'
  ) then
    create policy service_order_media_delete on storage.objects
      for delete using (bucket_id = 'service-order-media');
  end if;
end $$;

grant select, insert, update, delete on public.service_checklist_templates to anon, authenticated;
grant select, insert, update, delete on public.service_checklist_template_points to anon, authenticated;
grant select, insert, update, delete on public.service_orders to anon, authenticated;
grant select, insert, update, delete on public.service_order_lines to anon, authenticated;
grant select, insert, update, delete on public.service_order_checklist to anon, authenticated;
grant select, insert, update, delete on public.service_order_images to anon, authenticated;
grant select, insert, update, delete on public.service_order_events to anon, authenticated;

-- Plantillas de revisión de puntos (equipos médicos)
with tpl as (
  insert into public.service_checklist_templates (code, name, equipment_kind, description)
  values
    ('general', 'Equipos médicos en general', 'general', 'Revisión general de ingreso / entrega'),
    ('monitor', 'Monitor de signos vitales', 'monitor', 'Checklist de monitor multiparámetro'),
    ('ventilador', 'Ventilador mecánico', 'ventilador', 'Checklist de ventilador'),
    ('desfibrilador', 'Desfibrilador / DEA', 'desfibrilador', 'Checklist de desfibrilador'),
    ('bomba_infusion', 'Bomba de infusión', 'bomba_infusion', 'Checklist de bomba de infusión'),
    ('autoclave', 'Autoclave / esterilización', 'autoclave', 'Checklist de autoclave'),
    ('ecg', 'Electrocardiógrafo', 'ecg', 'Checklist de ECG'),
    ('imagen', 'Equipo de imagenología', 'imagen', 'Checklist general de imagen')
  on conflict (code) do update set name = excluded.name
  returning id, code
),
pts(code, sort_order, label) as (
  values
    ('general', 1, 'Carcasa / gabinete exterior'),
    ('general', 2, 'Pantalla / display'),
    ('general', 3, 'Botones / controles'),
    ('general', 4, 'Cable de alimentación'),
    ('general', 5, 'Conectores / puertos'),
    ('general', 6, 'Accesorios incluidos'),
    ('general', 7, 'Etiquetas / identificación'),
    ('general', 8, 'Limpieza general'),
    ('general', 9, 'Encendido / arranque'),
    ('general', 10, 'Alarmas audibles / visuales'),
    ('monitor', 1, 'Pantalla y brillo'),
    ('monitor', 2, 'Sensores SpO2'),
    ('monitor', 3, 'Cables ECG'),
    ('monitor', 4, 'Brazalete NIBP'),
    ('monitor', 5, 'Sensor de temperatura'),
    ('monitor', 6, 'Batería / autonomía'),
    ('monitor', 7, 'Impresora / registro'),
    ('monitor', 8, 'Alarmas y límites'),
    ('monitor', 9, 'Conectividad red / HL7'),
    ('ventilador', 1, 'Circuito paciente'),
    ('ventilador', 2, 'Sensores de flujo / presión'),
    ('ventilador', 3, 'Humidificador'),
    ('ventilador', 4, 'Filtros / válvulas'),
    ('ventilador', 5, 'Pantalla y menús'),
    ('ventilador', 6, 'Modos ventilatorios'),
    ('ventilador', 7, 'Alarmas de presión / volumen'),
    ('ventilador', 8, 'Batería de respaldo'),
    ('ventilador', 9, 'Fugas en circuito'),
    ('desfibrilador', 1, 'Paletas / pads'),
    ('desfibrilador', 2, 'Cables ECG'),
    ('desfibrilador', 3, 'Carga / descarga'),
    ('desfibrilador', 4, 'Batería'),
    ('desfibrilador', 5, 'Pantalla y controles'),
    ('desfibrilador', 6, 'Impresora térmica'),
    ('desfibrilador', 7, 'Prueba de auto-test'),
    ('desfibrilador', 8, 'Accesorios de emergencia'),
    ('bomba_infusion', 1, 'Carcasa y display'),
    ('bomba_infusion', 2, 'Mecanismo de bombeo'),
    ('bomba_infusion', 3, 'Sensores de oclusión'),
    ('bomba_infusion', 4, 'Detector de aire'),
    ('bomba_infusion', 5, 'Batería'),
    ('bomba_infusion', 6, 'Soportes / clamp'),
    ('bomba_infusion', 7, 'Alarmas'),
    ('bomba_infusion', 8, 'Precisión de caudal'),
    ('autoclave', 1, 'Puerta y empaque'),
    ('autoclave', 2, 'Cámara interior'),
    ('autoclave', 3, 'Manómetros / sensores'),
    ('autoclave', 4, 'Ciclos de esterilización'),
    ('autoclave', 5, 'Filtros / drenaje'),
    ('autoclave', 6, 'Alarmas de seguridad'),
    ('autoclave', 7, 'Impresora / registro de ciclo'),
    ('autoclave', 8, 'Fugas de vapor'),
    ('ecg', 1, 'Pantalla / impresora'),
    ('ecg', 2, 'Cables de paciente'),
    ('ecg', 3, 'Electrodos / pinzas'),
    ('ecg', 4, 'Calidad de trazo'),
    ('ecg', 5, 'Filtros y ganancia'),
    ('ecg', 6, 'Batería / alimentación'),
    ('ecg', 7, 'Memoria / exportación'),
    ('imagen', 1, 'Consola / panel'),
    ('imagen', 2, 'Monitor de visualización'),
    ('imagen', 3, 'Transductor / tubo / detector'),
    ('imagen', 4, 'Cables y conectores'),
    ('imagen', 5, 'Calibración / geometría'),
    ('imagen', 6, 'Colimación / protecciones'),
    ('imagen', 7, 'Alarmas de seguridad'),
    ('imagen', 8, 'Limpieza de superficies clínicas')
)
insert into public.service_checklist_template_points (template_id, label, sort_order)
select tpl.id, pts.label, pts.sort_order
from pts
join tpl on tpl.code = pts.code
where not exists (
  select 1
  from public.service_checklist_template_points existing
  where existing.template_id = tpl.id and existing.label = pts.label
);

notify pgrst, 'reload schema';
