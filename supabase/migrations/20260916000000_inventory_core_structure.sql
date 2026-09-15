-- MAS inventory structure adapted onto the existing app.
-- Keeps inventory_items, suppliers, purchase_orders, warehouse_movements.
-- Adds warehouses, locations, lots, serials, balances, kardex and stock RPCs.

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  city text not null default '',
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  code text not null,
  name text not null,
  parent_id uuid references public.locations(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (warehouse_id, code)
);

create table if not exists public.inventory_settings (
  id integer primary key default 1,
  expiry_alert_days integer[] not null default array[180, 90, 60, 30],
  default_warehouse_id uuid references public.warehouses(id),
  constraint inventory_settings_singleton check (id = 1)
);

create table if not exists public.document_sequences (
  doc_type text not null,
  year integer not null,
  last_value integer not null default 0,
  primary key (doc_type, year)
);

alter table public.inventory_items
  add column if not exists is_active boolean not null default true,
  add column if not exists tracks_lot boolean not null default false,
  add column if not exists tracks_serial boolean not null default false,
  add column if not exists tracks_expiry boolean not null default false,
  add column if not exists max_stock integer not null default 0,
  add column if not exists reorder_point integer not null default 0,
  add column if not exists part_number text not null default '',
  add column if not exists manufacturer text not null default '',
  add column if not exists subcategory text not null default '';

update public.inventory_items
set
  tracks_serial = case when item_kind = 'equipo' or coalesce(serial_number, '') <> '' then true else tracks_serial end,
  tracks_expiry = case
    when category = 'medicamentos' or expiry_date is not null then true
    else tracks_expiry
  end,
  tracks_lot = case
    when category in ('medicamentos', 'insumos', 'reactivos') or expiry_date is not null then true
    else tracks_lot
  end,
  reorder_point = case when reorder_point = 0 then min_stock else reorder_point end
where true;

create table if not exists public.lots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.inventory_items(id) on delete cascade,
  lot_number text not null,
  manufactured_at date,
  expiry_date date,
  created_at timestamptz not null default now(),
  unique (product_id, lot_number)
);

create table if not exists public.serial_numbers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.inventory_items(id) on delete cascade,
  serial_number text not null unique,
  inventory_number text not null default '',
  status text not null default 'disponible'
    check (status in (
      'disponible', 'reservado', 'en_transito', 'instalado',
      'en_servicio', 'en_reparacion', 'baja'
    )),
  warehouse_id uuid references public.warehouses(id),
  location_id uuid references public.locations(id),
  warranty_start date,
  warranty_end date,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.inventory_items(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id),
  location_id uuid not null references public.locations(id),
  lot_id uuid references public.lots(id) on delete set null,
  qty_on_hand integer not null default 0 check (qty_on_hand >= 0),
  qty_reserved integer not null default 0 check (qty_reserved >= 0),
  qty_in_transit integer not null default 0 check (qty_in_transit >= 0),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (product_id, warehouse_id, location_id, lot_id)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  folio text not null,
  movement_type text not null check (
    movement_type in (
      'entrada', 'salida', 'traspaso', 'devolucion', 'ajuste',
      'cambio_ubicacion', 'canje_caducado'
    )
  ),
  document_type text not null default '',
  product_id uuid references public.inventory_items(id) on delete set null,
  product_sku text not null default '',
  product_name text not null default '',
  warehouse_id uuid references public.warehouses(id),
  location_id uuid references public.locations(id),
  from_warehouse_id uuid references public.warehouses(id),
  to_warehouse_id uuid references public.warehouses(id),
  from_location_id uuid references public.locations(id),
  to_location_id uuid references public.locations(id),
  lot_id uuid references public.lots(id) on delete set null,
  serial_id uuid references public.serial_numbers(id) on delete set null,
  qty_in integer not null default 0 check (qty_in >= 0),
  qty_out integer not null default 0 check (qty_out >= 0),
  resulting_qty integer not null default 0,
  unit_cost numeric(12, 2) not null default 0,
  reason text not null default '',
  note text not null default '',
  created_by text not null default '',
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  related_serial text not null default '',
  related_technician text not null default '',
  constraint inventory_movements_qty_xor check (qty_in > 0 or qty_out > 0)
);

create index if not exists inventory_movements_product_idx
  on public.inventory_movements (product_id, occurred_at);
create index if not exists inventory_movements_folio_idx
  on public.inventory_movements (folio);

