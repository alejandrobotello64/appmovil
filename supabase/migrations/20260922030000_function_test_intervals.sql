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
