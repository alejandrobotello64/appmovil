-- Apartados de inventario para proyectos en puerta.

create table if not exists public.inventory_holds (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  project_name text not null,
  client_name text not null default '',
  needed_by date,
  status text not null default 'activo'
    check (status in ('activo', 'liberado', 'entregado', 'cancelado')),
  notes text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_hold_lines (
  id uuid primary key default gen_random_uuid(),
  hold_id uuid not null references public.inventory_holds(id) on delete cascade,
  product_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists inventory_holds_status_idx
  on public.inventory_holds (status, created_at desc);

create index if not exists inventory_hold_lines_hold_idx
  on public.inventory_hold_lines (hold_id);

create index if not exists inventory_hold_lines_product_idx
  on public.inventory_hold_lines (product_id);

drop trigger if exists inventory_holds_set_updated_at on public.inventory_holds;
create trigger inventory_holds_set_updated_at
before update on public.inventory_holds
for each row execute function public.set_updated_at();

create or replace function public.product_reserved_qty(p_product_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(l.quantity), 0)::integer
  from public.inventory_hold_lines l
  join public.inventory_holds h on h.id = l.hold_id
  where l.product_id = p_product_id
    and h.status = 'activo';
$$;

create or replace function public.product_available_qty(p_product_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    coalesce((select quantity from public.inventory_items where id = p_product_id), 0)
      - public.product_reserved_qty(p_product_id),
    0
  )::integer;
$$;

revoke all on function public.product_reserved_qty(uuid) from public;
revoke all on function public.product_available_qty(uuid) from public;
grant execute on function public.product_reserved_qty(uuid) to anon, authenticated;
grant execute on function public.product_available_qty(uuid) to anon, authenticated;

grant select, insert, update, delete on public.inventory_holds to anon, authenticated;
grant select, insert, update, delete on public.inventory_hold_lines to anon, authenticated;

notify pgrst, 'reload schema';