create table if not exists public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  status text not null default 'recibido'
    check (status in ('borrador', 'solicitado', 'autorizado', 'en_transito', 'recibido', 'cancelado')),
  from_warehouse_id uuid not null references public.warehouses(id),
  to_warehouse_id uuid not null references public.warehouses(id),
  from_location_id uuid references public.locations(id),
  to_location_id uuid references public.locations(id),
  notes text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  username text not null default '',
  action text not null,
  module text not null default 'almacen',
  document_folio text not null default '',
  record_id text not null default '',
  previous_value text not null default '',
  new_value text not null default ''
);

alter table public.warehouses enable row level security;
alter table public.locations enable row level security;
alter table public.lots enable row level security;
alter table public.serial_numbers enable row level security;
alter table public.inventory_balances enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.inventory_settings enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists warehouses_all on public.warehouses;
create policy warehouses_all on public.warehouses for all to anon, authenticated using (true) with check (true);
drop policy if exists locations_all on public.locations;
create policy locations_all on public.locations for all to anon, authenticated using (true) with check (true);
drop policy if exists lots_all on public.lots;
create policy lots_all on public.lots for all to anon, authenticated using (true) with check (true);
drop policy if exists serials_all on public.serial_numbers;
create policy serials_all on public.serial_numbers for all to anon, authenticated using (true) with check (true);
drop policy if exists balances_all on public.inventory_balances;
create policy balances_all on public.inventory_balances for all to anon, authenticated using (true) with check (true);
drop policy if exists kardex_select on public.inventory_movements;
create policy kardex_select on public.inventory_movements for select to anon, authenticated using (true);
drop policy if exists kardex_insert on public.inventory_movements;
create policy kardex_insert on public.inventory_movements for insert to anon, authenticated with check (true);
drop policy if exists transfers_all on public.stock_transfers;
create policy transfers_all on public.stock_transfers for all to anon, authenticated using (true) with check (true);
drop policy if exists settings_all on public.inventory_settings;
create policy settings_all on public.inventory_settings for all to anon, authenticated using (true) with check (true);
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select to anon, authenticated using (true);
drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs for insert to anon, authenticated with check (true);

insert into public.warehouses (code, name, city, is_default)
values
  ('VSA', 'Almacén Villahermosa', 'Villahermosa', true),
  ('CUN', 'Almacén Cancún', 'Cancún', false),
  ('PUE', 'Almacén Puebla', 'Puebla', false),
  ('CDMX', 'Almacén CDMX', 'Ciudad de México', false)
on conflict (code) do nothing;

insert into public.locations (warehouse_id, code, name)
select w.id, loc.code, loc.name
from public.warehouses w
cross join (
  values
    ('GENERAL', 'General'),
    ('INSUMOS', 'Insumos'),
    ('MEDICAMENTOS', 'Medicamentos'),
    ('REFACCIONES', 'Refacciones'),
    ('ACCESORIOS', 'Accesorios'),
    ('EQUIPOS', 'Equipos médicos')
) as loc(code, name)
on conflict (warehouse_id, code) do nothing;

insert into public.inventory_settings (id, default_warehouse_id)
select 1, w.id from public.warehouses w where w.is_default
on conflict (id) do update set default_warehouse_id = excluded.default_warehouse_id;

create or replace function public.next_document_folio(p_doc_type text)
returns text
language plpgsql
as $$
declare
  v_year integer := extract(year from now())::integer;
  v_next integer;
begin
  insert into public.document_sequences (doc_type, year, last_value)
  values (upper(p_doc_type), v_year, 1)
  on conflict (doc_type, year)
  do update set last_value = public.document_sequences.last_value + 1
  returning last_value into v_next;

  return upper(p_doc_type) || '-' || v_year::text || '-' || lpad(v_next::text, 6, '0');
end;
$$;

create or replace function public.sync_item_quantity(p_product_id uuid)
returns integer
language plpgsql
as $$
declare
  v_qty integer;
begin
  select coalesce(sum(qty_on_hand), 0) into v_qty
  from public.inventory_balances
  where product_id = p_product_id;

  perform set_config('mas.allow_qty', '1', true);
  update public.inventory_items
  set quantity = v_qty
  where id = p_product_id;

  return v_qty;
end;
$$;

