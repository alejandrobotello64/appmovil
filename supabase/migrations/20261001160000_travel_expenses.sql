-- Control de viáticos: viajes/comisiones de colaboradores, sus gastos por categoría con
-- comprobante (factura PDF/XML) y la bitácora del flujo captura → revisión → aprobación → cierre.

create table if not exists public.travel_trips (
  id uuid primary key default gen_random_uuid(),
  folio text unique,
  employee_name text not null,
  employee_username text not null default '',
  department text not null default '',
  purpose text not null default '',
  destination text not null default '',
  client_name text not null default '',
  start_date date not null,
  end_date date not null,
  advance_amount numeric(14,2) not null default 0 check (advance_amount >= 0),
  status text not null default 'en_captura'
    check (status in ('en_captura', 'por_revisar', 'aprobado', 'rechazado', 'cerrado', 'cancelado')),
  reviewed_by text not null default '',
  reviewed_at timestamptz,
  review_notes text not null default '',
  notes text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_trips_dates_check check (end_date >= start_date)
);

create index if not exists travel_trips_dates_idx on public.travel_trips (start_date desc);
create index if not exists travel_trips_employee_idx on public.travel_trips (employee_username);

create table if not exists public.travel_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.travel_trips(id) on delete cascade,
  expense_date date not null,
  category text not null default 'otros',
  concept text not null default '',
  supplier_name text not null default '',
  supplier_rfc text not null default '',
  invoice_number text not null default '',
  cfdi_uuid text not null default '',
  subtotal numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null check (total >= 0),
  payment_method text not null default 'efectivo'
    check (payment_method in ('efectivo', 'tarjeta_empresa', 'tarjeta_personal', 'transferencia')),
  pdf_path text not null default '',
  pdf_url text not null default '',
  xml_path text not null default '',
  xml_url text not null default '',
  notes text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists travel_expenses_trip_idx on public.travel_expenses (trip_id, expense_date);
create index if not exists travel_expenses_date_idx on public.travel_expenses (expense_date);

create unique index if not exists travel_expenses_uuid_key
  on public.travel_expenses (upper(cfdi_uuid))
  where cfdi_uuid <> '';

create table if not exists public.travel_trip_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.travel_trips(id) on delete cascade,
  event_type text not null default 'nota',
  message text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists travel_trip_events_trip_idx on public.travel_trip_events (trip_id, created_at);

create or replace function public.travel_trips_assign_folio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.folio, '') = '' then
    new.folio := public.next_document_folio('VIA');
  end if;
  return new;
end;
$$;

drop trigger if exists travel_trips_assign_folio on public.travel_trips;
create trigger travel_trips_assign_folio
  before insert on public.travel_trips
  for each row execute function public.travel_trips_assign_folio();

drop trigger if exists travel_trips_set_updated_at on public.travel_trips;
create trigger travel_trips_set_updated_at
  before update on public.travel_trips
  for each row execute function public.set_updated_at();

drop trigger if exists travel_expenses_set_updated_at on public.travel_expenses;
create trigger travel_expenses_set_updated_at
  before update on public.travel_expenses
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.travel_trips to anon, authenticated;
grant select, insert, update, delete on public.travel_expenses to anon, authenticated;
grant select, insert, update, delete on public.travel_trip_events to anon, authenticated;

alter table public.travel_trips enable row level security;
alter table public.travel_expenses enable row level security;
alter table public.travel_trip_events enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['travel_trips', 'travel_expenses', 'travel_trip_events'] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = t || '_app_access'
    ) then
      execute format(
        'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
        t || '_app_access', t
      );
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public)
  values ('travel-receipts', 'travel-receipts', true)
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
    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'travel_receipts_' || op
    ) then
      if op = 'insert' then
        execute format(
          'create policy %I on storage.objects for insert with check (bucket_id = %L)',
          'travel_receipts_' || op, 'travel-receipts'
        );
      else
        execute format(
          'create policy %I on storage.objects for %s using (bucket_id = %L)',
          'travel_receipts_' || op, op, 'travel-receipts'
        );
      end if;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
