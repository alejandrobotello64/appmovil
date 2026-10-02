-- El control de viáticos se generaliza a un módulo de Gastos: cada registro tiene un tipo
-- (viáticos, gastos corrientes, caja chica u otros) y sus gastos con comprobante PDF/XML.
-- Las tablas travel_* se crearon vacías en la migración anterior; aquí solo se renombran.

alter table public.travel_trips rename to expense_reports;
alter table public.travel_expenses rename to expense_items;
alter table public.travel_trip_events rename to expense_report_events;

alter table public.expense_items rename column trip_id to report_id;
alter table public.expense_report_events rename column trip_id to report_id;

alter table public.expense_reports
  add column if not exists kind text not null default 'viaticos'
    check (kind in ('viaticos', 'corriente', 'caja_chica', 'otros')),
  add column if not exists title text not null default '';

alter table public.expense_reports rename constraint travel_trips_dates_check to expense_reports_dates_check;
alter table public.expense_reports rename constraint travel_trips_status_check to expense_reports_status_check;
alter table public.expense_reports rename constraint travel_trips_advance_amount_check to expense_reports_advance_amount_check;
alter table public.expense_reports rename constraint travel_trips_folio_key to expense_reports_folio_key;
alter table public.expense_reports rename constraint travel_trips_pkey to expense_reports_pkey;
alter table public.expense_items rename constraint travel_expenses_pkey to expense_items_pkey;
alter table public.expense_items rename constraint travel_expenses_total_check to expense_items_total_check;
alter table public.expense_items rename constraint travel_expenses_trip_id_fkey to expense_items_report_id_fkey;
alter table public.expense_report_events rename constraint travel_trip_events_pkey to expense_report_events_pkey;
alter table public.expense_report_events rename constraint travel_trip_events_trip_id_fkey to expense_report_events_report_id_fkey;

-- efectivo: del anticipo o fondo · tarjeta_empresa / pago_empresa: lo pagó la empresa ·
-- personal: lo pagó el colaborador y se le reembolsa.
alter table public.expense_items drop constraint travel_expenses_payment_method_check;
alter table public.expense_items
  add constraint expense_items_payment_method_check
  check (payment_method in ('efectivo', 'tarjeta_empresa', 'pago_empresa', 'personal'));

alter index public.travel_trips_dates_idx rename to expense_reports_dates_idx;
alter index public.travel_trips_employee_idx rename to expense_reports_employee_idx;
alter index public.travel_expenses_date_idx rename to expense_items_date_idx;
alter index public.travel_expenses_trip_idx rename to expense_items_report_idx;
alter index public.travel_expenses_uuid_key rename to expense_items_uuid_key;
alter index public.travel_trip_events_trip_idx rename to expense_report_events_report_idx;

create index if not exists expense_reports_kind_idx on public.expense_reports (kind, start_date desc);

alter policy travel_trips_app_access on public.expense_reports rename to expense_reports_app_access;
alter policy travel_expenses_app_access on public.expense_items rename to expense_items_app_access;
alter policy travel_trip_events_app_access on public.expense_report_events rename to expense_report_events_app_access;

drop trigger if exists travel_trips_assign_folio on public.expense_reports;
drop trigger if exists travel_trips_set_updated_at on public.expense_reports;
drop trigger if exists travel_expenses_set_updated_at on public.expense_items;
drop function if exists public.travel_trips_assign_folio();

create or replace function public.expense_reports_assign_folio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.folio, '') = '' then
    new.folio := public.next_document_folio(
      case new.kind
        when 'viaticos' then 'VIA'
        when 'corriente' then 'GC'
        when 'caja_chica' then 'CCH'
        else 'GTO'
      end
    );
  end if;
  return new;
end;
$$;

create trigger expense_reports_assign_folio
  before insert on public.expense_reports
  for each row execute function public.expense_reports_assign_folio();

create trigger expense_reports_set_updated_at
  before update on public.expense_reports
  for each row execute function public.set_updated_at();

create trigger expense_items_set_updated_at
  before update on public.expense_items
  for each row execute function public.set_updated_at();

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public)
  values ('expense-receipts', 'expense-receipts', true)
  on conflict (id) do nothing;
end $$;

do $$
declare
  op text;
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  foreach op in array array['select', 'insert', 'update', 'delete'] loop
    execute format('drop policy if exists %I on storage.objects', 'travel_receipts_' || op);
    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'expense_receipts_' || op
    ) then
      if op = 'insert' then
        execute format(
          'create policy %I on storage.objects for insert with check (bucket_id = %L)',
          'expense_receipts_' || op, 'expense-receipts'
        );
      else
        execute format(
          'create policy %I on storage.objects for %s using (bucket_id = %L)',
          'expense_receipts_' || op, op, 'expense-receipts'
        );
      end if;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
