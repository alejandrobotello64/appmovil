-- Restante para la nube (aditivo; no borra datos).
-- Pegar en: https://supabase.com/dashboard/project/iqfareiwiadqsauejaaf/sql/new
-- list_kind en plantillas ya está. Esto cubre checklist de OS, intervalos, candados y flags.

alter table public.service_order_checklist
  add column if not exists list_kind text not null default 'verificacion';

do $$
begin
  if not exists (
    select 1 from pg_constraint
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

alter table public.service_orders
  add column if not exists locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text not null default '';

create index if not exists service_orders_locked_idx
  on public.service_orders (locked)
  where locked = true;

alter table public.service_checklist_templates
  add column if not exists locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text not null default '';

create index if not exists service_checklist_templates_locked_idx
  on public.service_checklist_templates (locked)
  where locked = true;

alter table public.app_users
  add column if not exists is_technician boolean not null default false;
alter table public.app_users
  add column if not exists is_service_advisor boolean not null default false;

notify pgrst, 'reload schema';
