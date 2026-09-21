-- Solicitudes de material desde órdenes de servicio hacia almacén

create table if not exists public.service_order_requisitions (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  status text not null default 'solicitada'
    check (status in ('solicitada', 'parcial', 'surtida', 'cancelada')),
  requested_by text not null default '',
  requested_at timestamptz not null default now(),
  fulfilled_by text not null default '',
  fulfilled_at timestamptz,
  notes text not null default '',
  warehouse_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_order_requisition_lines (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.service_order_requisitions(id) on delete cascade,
  service_order_line_id uuid references public.service_order_lines(id) on delete set null,
  product_id uuid not null references public.inventory_items(id) on delete restrict,
  description text not null default '',
  quantity_requested numeric(14,2) not null check (quantity_requested > 0),
  quantity_fulfilled numeric(14,2) not null default 0 check (quantity_fulfilled >= 0),
  unit text not null default 'pza',
  line_status text not null default 'pendiente'
    check (line_status in ('pendiente', 'parcial', 'surtido', 'cancelado')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists service_order_requisitions_status_idx
  on public.service_order_requisitions (status, requested_at desc);
create index if not exists service_order_requisitions_order_idx
  on public.service_order_requisitions (service_order_id);
create index if not exists service_order_requisition_lines_req_idx
  on public.service_order_requisition_lines (requisition_id);

drop trigger if exists service_order_requisitions_set_updated_at on public.service_order_requisitions;
create trigger service_order_requisitions_set_updated_at
before update on public.service_order_requisitions
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.service_order_requisitions to anon, authenticated;
grant select, insert, update, delete on public.service_order_requisition_lines to anon, authenticated;
