-- Imágenes de catálogo + documentos PDF en órdenes de servicio + SKU automático

alter table public.inventory_items
  add column if not exists image_path text not null default '',
  add column if not exists image_url text not null default '';

create table if not exists public.service_order_documents (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  doc_type text not null default 'seguridad_electrica'
    check (doc_type in ('seguridad_electrica', 'otro')),
  title text not null default '',
  file_path text not null default '',
  file_url text not null default '',
  file_name text not null default '',
  uploaded_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists service_order_documents_order_idx
  on public.service_order_documents (service_order_id, created_at desc);

grant select, insert, update, delete on public.service_order_documents to anon, authenticated;

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public)
  values ('inventory-media', 'inventory-media', true)
  on conflict (id) do nothing;
end $$;

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'inventory_media_select'
  ) then
    create policy inventory_media_select on storage.objects
      for select using (bucket_id = 'inventory-media');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'inventory_media_insert'
  ) then
    create policy inventory_media_insert on storage.objects
      for insert with check (bucket_id = 'inventory-media');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'inventory_media_update'
  ) then
    create policy inventory_media_update on storage.objects
      for update using (bucket_id = 'inventory-media');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'inventory_media_delete'
  ) then
    create policy inventory_media_delete on storage.objects
      for delete using (bucket_id = 'inventory-media');
  end if;
end $$;
