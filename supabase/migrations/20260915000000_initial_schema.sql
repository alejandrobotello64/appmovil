-- Medical Advanced Supplies — esquema completo para despliegue en nube
-- Compatible con Supabase (PostgreSQL 15 + pgcrypto en schema extensions)

create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- Trigger helper
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- app_users
-- ============================================================
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  full_name text,
  role text not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_username_lowercase check (username = lower(username))
);

create index if not exists app_users_username_idx on public.app_users (username);

drop trigger if exists app_users_set_updated_at on public.app_users;
create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

alter table public.app_users enable row level security;

-- ============================================================
-- inventory_items
-- ============================================================
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category text not null,
  item_kind text not null default 'producto',
  description text not null default '',
  quantity integer not null default 0 check (quantity >= 0),
  min_stock integer not null default 0 check (min_stock >= 0),
  unit text not null default 'pieza',
  location text not null default '',
  brand text not null default '',
  model text not null default '',
  serial_number text not null default '',
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  supplier text not null default '',
  expiry_date date,
  notes text not null default '',
  asset_status text not null default 'operativo',
  last_maintenance_date date,
  next_maintenance_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_category_check check (
    category in ('insumos','refacciones','medicamentos','accesorios','equipos','reactivos','otros')
  ),
  constraint inventory_items_item_kind_check check (item_kind in ('producto', 'equipo')),
  constraint inventory_items_asset_status_check check (
    asset_status in ('operativo', 'mantenimiento', 'fuera_servicio', 'baja')
  )
);

create index if not exists inventory_items_category_idx on public.inventory_items (category);
create index if not exists inventory_items_name_idx on public.inventory_items (name);

drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

alter table public.inventory_items enable row level security;

drop policy if exists "inventory_select_all" on public.inventory_items;
drop policy if exists "inventory_insert_all" on public.inventory_items;
drop policy if exists "inventory_update_all" on public.inventory_items;
drop policy if exists "inventory_delete_all" on public.inventory_items;

create policy "inventory_select_all" on public.inventory_items for select to anon, authenticated using (true);
create policy "inventory_insert_all" on public.inventory_items for insert to anon, authenticated with check (true);
create policy "inventory_update_all" on public.inventory_items for update to anon, authenticated using (true) with check (true);
create policy "inventory_delete_all" on public.inventory_items for delete to anon, authenticated using (true);

-- ============================================================
-- suppliers
-- ============================================================
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  rfc text not null default '',
  address text not null default '',
  city text not null default '',
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suppliers_name_idx on public.suppliers (name);

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;

drop policy if exists "suppliers_select_all" on public.suppliers;
drop policy if exists "suppliers_insert_all" on public.suppliers;
drop policy if exists "suppliers_update_all" on public.suppliers;
drop policy if exists "suppliers_delete_all" on public.suppliers;

create policy "suppliers_select_all" on public.suppliers for select to anon, authenticated using (true);
create policy "suppliers_insert_all" on public.suppliers for insert to anon, authenticated with check (true);
create policy "suppliers_update_all" on public.suppliers for update to anon, authenticated using (true) with check (true);
create policy "suppliers_delete_all" on public.suppliers for delete to anon, authenticated using (true);

-- ============================================================
-- warehouse_movements
-- ============================================================
create table if not exists public.warehouse_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.inventory_items(id) on delete set null,
  item_sku text not null default '',
  item_name text not null default '',
  movement_type text not null check (
    movement_type in ('entrada', 'salida', 'cambio_ubicacion', 'canje_caducado')
  ),
  quantity integer not null check (quantity > 0),
  previous_quantity integer not null default 0,
  new_quantity integer not null default 0,
  note text not null default '',
  created_by text not null default '',
  from_location text not null default '',
  to_location text not null default '',
  supplier_name text not null default '',
  previous_expiry date,
  new_expiry date,
  created_at timestamptz not null default now()
);

create index if not exists warehouse_movements_created_at_idx
  on public.warehouse_movements (created_at desc);

alter table public.warehouse_movements enable row level security;

drop policy if exists "movements_select_all" on public.warehouse_movements;
drop policy if exists "movements_insert_all" on public.warehouse_movements;

create policy "movements_select_all" on public.warehouse_movements for select to anon, authenticated using (true);
create policy "movements_insert_all" on public.warehouse_movements for insert to anon, authenticated with check (true);

-- ============================================================
-- purchase_orders + items
-- ============================================================
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text not null default '',
  status text not null default 'borrador'
    check (status in ('borrador', 'enviado', 'parcial', 'recibido', 'cancelado')),
  expected_date date,
  notes text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.purchase_orders(id) on delete cascade,
  item_id uuid references public.inventory_items(id) on delete set null,
  item_sku text not null default '',
  item_name text not null,
  quantity integer not null check (quantity > 0),
  received_quantity integer not null default 0 check (received_quantity >= 0),
  unit_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists purchase_orders_status_idx on public.purchase_orders (status);
