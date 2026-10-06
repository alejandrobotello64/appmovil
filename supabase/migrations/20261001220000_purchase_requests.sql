-- Solicitudes de compra: almacén pide a compras cuando no puede surtir.

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  status text not null default 'solicitada'
    check (status in (
      'solicitada',
      'en_compra',
      'pedida',
      'parcial',
      'recibida',
      'cancelada'
    )),
  source_type text not null default 'manual'
    check (source_type in ('manual', 'requisicion_os', 'salida', 'apartado')),
  source_id uuid,
  source_folio text not null default '',
  reason text not null default 'no_surtible',
  requested_by text not null default '',
  requested_at timestamptz not null default now(),
  taken_by text not null default '',
  taken_at timestamptz,
  warehouse_notes text not null default '',
  compras_notes text not null default '',
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  purchase_order_number text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_request_lines (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  source_line_id uuid,
  product_id uuid references public.inventory_items(id) on delete set null,
  product_sku text not null default '',
  product_name text not null default '',
  quantity_requested numeric(14,2) not null check (quantity_requested > 0),
  quantity_ordered numeric(14,2) not null default 0 check (quantity_ordered >= 0),
  quantity_received numeric(14,2) not null default 0 check (quantity_received >= 0),
  unit text not null default 'pza',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists purchase_requests_status_idx
  on public.purchase_requests (status, requested_at desc);
-- Si 20261001120000 ya creó la tabla, source_type llega en
-- 20261002090000_purchase_requests_cloud_columns.sql.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'purchase_requests'
      and column_name = 'source_type'
  ) then
    execute 'create index if not exists purchase_requests_source_idx on public.purchase_requests (source_type, source_id)';
  end if;
end $$;
create index if not exists purchase_requests_order_idx
  on public.purchase_requests (purchase_order_id);
create index if not exists purchase_request_lines_request_idx
  on public.purchase_request_lines (request_id);

drop trigger if exists purchase_requests_set_updated_at on public.purchase_requests;
create trigger purchase_requests_set_updated_at
before update on public.purchase_requests
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.purchase_requests to anon, authenticated;
grant select, insert, update, delete on public.purchase_request_lines to anon, authenticated;
