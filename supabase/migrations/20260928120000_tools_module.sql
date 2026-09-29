-- Herramientas de almacén (desarmadores, llaves, etc.) y vales de préstamo a biomédica
-- con folio, entrega y devolución dentro de la misma solicitud.

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default '',
  category text not null default 'otro'
    check (category in (
      'desarmador', 'llave', 'pinzas', 'medicion', 'electrica',
      'corte', 'soldadura', 'kit', 'otro'
    )),
  brand text not null default '',
  model text not null default '',
  serial_number text not null default '',
  description text not null default '',
  location text not null default '',
  quantity_total integer not null default 1 check (quantity_total >= 0),
  condition text not null default 'bueno'
    check (condition in ('nuevo', 'bueno', 'regular', 'danado', 'baja')),
  is_active boolean not null default true,
  notes text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tools_category_idx
  on public.tools (is_active, category, name);

create table if not exists public.tool_requests (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  status text not null default 'solicitada'
    check (status in (
      'solicitada', 'entregada', 'devolucion_parcial', 'devuelta',
      'rechazada', 'cancelada'
    )),
  purpose text not null default '',
  service_order_id uuid references public.service_orders(id) on delete set null,
  service_order_folio text not null default '',
  client_name text not null default '',
  expected_return_at date,
  notes text not null default '',

  requested_by text not null default '',
  requester_name text not null default '',
  requester_job_title text not null default '',
  requester_department text not null default '',
  requester_employee_number text not null default '',
  requester_phone text not null default '',
  requested_at timestamptz not null default now(),

  delivered_by text not null default '',
  deliverer_name text not null default '',
  deliverer_job_title text not null default '',
  deliverer_department text not null default '',
  deliverer_employee_number text not null default '',
  delivered_at timestamptz,
  delivery_notes text not null default '',

  returned_at timestamptz,
  closed_by text not null default '',
  closed_reason text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tool_requests_status_idx
  on public.tool_requests (status, requested_at desc);
create index if not exists tool_requests_requested_by_idx
  on public.tool_requests (requested_by, requested_at desc);

create table if not exists public.tool_request_lines (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.tool_requests(id) on delete cascade,
  tool_id uuid references public.tools(id) on delete set null,
  tool_code text not null default '',
  tool_name text not null default '',
  tool_brand text not null default '',
  tool_model text not null default '',
  tool_serial text not null default '',
  quantity_requested integer not null check (quantity_requested > 0),
  quantity_delivered integer not null default 0 check (quantity_delivered >= 0),
  quantity_returned integer not null default 0 check (quantity_returned >= 0),
  quantity_lost integer not null default 0 check (quantity_lost >= 0),
  condition_out text not null default '',
  condition_in text not null default '',
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (quantity_returned + quantity_lost <= quantity_delivered),
  check (quantity_delivered <= quantity_requested)
);

create index if not exists tool_request_lines_request_idx
  on public.tool_request_lines (request_id, sort_order);
create index if not exists tool_request_lines_tool_idx
  on public.tool_request_lines (tool_id);

create table if not exists public.tool_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.tool_requests(id) on delete cascade,
  event_type text not null default 'nota',
  message text not null default '',
  details jsonb not null default '{}'::jsonb,
  actor text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists tool_request_events_request_idx
  on public.tool_request_events (request_id, created_at);

drop trigger if exists tools_set_updated_at on public.tools;
create trigger tools_set_updated_at
before update on public.tools
for each row execute function public.set_updated_at();

drop trigger if exists tool_requests_set_updated_at on public.tool_requests;
create trigger tool_requests_set_updated_at
before update on public.tool_requests
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.tools to anon, authenticated;
grant select, insert, update, delete on public.tool_requests to anon, authenticated;
grant select, insert, update, delete on public.tool_request_lines to anon, authenticated;
grant select, insert, update, delete on public.tool_request_events to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['tools', 'tool_requests', 'tool_request_lines', 'tool_request_events'] loop
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