create index if not exists purchase_order_items_order_idx on public.purchase_order_items (order_id);

drop trigger if exists purchase_orders_set_updated_at on public.purchase_orders;
create trigger purchase_orders_set_updated_at
before update on public.purchase_orders
for each row execute function public.set_updated_at();

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

drop policy if exists "po_select" on public.purchase_orders;
drop policy if exists "po_insert" on public.purchase_orders;
drop policy if exists "po_update" on public.purchase_orders;
drop policy if exists "po_delete" on public.purchase_orders;
drop policy if exists "poi_select" on public.purchase_order_items;
drop policy if exists "poi_insert" on public.purchase_order_items;
drop policy if exists "poi_update" on public.purchase_order_items;
drop policy if exists "poi_delete" on public.purchase_order_items;

create policy "po_select" on public.purchase_orders for select to anon, authenticated using (true);
create policy "po_insert" on public.purchase_orders for insert to anon, authenticated with check (true);
create policy "po_update" on public.purchase_orders for update to anon, authenticated using (true) with check (true);
create policy "po_delete" on public.purchase_orders for delete to anon, authenticated using (true);

create policy "poi_select" on public.purchase_order_items for select to anon, authenticated using (true);
create policy "poi_insert" on public.purchase_order_items for insert to anon, authenticated with check (true);
create policy "poi_update" on public.purchase_order_items for update to anon, authenticated using (true) with check (true);
create policy "poi_delete" on public.purchase_order_items for delete to anon, authenticated using (true);

-- ============================================================
-- equipment_maintenances
-- ============================================================
create table if not exists public.equipment_maintenances (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.inventory_items(id) on delete cascade,
  maintenance_type text not null default 'preventivo'
    check (maintenance_type in ('preventivo', 'correctivo', 'calibracion')),
  status text not null default 'programado'
    check (status in ('programado', 'en_proceso', 'completado', 'cancelado')),
  scheduled_date date not null,
  completed_date date,
  technician text not null default '',
  cost numeric(12,2) not null default 0,
  notes text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipment_maintenances_equipment_idx on public.equipment_maintenances (equipment_id);
create index if not exists equipment_maintenances_status_idx on public.equipment_maintenances (status);

drop trigger if exists equipment_maintenances_set_updated_at on public.equipment_maintenances;
create trigger equipment_maintenances_set_updated_at
before update on public.equipment_maintenances
for each row execute function public.set_updated_at();

alter table public.equipment_maintenances enable row level security;

drop policy if exists "em_select" on public.equipment_maintenances;
drop policy if exists "em_insert" on public.equipment_maintenances;
drop policy if exists "em_update" on public.equipment_maintenances;
drop policy if exists "em_delete" on public.equipment_maintenances;

create policy "em_select" on public.equipment_maintenances for select to anon, authenticated using (true);
create policy "em_insert" on public.equipment_maintenances for insert to anon, authenticated with check (true);
create policy "em_update" on public.equipment_maintenances for update to anon, authenticated using (true) with check (true);
create policy "em_delete" on public.equipment_maintenances for delete to anon, authenticated using (true);

-- ============================================================
-- RPCs
-- ============================================================
create or replace function public.authenticate_user(p_username text, p_password text)
returns table (id uuid, username text, full_name text, role text)
language plpgsql security definer set search_path = public, extensions
as $$
begin
  return query
  select u.id, u.username, u.full_name, u.role
  from public.app_users u
  where u.username = lower(trim(p_username))
    and u.is_active = true
    and u.password_hash = extensions.crypt(p_password, u.password_hash);
end;
$$;

revoke all on function public.authenticate_user(text, text) from public;
grant execute on function public.authenticate_user(text, text) to anon, authenticated;

create or replace function public.list_app_users()
returns table (id uuid, username text, full_name text, role text, is_active boolean, created_at timestamptz)
language sql security definer set search_path = public
as $$
  select u.id, u.username, u.full_name, u.role, u.is_active, u.created_at
  from public.app_users u
  order by u.created_at desc;
$$;

revoke all on function public.list_app_users() from public;
grant execute on function public.list_app_users() to anon, authenticated;

create or replace function public.create_app_user(
  p_username text, p_password text, p_full_name text default null, p_role text default 'operador'
)
returns table (id uuid, username text, full_name text, role text, is_active boolean)
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_username text := lower(trim(p_username));
begin
  if v_username is null or v_username = '' then
    raise exception 'El usuario es obligatorio';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'La contraseña debe tener al menos 6 caracteres';
  end if;
  return query
  insert into public.app_users (username, password_hash, full_name, role, is_active)
  values (
    v_username,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    nullif(trim(p_full_name), ''),
    coalesce(nullif(trim(p_role), ''), 'operador'),
    true
  )
  returning app_users.id, app_users.username, app_users.full_name, app_users.role, app_users.is_active;
end;
$$;

revoke all on function public.create_app_user(text, text, text, text) from public;
grant execute on function public.create_app_user(text, text, text, text) to anon, authenticated;
