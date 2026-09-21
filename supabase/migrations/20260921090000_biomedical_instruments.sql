-- Catálogo de equipos de seguridad eléctrica, simuladores y analizadores
-- + vínculo a órdenes de servicio (instrumentos usados)

create table if not exists public.biomedical_instruments (
  id uuid primary key default gen_random_uuid(),
  instrument_type text not null default 'simulador'
    check (instrument_type in ('seguridad_electrica', 'simulador', 'analizador')),
  name text not null default '',
  brand text not null default '',
  model text not null default '',
  serial_number text not null default '',
  asset_tag text not null default '',
  location text not null default '',
  notes text not null default '',
  image_path text not null default '',
  image_url text not null default '',
  certificate_path text not null default '',
  certificate_url text not null default '',
  certificate_name text not null default '',
  certificate_number text not null default '',
  certificate_expires_at date,
  is_active boolean not null default true,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists biomedical_instruments_type_idx
  on public.biomedical_instruments (instrument_type, is_active, name);

create table if not exists public.service_order_instruments (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  instrument_id uuid references public.biomedical_instruments(id) on delete set null,
  instrument_type text not null default 'simulador'
    check (instrument_type in ('seguridad_electrica', 'simulador', 'analizador')),
  instrument_name text not null default '',
  instrument_brand text not null default '',
  instrument_model text not null default '',
  instrument_serial text not null default '',
  usage_notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists service_order_instruments_order_idx
  on public.service_order_instruments (service_order_id, sort_order);

create unique index if not exists service_order_instruments_unique_inst
  on public.service_order_instruments (service_order_id, instrument_id)
  where instrument_id is not null;

grant select, insert, update, delete on public.biomedical_instruments to anon, authenticated;
grant select, insert, update, delete on public.service_order_instruments to anon, authenticated;

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public)
  values ('biomedical-instruments', 'biomedical-instruments', true)
  on conflict (id) do nothing;
end $$;

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'biomedical_instruments_select'
  ) then
    create policy biomedical_instruments_select on storage.objects
      for select using (bucket_id = 'biomedical-instruments');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'biomedical_instruments_insert'
  ) then
    create policy biomedical_instruments_insert on storage.objects
      for insert with check (bucket_id = 'biomedical-instruments');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'biomedical_instruments_update'
  ) then
    create policy biomedical_instruments_update on storage.objects
      for update using (bucket_id = 'biomedical-instruments');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'biomedical_instruments_delete'
  ) then
    create policy biomedical_instruments_delete on storage.objects
      for delete using (bucket_id = 'biomedical-instruments');
  end if;
end $$;
