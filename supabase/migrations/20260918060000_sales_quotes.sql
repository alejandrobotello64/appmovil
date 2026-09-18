-- Cotizaciones comerciales (seguimiento de ventas + PDF)

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  title text not null default '',
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null default '',
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  city text not null default '',
  state text not null default '',
  status text not null default 'borrador'
    check (status in (
      'borrador', 'enviada', 'en_seguimiento', 'negociacion',
      'aceptada', 'rechazada', 'vencida', 'cancelada'
    )),
  quote_date date not null default current_date,
  valid_until date,
  next_follow_up date,
  last_contact_at date,
  currency text not null default 'MXN',
  subtotal numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 16,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  salesperson text not null default '',
  probability integer not null default 50 check (probability between 0 and 100),
  notes text not null default '',
  loss_reason text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid references public.inventory_items(id) on delete set null,
  description text not null default '',
  quantity numeric(14,2) not null default 1 check (quantity > 0),
  unit text not null default 'pza',
  unit_price numeric(14,2) not null default 0,
  sort_order integer not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  event_type text not null default 'nota',
  message text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists quotes_status_idx on public.quotes (status, next_follow_up);
create index if not exists quotes_client_idx on public.quotes (client_id);
create index if not exists quote_lines_quote_idx on public.quote_lines (quote_id);
create index if not exists quote_events_quote_idx on public.quote_events (quote_id, created_at desc);

drop trigger if exists quotes_set_updated_at on public.quotes;
create trigger quotes_set_updated_at
before update on public.quotes
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.quotes to anon, authenticated;
grant select, insert, update, delete on public.quote_lines to anon, authenticated;
grant select, insert, update, delete on public.quote_events to anon, authenticated;

notify pgrst, 'reload schema';
