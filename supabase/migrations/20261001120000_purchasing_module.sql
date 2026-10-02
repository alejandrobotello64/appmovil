-- Compras: solicitudes de compra (desde faltantes de surtimiento o manuales)
-- y bitácora de surtidos de las solicitudes de orden de servicio.

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'en_proceso', 'ordenada', 'recibida', 'rechazada', 'cancelada')),
  priority text not null default 'normal' check (priority in ('normal', 'urgente')),
  source text not null default 'manual' check (source in ('surtimiento', 'manual')),
  requisition_id uuid references public.service_order_requisitions(id) on delete set null,
  requisition_folio text not null default '',
  service_order_id uuid references public.service_orders(id) on delete set null,
  service_order_folio text not null default '',
  client_name text not null default '',
  equipment_name text not null default '',
  justification text not null default '',
  needed_by date,
  notes text not null default '',
  requested_by text not null default '',
  requester_name text not null default '',
  requester_job_title text not null default '',
  requester_department text not null default '',
  requested_at timestamptz not null default now(),
  assigned_to text not null default '',
  purchasing_notes text not null default '',
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  purchase_order_number text not null default '',
  supplier_name text not null default '',
  ordered_at timestamptz,
  received_at timestamptz,
  closed_by text not null default '',
  closed_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_requests_status_idx
  on public.purchase_requests (status, requested_at desc);
create index if not exists purchase_requests_requisition_idx
  on public.purchase_requests (requisition_id);
create index if not exists purchase_requests_po_idx
  on public.purchase_requests (purchase_order_id);

create table if not exists public.purchase_request_lines (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  requisition_line_id uuid references public.service_order_requisition_lines(id) on delete set null,
  product_id uuid references public.inventory_items(id) on delete set null,
  product_sku text not null default '',
  product_name text not null default '',
  description text not null default '',
  unit text not null default 'pza',
  quantity numeric(14,2) not null check (quantity > 0),
  stock_at_request numeric(14,2) not null default 0,
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists purchase_request_lines_request_idx
  on public.purchase_request_lines (request_id, sort_order);
create index if not exists purchase_request_lines_req_line_idx
  on public.purchase_request_lines (requisition_line_id);

create table if not exists public.purchase_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  event_type text not null default 'nota',
  message text not null default '',
  actor text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists purchase_request_events_request_idx
  on public.purchase_request_events (request_id, created_at);

create table if not exists public.service_order_requisition_fulfillments (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.service_order_requisitions(id) on delete cascade,
  line_id uuid references public.service_order_requisition_lines(id) on delete set null,
  quantity numeric(14,2) not null check (quantity > 0),
  fulfilled_by text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists service_order_requisition_fulfillments_req_idx
  on public.service_order_requisition_fulfillments (requisition_id, created_at);

drop trigger if exists purchase_requests_set_updated_at on public.purchase_requests;
create trigger purchase_requests_set_updated_at
before update on public.purchase_requests
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.purchase_requests to anon, authenticated;
grant select, insert, update, delete on public.purchase_request_lines to anon, authenticated;
grant select, insert, update, delete on public.purchase_request_events to anon, authenticated;
grant select, insert, update, delete on public.service_order_requisition_fulfillments to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'purchase_requests',
    'purchase_request_lines',
    'purchase_request_events',
    'service_order_requisition_fulfillments'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_app_access'
    ) then
      execute format(
        'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
        t || '_app_access', t
      );
    end if;
  end loop;
end $$;
