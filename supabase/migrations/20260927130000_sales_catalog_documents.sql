create table if not exists public.sales_catalog_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  doc_type text not null default 'catalogo',
  brand text not null default '',
  product_line text not null default '',
  model text not null default '',
  description text not null default '',
  tags text[] not null default '{}',
  version text not null default '',
  valid_until date,
  file_path text not null,
  file_url text not null,
  file_name text not null default '',
  file_size bigint not null default 0,
  mime_type text not null default '',
  uploaded_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_catalog_documents_type_idx on public.sales_catalog_documents (doc_type);
create index if not exists sales_catalog_documents_created_idx on public.sales_catalog_documents (created_at desc);

alter table public.sales_catalog_documents enable row level security;

create policy sales_catalog_select on public.sales_catalog_documents for select to anon, authenticated using (true);
create policy sales_catalog_insert on public.sales_catalog_documents for insert to anon, authenticated with check (true);
create policy sales_catalog_update on public.sales_catalog_documents for update to anon, authenticated using (true) with check (true);
create policy sales_catalog_delete on public.sales_catalog_documents for delete to anon, authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit)
values ('sales-catalog', 'sales-catalog', true, 52428800)
on conflict (id) do nothing;

create policy sales_catalog_objects_select on storage.objects for select to public using (bucket_id = 'sales-catalog');
create policy sales_catalog_objects_insert on storage.objects for insert to public with check (bucket_id = 'sales-catalog');
create policy sales_catalog_objects_update on storage.objects for update to public using (bucket_id = 'sales-catalog');
create policy sales_catalog_objects_delete on storage.objects for delete to public using (bucket_id = 'sales-catalog');
