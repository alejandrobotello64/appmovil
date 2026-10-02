-- Una solicitud de compra puede repartirse entre varios proveedores (una OC por
-- proveedor): cada línea guarda la OC a la que quedó asignada.
-- Las OC pueden ligarse a una o varias facturas del proveedor (CFDI PDF/XML).

alter table public.purchase_request_lines
  add column if not exists purchase_order_id uuid references public.purchase_orders(id) on delete set null;

create index if not exists purchase_request_lines_po_idx
  on public.purchase_request_lines (purchase_order_id);

update public.purchase_request_lines l
set purchase_order_id = r.purchase_order_id
from public.purchase_requests r
where r.id = l.request_id
  and r.purchase_order_id is not null
  and l.purchase_order_id is null;

create table if not exists public.purchase_order_invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.purchase_orders(id) on delete cascade,
  invoice_number text not null default '',
  cfdi_uuid text not null default '',
  issuer_rfc text not null default '',
  issuer_name text not null default '',
  invoice_date date,
  subtotal numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  currency text not null default 'MXN',
  pdf_path text not null default '',
  pdf_url text not null default '',
  xml_path text not null default '',
  xml_url text not null default '',
  notes text not null default '',
  uploaded_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists purchase_order_invoices_order_idx
  on public.purchase_order_invoices (order_id, created_at);

create unique index if not exists purchase_order_invoices_uuid_key
  on public.purchase_order_invoices (upper(cfdi_uuid))
  where cfdi_uuid <> '';

grant select, insert, update, delete on public.purchase_order_invoices to anon, authenticated;

alter table public.purchase_order_invoices enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'purchase_order_invoices'
      and policyname = 'purchase_order_invoices_app_access'
  ) then
    create policy purchase_order_invoices_app_access on public.purchase_order_invoices
      for all to anon, authenticated using (true) with check (true);
  end if;
end $$;

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public)
  values ('purchase-invoices', 'purchase-invoices', true)
  on conflict (id) do nothing;
end $$;

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'purchase_invoices_select'
  ) then
    create policy purchase_invoices_select on storage.objects
      for select using (bucket_id = 'purchase-invoices');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'purchase_invoices_insert'
  ) then
    create policy purchase_invoices_insert on storage.objects
      for insert with check (bucket_id = 'purchase-invoices');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'purchase_invoices_update'
  ) then
    create policy purchase_invoices_update on storage.objects
      for update using (bucket_id = 'purchase-invoices');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'purchase_invoices_delete'
  ) then
    create policy purchase_invoices_delete on storage.objects
      for delete using (bucket_id = 'purchase-invoices');
  end if;
end $$;

notify pgrst, 'reload schema';
