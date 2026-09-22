-- Plantillas y puntos de orden: checklist de verificación vs pruebas de funcionamiento.

alter table public.service_checklist_templates
  add column if not exists list_kind text not null default 'verificacion';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_checklist_templates_list_kind_check'
  ) then
    alter table public.service_checklist_templates
      add constraint service_checklist_templates_list_kind_check
      check (list_kind in ('verificacion', 'funcionamiento'));
  end if;
end $$;

alter table public.service_order_checklist
  add column if not exists list_kind text not null default 'verificacion';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_order_checklist_list_kind_check'
  ) then
    alter table public.service_order_checklist
      add constraint service_order_checklist_list_kind_check
      check (list_kind in ('verificacion', 'funcionamiento'));
  end if;
end $$;

do $$
declare
  conname text;
begin
  select con.conname into conname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'service_order_checklist'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%result%'
    and con.conname <> 'service_order_checklist_list_kind_check'
  limit 1;
  if conname is not null then
    execute format('alter table public.service_order_checklist drop constraint %I', conname);
  end if;
end $$;

alter table public.service_order_checklist
  drop constraint if exists service_order_checklist_result_check;

alter table public.service_order_checklist
  add constraint service_order_checklist_result_check
  check (result in (
    'pendiente', 'bien', 'danado', 'no_tiene',
    'pasa', 'no_pasa', 'no_aplica'
  ));

alter table public.service_orders
  add column if not exists function_test_template_id uuid
    references public.service_checklist_templates(id) on delete set null;

create index if not exists service_order_checklist_kind_idx
  on public.service_order_checklist (service_order_id, list_kind, sort_order);

create index if not exists service_checklist_templates_kind_idx
  on public.service_checklist_templates (list_kind, is_active);

update public.service_checklist_templates
set list_kind = 'verificacion'
where list_kind is null or list_kind not in ('verificacion', 'funcionamiento');

insert into public.service_checklist_templates (
  code, name, equipment_kind, description, list_kind
)
values (
  'pruebas_funcionamiento_general',
  'Pruebas de funcionamiento general',
  'general',
  'Pruebas operativas al concluir el servicio técnico.',
  'funcionamiento'
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  list_kind = 'funcionamiento';

with tpl as (
  select id from public.service_checklist_templates
  where code = 'pruebas_funcionamiento_general'
),
pts(sort_order, label) as (
  values
    (1, 'Encendido / arranque del equipo'),
    (2, 'Autodiagnóstico / POST'),
    (3, 'Alarmas audibles y visuales'),
    (4, 'Funciones principales del equipo'),
    (5, 'Precisión / desempeño observado'),
    (6, 'Interfaces / conectividad'),
    (7, 'Accesorios y periféricos'),
    (8, 'Cierre / apagado seguro')
)
insert into public.service_checklist_template_points (template_id, label, sort_order)
select tpl.id, pts.label, pts.sort_order
from pts
cross join tpl
where not exists (
  select 1
  from public.service_checklist_template_points existing
  where existing.template_id = tpl.id and existing.label = pts.label
);

notify pgrst, 'reload schema';
-- Intervalo válido y valor medido en pruebas de funcionamiento.

alter table public.service_checklist_template_points
  add column if not exists unit text not null default '',
  add column if not exists min_value numeric(14,4),
  add column if not exists max_value numeric(14,4);

alter table public.service_order_checklist
  add column if not exists unit text not null default '',
  add column if not exists min_value numeric(14,4),
  add column if not exists max_value numeric(14,4),
  add column if not exists measured_value text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_checklist_template_points_interval_check'
  ) then
    alter table public.service_checklist_template_points
      add constraint service_checklist_template_points_interval_check
      check (min_value is null or max_value is null or min_value <= max_value);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_order_checklist_interval_check'
  ) then
    alter table public.service_order_checklist
      add constraint service_order_checklist_interval_check
      check (min_value is null or max_value is null or min_value <= max_value);
  end if;
end $$;

with tpl as (
  select id from public.service_checklist_templates
  where code = 'pruebas_funcionamiento_general'
),
pts(sort_order, label, unit, min_value, max_value) as (
  values
    (20, 'SpO2', '%', 95::numeric, 100::numeric),
    (21, 'Frecuencia cardiaca', 'lpm', 60::numeric, 100::numeric),
    (22, 'Presión arterial sistólica', 'mmHg', 90::numeric, 140::numeric)
)
insert into public.service_checklist_template_points (
  template_id, label, sort_order, unit, min_value, max_value
)
select tpl.id, pts.label, pts.sort_order, pts.unit, pts.min_value, pts.max_value
from pts
cross join tpl
where not exists (
  select 1
  from public.service_checklist_template_points existing
  where existing.template_id = tpl.id and existing.label = pts.label
);

notify pgrst, 'reload schema';
-- Candado de orden de servicio: solo el asesor puede fijarlo.

alter table public.service_orders
  add column if not exists locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text not null default '';

create index if not exists service_orders_locked_idx
  on public.service_orders (locked)
  where locked = true;

notify pgrst, 'reload schema';
-- Candado en plantillas de checklist / pruebas de funcionamiento.

alter table public.service_checklist_templates
  add column if not exists locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text not null default '';

create index if not exists service_checklist_templates_locked_idx
  on public.service_checklist_templates (locked)
  where locked = true;

notify pgrst, 'reload schema';

-- Flags de técnico / asesor (columnas; las RPC se pueden aplicar después).
alter table public.app_users
  add column if not exists is_technician boolean not null default false;
alter table public.app_users
  add column if not exists is_service_advisor boolean not null default false;

notify pgrst, 'reload schema';