create or replace function public.protect_item_quantity()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
    and new.quantity is distinct from old.quantity
    and current_setting('mas.allow_qty', true) is distinct from '1'
  then
    raise exception 'La existencia no se edita directo. Usa una entrada, salida, traspaso o ajuste.';
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_items_protect_quantity on public.inventory_items;
create trigger inventory_items_protect_quantity
before update on public.inventory_items
for each row execute function public.protect_item_quantity();

create or replace function public.touch_balance()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inventory_balances_touch on public.inventory_balances;
create trigger inventory_balances_touch
before update on public.inventory_balances
for each row execute function public.touch_balance();

create or replace function public.apply_stock_movement(
  p_product_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_note text default '',
  p_created_by text default '',
  p_reason text default '',
  p_warehouse_id uuid default null,
  p_location_id uuid default null,
  p_lot_number text default null,
  p_expiry_date date default null,
  p_serial_number text default null,
  p_supplier_name text default '',
  p_purchase_order_id uuid default null
)
returns table (
  folio text,
  movement_id uuid,
  new_quantity integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.inventory_items%rowtype;
  v_warehouse_id uuid;
  v_location_id uuid;
  v_lot_id uuid;
  v_serial_id uuid;
  v_folio text;
  v_prefix text;
  v_balance integer := 0;
  v_qty_in integer := 0;
  v_qty_out integer := 0;
  v_new_qty integer := 0;
  v_movement_id uuid;
  v_from_loc text := '';
  v_to_loc text := '';
  v_compat_type text;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;
  if coalesce(p_created_by, '') = '' then
    raise exception 'El movimiento requiere un usuario responsable';
  end if;

  select * into v_item from public.inventory_items where id = p_product_id;
  if not found then
    raise exception 'Producto no encontrado';
  end if;
  if v_item.is_active is false then
    raise exception 'El producto está inactivo';
  end if;

  v_warehouse_id := p_warehouse_id;
  if v_warehouse_id is null then
    select default_warehouse_id into v_warehouse_id from public.inventory_settings where id = 1;
  end if;
  if v_warehouse_id is null then
    select id into v_warehouse_id from public.warehouses where is_default limit 1;
  end if;

  v_location_id := p_location_id;
  if v_location_id is null then
    select id into v_location_id
    from public.locations
    where warehouse_id = v_warehouse_id
      and code = case
        when v_item.category = 'medicamentos' then 'MEDICAMENTOS'
        when v_item.category = 'insumos' then 'INSUMOS'
        when v_item.category = 'refacciones' then 'REFACCIONES'
        when v_item.category = 'accesorios' then 'ACCESORIOS'
        when v_item.item_kind = 'equipo' then 'EQUIPOS'
        else 'GENERAL'
      end
    limit 1;
  end if;
  if v_location_id is null then
    select id into v_location_id
    from public.locations
    where warehouse_id = v_warehouse_id and code = 'GENERAL'
    limit 1;
  end if;

  if p_movement_type in ('entrada', 'devolucion', 'ajuste_sobrante') then
    v_qty_in := p_quantity;
    v_prefix := case p_movement_type
      when 'devolucion' then 'DEV'
      else 'EM'
    end;
  elsif p_movement_type = 'canje_caducado' then
    v_qty_in := p_quantity;
    v_qty_out := p_quantity;
    v_prefix := 'CNJ';
  elsif p_movement_type in ('salida', 'ajuste_faltante') then
    v_qty_out := p_quantity;
    v_prefix := case p_movement_type when 'salida' then 'SAL' else 'AJ' end;
  else
    raise exception 'Tipo de movimiento no válido: %', p_movement_type;
  end if;

  if p_movement_type = 'salida'
    and v_item.category = 'medicamentos'
    and v_item.expiry_date is not null
    and v_item.expiry_date < current_date
    and coalesce(p_lot_number, '') = ''
  then
    raise exception 'No se puede dar salida normal a un medicamento caducado. Usa un canje o baja.';
  end if;

  if coalesce(p_lot_number, '') <> '' or p_expiry_date is not null then
    insert into public.lots (product_id, lot_number, expiry_date)
    values (
      v_item.id,
      coalesce(nullif(trim(p_lot_number), ''), 'LOTE-' || to_char(now(), 'YYYYMMDD')),
      p_expiry_date
    )
    on conflict (product_id, lot_number)
    do update set expiry_date = coalesce(excluded.expiry_date, public.lots.expiry_date)
    returning id into v_lot_id;
  elsif v_qty_out > 0 and v_item.tracks_lot then
    select l.id into v_lot_id
    from public.lots l
    join public.inventory_balances b on b.lot_id = l.id
    where l.product_id = v_item.id
      and b.qty_on_hand > 0
      and (l.expiry_date is null or l.expiry_date >= current_date)
    order by l.expiry_date nulls last, l.created_at
    limit 1;
  end if;

  if p_movement_type = 'salida'
    and v_item.category = 'medicamentos'
    and v_lot_id is not null
  then
    if exists (
      select 1 from public.lots
      where id = v_lot_id and expiry_date is not null and expiry_date < current_date
    ) then
      raise exception 'No se puede dar salida normal a un lote caducado.';
    end if;
  end if;

  if coalesce(p_serial_number, '') <> '' then
    insert into public.serial_numbers (product_id, serial_number, warehouse_id, location_id, status)
    values (
      v_item.id,
      trim(p_serial_number),
      v_warehouse_id,
      v_location_id,
      case when v_qty_out > 0 then 'en_servicio' else 'disponible' end
    )
    on conflict (serial_number) do update
      set warehouse_id = excluded.warehouse_id,
          location_id = excluded.location_id
    returning id into v_serial_id;
  end if;

  insert into public.inventory_balances (
    product_id, warehouse_id, location_id, lot_id, qty_on_hand
  )
  values (v_item.id, v_warehouse_id, v_location_id, v_lot_id, 0)
  on conflict (product_id, warehouse_id, location_id, lot_id)
  do nothing;

  select qty_on_hand into v_balance
  from public.inventory_balances
  where product_id = v_item.id
    and warehouse_id = v_warehouse_id
    and location_id = v_location_id
    and lot_id is not distinct from v_lot_id
  for update;

  if v_qty_out > v_balance then
    raise exception 'No hay existencia disponible (%). Solicitado: %', v_balance, v_qty_out;
  end if;

  update public.inventory_balances
  set qty_on_hand = qty_on_hand + v_qty_in - v_qty_out
  where product_id = v_item.id
    and warehouse_id = v_warehouse_id
    and location_id = v_location_id
    and lot_id is not distinct from v_lot_id;

  v_new_qty := public.sync_item_quantity(v_item.id);

  if p_expiry_date is not null then
    perform set_config('mas.allow_qty', '1', true);
    update public.inventory_items
    set expiry_date = p_expiry_date,
        supplier = case when coalesce(p_supplier_name, '') <> '' then p_supplier_name else supplier end
    where id = v_item.id;
  elsif coalesce(p_supplier_name, '') <> '' then
    update public.inventory_items
    set supplier = p_supplier_name
    where id = v_item.id;
  end if;

  select name into v_to_loc from public.locations where id = v_location_id;
  v_from_loc := coalesce(v_item.location, '');

  v_folio := public.next_document_folio(v_prefix);
  v_compat_type := case
    when p_movement_type in ('entrada', 'devolucion') then 'entrada'
    when p_movement_type = 'canje_caducado' then 'canje_caducado'
    when p_movement_type like 'ajuste%' then 'entrada'
    else 'salida'
  end;
  if p_movement_type = 'ajuste_faltante' then
    v_compat_type := 'salida';
  end if;

  insert into public.inventory_movements (
    folio, movement_type, document_type, product_id, product_sku, product_name,
    warehouse_id, location_id, lot_id, serial_id, qty_in, qty_out, resulting_qty,
    unit_cost, reason, note, created_by, purchase_order_id
  ) values (
    v_folio,
    case
      when p_movement_type in ('ajuste_sobrante', 'ajuste_faltante') then 'ajuste'
      else p_movement_type
    end,
    v_prefix,
    v_item.id, v_item.sku, v_item.name,
    v_warehouse_id, v_location_id, v_lot_id, v_serial_id,
    v_qty_in, v_qty_out, v_new_qty,
    v_item.unit_price, coalesce(p_reason, ''), coalesce(p_note, ''),
    p_created_by, p_purchase_order_id
  )
  returning id into v_movement_id;

  insert into public.warehouse_movements (
    item_id, item_sku, item_name, movement_type, quantity,
    previous_quantity, new_quantity, note, created_by,
    from_location, to_location, supplier_name, previous_expiry, new_expiry
  ) values (
    v_item.id, v_item.sku, v_item.name, v_compat_type, p_quantity,
    v_new_qty - v_qty_in + v_qty_out, v_new_qty, coalesce(p_note, ''),
    p_created_by, v_from_loc, coalesce(v_to_loc, ''), p_supplier_name,
    v_item.expiry_date, coalesce(p_expiry_date, v_item.expiry_date)
  );

  insert into public.audit_logs (
    username, action, module, document_folio, record_id, previous_value, new_value
  ) values (
    p_created_by, p_movement_type, 'almacen', v_folio, v_item.id::text,
    (v_new_qty - v_qty_in + v_qty_out)::text, v_new_qty::text
  );

  folio := v_folio;
  movement_id := v_movement_id;
  new_quantity := v_new_qty;
  return next;
end;
$$;

create or replace function public.transfer_stock(
  p_product_id uuid,
  p_quantity integer,
  p_to_location_name text,
  p_note text default '',
  p_created_by text default '',
  p_from_location_id uuid default null,
  p_to_warehouse_id uuid default null
)
returns table (
  folio text,
  movement_id uuid,
  new_quantity integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.inventory_items%rowtype;
  v_from_wh uuid;
  v_to_wh uuid;
  v_from_loc uuid;
  v_to_loc uuid;
  v_from_name text;
  v_to_name text;
  v_folio text;
  v_balance integer := 0;
  v_qty integer;
  v_movement_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;
  if coalesce(p_created_by, '') = '' then
    raise exception 'El traspaso requiere un usuario responsable';
  end if;

  select * into v_item from public.inventory_items where id = p_product_id;
  if not found then
    raise exception 'Producto no encontrado';
  end if;

  select default_warehouse_id into v_from_wh from public.inventory_settings where id = 1;
  v_to_wh := coalesce(p_to_warehouse_id, v_from_wh);

  v_from_loc := p_from_location_id;
  if v_from_loc is null then
    select location_id into v_from_loc
    from public.inventory_balances
    where product_id = p_product_id and qty_on_hand > 0
    order by qty_on_hand desc
    limit 1;
  end if;
  if v_from_loc is null then
    raise exception 'No hay existencia para traspasar';
  end if;

  select l.id, l.name, l.warehouse_id
  into v_to_loc, v_to_name, v_to_wh
  from public.locations l
  where l.warehouse_id = v_to_wh
    and (lower(l.name) = lower(trim(p_to_location_name)) or lower(l.code) = lower(trim(p_to_location_name)))
  limit 1;

  if v_to_loc is null then
    insert into public.locations (warehouse_id, code, name)
    values (
      v_to_wh,
      left(regexp_replace(upper(trim(p_to_location_name)), '[^A-Z0-9]+', '-', 'g'), 24),
      trim(p_to_location_name)
    )
    returning id, name into v_to_loc, v_to_name;
  end if;

  if v_from_loc = v_to_loc then
    raise exception 'La ubicación destino es la misma que el origen';
  end if;

  select name into v_from_name from public.locations where id = v_from_loc;

  select qty_on_hand into v_balance
  from public.inventory_balances
  where product_id = p_product_id and location_id = v_from_loc
  order by qty_on_hand desc
  limit 1
  for update;

  v_qty := least(p_quantity, coalesce(v_balance, 0));
  if v_item.item_kind <> 'equipo' and v_qty < p_quantity then
    -- allow moving displayed qty even if split across lots: take requested if total enough
    select coalesce(sum(qty_on_hand), 0) into v_balance
    from public.inventory_balances
    where product_id = p_product_id;
    if p_quantity > v_balance then
      raise exception 'No hay existencia suficiente para el traspaso';
    end if;
    v_qty := p_quantity;
  end if;

  update public.inventory_balances
  set qty_on_hand = qty_on_hand - p_quantity
  where id = (
    select id from public.inventory_balances
    where product_id = p_product_id and location_id = v_from_loc and qty_on_hand >= p_quantity
    order by qty_on_hand desc
    limit 1
  );
  if not found then
    raise exception 'No hay existencia suficiente en la ubicación origen';
  end if;

  insert into public.inventory_balances (product_id, warehouse_id, location_id, qty_on_hand)
  values (p_product_id, v_to_wh, v_to_loc, p_quantity)
  on conflict (product_id, warehouse_id, location_id, lot_id)
  do update set qty_on_hand = public.inventory_balances.qty_on_hand + excluded.qty_on_hand;

  perform public.sync_item_quantity(p_product_id);
  update public.inventory_items set location = v_to_name where id = p_product_id;

  v_folio := public.next_document_folio('TR');

  insert into public.stock_transfers (
    folio, status, from_warehouse_id, to_warehouse_id, from_location_id, to_location_id, notes, created_by
  ) values (
    v_folio, 'recibido', v_from_wh, v_to_wh, v_from_loc, v_to_loc, coalesce(p_note, ''), p_created_by
  );

  insert into public.inventory_movements (
    folio, movement_type, document_type, product_id, product_sku, product_name,
    from_warehouse_id, to_warehouse_id, from_location_id, to_location_id,
    qty_in, qty_out, resulting_qty, unit_cost, note, created_by
  ) values (
    v_folio, 'traspaso', 'TR', p_product_id, v_item.sku, v_item.name,
    v_from_wh, v_to_wh, v_from_loc, v_to_loc,
    p_quantity, p_quantity, v_item.quantity, v_item.unit_price, coalesce(p_note, ''), p_created_by
  )
  returning id into v_movement_id;

  insert into public.warehouse_movements (
    item_id, item_sku, item_name, movement_type, quantity,
    previous_quantity, new_quantity, note, created_by, from_location, to_location
  ) values (
    p_product_id, v_item.sku, v_item.name, 'cambio_ubicacion', p_quantity,
    v_item.quantity, v_item.quantity, coalesce(p_note, ''), p_created_by,
    coalesce(v_from_name, ''), coalesce(v_to_name, '')
  );

  insert into public.audit_logs (username, action, module, document_folio, record_id, new_value)
  values (p_created_by, 'traspaso', 'almacen', v_folio, p_product_id::text, v_from_name || ' → ' || v_to_name);

  folio := v_folio;
  movement_id := v_movement_id;
  new_quantity := v_item.quantity;
  return next;
end;
$$;

create or replace function public.deactivate_product(p_product_id uuid, p_created_by text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.inventory_items set is_active = false where id = p_product_id;
  insert into public.audit_logs (username, action, module, record_id)
  values (coalesce(p_created_by, ''), 'desactivar', 'productos', p_product_id::text);
end;
$$;

grant execute on function public.next_document_folio(text) to anon, authenticated;
grant execute on function public.sync_item_quantity(uuid) to anon, authenticated;
grant execute on function public.apply_stock_movement(uuid, text, integer, text, text, text, uuid, uuid, text, date, text, text, uuid) to anon, authenticated;
grant execute on function public.transfer_stock(uuid, integer, text, text, text, uuid, uuid) to anon, authenticated;
grant execute on function public.deactivate_product(uuid, text) to anon, authenticated;

-- Seed balances and kardex from current inventory_items without wiping data.
do $$
declare
  r public.inventory_items%rowtype;
  v_wh uuid;
  v_loc uuid;
  v_lot uuid;
begin
  select default_warehouse_id into v_wh from public.inventory_settings where id = 1;

  for r in select * from public.inventory_items loop
    select l.id into v_loc
    from public.locations l
    where l.warehouse_id = v_wh
      and l.code = case
        when r.category = 'medicamentos' then 'MEDICAMENTOS'
        when r.category = 'insumos' then 'INSUMOS'
        when r.category = 'refacciones' then 'REFACCIONES'
        when r.category = 'accesorios' then 'ACCESORIOS'
        when r.item_kind = 'equipo' then 'EQUIPOS'
        else 'GENERAL'
      end
    limit 1;

    v_lot := null;
    if r.expiry_date is not null then
      insert into public.lots (product_id, lot_number, expiry_date)
      values (r.id, coalesce(nullif(r.serial_number, ''), 'INICIAL'), r.expiry_date)
      on conflict (product_id, lot_number) do update set expiry_date = excluded.expiry_date
      returning id into v_lot;
    end if;

    if coalesce(r.serial_number, '') <> '' and r.item_kind = 'equipo' then
      insert into public.serial_numbers (product_id, serial_number, warehouse_id, location_id, status)
      values (r.id, r.serial_number, v_wh, v_loc, 'disponible')
      on conflict (serial_number) do nothing;
    end if;

    insert into public.inventory_balances (product_id, warehouse_id, location_id, lot_id, qty_on_hand)
    values (r.id, v_wh, v_loc, v_lot, r.quantity)
    on conflict (product_id, warehouse_id, location_id, lot_id)
    do update set qty_on_hand = excluded.qty_on_hand;

    if r.location is null or r.location = '' then
      update public.inventory_items i
      set location = loc.name
      from public.locations loc
      where i.id = r.id and loc.id = v_loc;
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
