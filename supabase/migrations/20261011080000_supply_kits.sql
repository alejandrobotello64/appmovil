-- Catálogo de kits: insumos típicos reutilizables en órdenes de servicio.

create table if not exists public.supply_kits (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  service_type text not null default ''
    check (service_type in (
      '',
      'diagnostico',
      'preventivo',
      'correctivo',
      'instalacion'
    )),
  equipment_kind text not null default '',
  is_active boolean not null default true,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supply_kit_lines (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references public.supply_kits(id) on delete cascade,
  product_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric(14,2) not null check (quantity > 0),
  sort_order integer not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (kit_id, product_id)
);

create index if not exists supply_kits_active_idx
  on public.supply_kits (is_active, service_type, name);
create index if not exists supply_kit_lines_kit_idx
  on public.supply_kit_lines (kit_id, sort_order);

drop trigger if exists supply_kits_set_updated_at on public.supply_kits;
create trigger supply_kits_set_updated_at
before update on public.supply_kits
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.supply_kits to anon, authenticated;
grant select, insert, update, delete on public.supply_kit_lines to anon, authenticated;

notify pgrst, 'reload schema';
