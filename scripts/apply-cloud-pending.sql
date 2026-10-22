-- Huecos actuales de iqfareiwiadqsauejaaf (aditivo; no borra datos).
-- Pegar TODO el archivo en:
-- https://supabase.com/dashboard/project/iqfareiwiadqsauejaaf/sql/new
-- luego Run.
--
-- Cubre: recepción agendada de OC, columnas extra de solicitudes de compra,
-- buckets inventory-media y sales-catalog (fotos y manuales hasta 2 GB).

begin;

-- Cita de recepción de material (calendario operativo).

alter table public.purchase_orders
  add column if not exists scheduled_receive_at date,
  add column if not exists scheduled_receive_time text not null default '',
  add column if not exists scheduled_receive_note text not null default '';

create index if not exists purchase_orders_scheduled_receive_idx
  on public.purchase_orders (scheduled_receive_at)
  where scheduled_receive_at is not null;

-- Solicitudes de compra: el stub de la nube tiene source/quantity/notes.
-- Estas columnas alinean el esquema con Compras (tomar varias SC, extras, etc.).

alter table public.purchase_requests
  add column if not exists source_type text not null default 'manual';
alter table public.purchase_requests
  add column if not exists source_id uuid;
alter table public.purchase_requests
  add column if not exists source_folio text not null default '';
alter table public.purchase_requests
  add column if not exists reason text not null default 'no_surtible';
alter table public.purchase_requests
  add column if not exists taken_by text not null default '';
alter table public.purchase_requests
  add column if not exists taken_at timestamptz;
alter table public.purchase_requests
  add column if not exists warehouse_notes text not null default '';
alter table public.purchase_requests
  add column if not exists compras_notes text not null default '';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'purchase_requests' and column_name = 'notes'
  ) then
    update public.purchase_requests
    set warehouse_notes = notes
    where coalesce(warehouse_notes, '') = '' and coalesce(notes, '') <> '';
  end if;
end $$;

alter table public.purchase_request_lines
  add column if not exists source_line_id uuid;
alter table public.purchase_request_lines
  add column if not exists quantity_requested numeric(14,2);
alter table public.purchase_request_lines
  add column if not exists quantity_ordered numeric(14,2) not null default 0;
alter table public.purchase_request_lines
  add column if not exists quantity_received numeric(14,2) not null default 0;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'purchase_request_lines' and column_name = 'quantity'
  ) then
    update public.purchase_request_lines
    set quantity_requested = quantity
    where quantity_requested is null;
  end if;
end $$;

update public.purchase_request_lines
set quantity_requested = 1
where quantity_requested is null;

alter table public.purchase_request_lines
  alter column quantity_requested set default 1;
alter table public.purchase_request_lines
  alter column quantity_requested set not null;

create index if not exists purchase_requests_status_idx
  on public.purchase_requests (status, requested_at desc);
create index if not exists purchase_requests_source_idx
  on public.purchase_requests (source_type, source_id);
create index if not exists purchase_requests_order_idx
  on public.purchase_requests (purchase_order_id);
create index if not exists purchase_request_lines_request_idx
  on public.purchase_request_lines (request_id);

grant select, insert, update, delete on public.purchase_requests to anon, authenticated;
grant select, insert, update, delete on public.purchase_request_lines to anon, authenticated;

-- Storage: fotos de producto y manuales/PDF grandes.

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit)
  values
    ('inventory-media', 'inventory-media', true, 52428800),
    ('sales-catalog', 'sales-catalog', true, 2147483648)
  on conflict (id) do update
    set public = true,
        file_size_limit = excluded.file_size_limit;
end $$;

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'inventory_media_select'
  ) then
    create policy inventory_media_select on storage.objects
      for select using (bucket_id = 'inventory-media');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'inventory_media_insert'
  ) then
    create policy inventory_media_insert on storage.objects
      for insert with check (bucket_id = 'inventory-media');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'inventory_media_update'
  ) then
    create policy inventory_media_update on storage.objects
      for update using (bucket_id = 'inventory-media');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'inventory_media_delete'
  ) then
    create policy inventory_media_delete on storage.objects
      for delete using (bucket_id = 'inventory-media');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'sales_catalog_objects_select'
  ) then
    create policy sales_catalog_objects_select on storage.objects
      for select to public using (bucket_id = 'sales-catalog');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'sales_catalog_objects_insert'
  ) then
    create policy sales_catalog_objects_insert on storage.objects
      for insert to public with check (bucket_id = 'sales-catalog');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'sales_catalog_objects_update'
  ) then
    create policy sales_catalog_objects_update on storage.objects
      for update to public using (bucket_id = 'sales-catalog');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'sales_catalog_objects_delete'
  ) then
    create policy sales_catalog_objects_delete on storage.objects
      for delete to public using (bucket_id = 'sales-catalog');
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
