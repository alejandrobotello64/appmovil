-- Esquema pendiente para iqfareiwiadqsauejaaf (aditivo; no borra datos).
-- Pegar TODO el archivo en:
-- https://supabase.com/dashboard/project/iqfareiwiadqsauejaaf/sql/new
-- luego Run.
--
-- Cubre: color_tag, cost_price, stock_alerts_enabled, kits,
-- marca/referencia en cotizaciones, buckets de fotos y manuales,
-- recepción agendada de OC y columnas extra de solicitudes de compra.
-- Las etiquetas rojas de Cedros ya están en notes (<!--mas-color:rojo-->);
-- este script las copia a color_tag cuando la columna exista.

begin;

-- Color de etiqueta en el catálogo.

alter table public.inventory_items
  add column if not exists color_tag text not null default '';

alter table public.inventory_items
  drop constraint if exists inventory_items_color_tag_check;

alter table public.inventory_items
  add constraint inventory_items_color_tag_check
  check (color_tag in (
    '',
    'rojo',
    'naranja',
    'amarillo',
    'verde',
    'azul',
    'morado',
    'turquesa',
    'rosa',
    'gris'
  ));

update public.inventory_items
set color_tag = substring(notes from '<!--mas-color:([a-z]+)-->')
where notes ~ '<!--mas-color:[a-z]+-->'
  and coalesce(color_tag, '') = '';

-- Costo de lista y silencio de alertas de agotado.

alter table public.inventory_items
  add column if not exists cost_price numeric(14,4) not null default 0;

alter table public.inventory_items
  add column if not exists stock_alerts_enabled boolean not null default true;

update public.inventory_items
set cost_price = substring(notes from '<!--mas-cost:([0-9]+(?:\.[0-9]+)?)-->')::numeric
where notes ~ '<!--mas-cost:[0-9]+(?:\.[0-9]+)?-->'
  and coalesce(cost_price, 0) = 0;

update public.inventory_items
set stock_alerts_enabled = false
where notes like '%<!--mas-no-stock-alert-->%'
  and stock_alerts_enabled is distinct from false;

-- Marca y n.º de parte (referencia) en partidas de cotización.

alter table public.quote_lines
  add column if not exists brand text not null default '';

alter table public.quote_lines
  add column if not exists part_number text not null default '';

update public.quote_lines ql
set
  brand = coalesce(nullif(ql.brand, ''), i.brand, ''),
  part_number = coalesce(nullif(ql.part_number, ''), i.part_number, '')
from public.inventory_items i
where ql.product_id = i.id;

update public.quote_lines
set brand = coalesce(
  nullif(brand, ''),
  replace(substring(notes from '<!--mas-qbrand:([^>]*)-->'), '%20', ' '),
  ''
)
where notes like '%<!--mas-qbrand:%';

update public.quote_lines
set part_number = coalesce(
  nullif(part_number, ''),
  replace(substring(notes from '<!--mas-qref:([^>]*)-->'), '%20', ' '),
  ''
)
where notes like '%<!--mas-qref:%';

-- Kits de servicio.

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

alter table public.supply_kits enable row level security;
alter table public.supply_kit_lines enable row level security;

drop policy if exists supply_kits_all on public.supply_kits;
create policy supply_kits_all on public.supply_kits
  for all using (true) with check (true);

drop policy if exists supply_kit_lines_all on public.supply_kit_lines;
create policy supply_kit_lines_all on public.supply_kit_lines
  for all using (true) with check (true);

-- Recepción agendada de material (calendario operativo).

alter table public.purchase_orders
  add column if not exists scheduled_receive_at date,
  add column if not exists scheduled_receive_time text not null default '',
  add column if not exists scheduled_receive_note text not null default '';

create index if not exists purchase_orders_scheduled_receive_idx
  on public.purchase_orders (scheduled_receive_at)
  where scheduled_receive_at is not null;

-- Solicitudes de compra (stub de la nube → columnas de Compras).

alter table public.purchase_requests
  add column if not exists source_type text not null default 'manual';
alter table public.purchase_requests
  add column if not exists source_id uuid;
alter table public.purchase_requests
  add column if not exists source_folio text not null default '';
alter table public.purchase_requests
  add column if not exists reason text not null default 'no_surtible';
alter table public.purchase_requests
  add column if not exists taken_by text not null default '';
alter table public.purchase_requests
  add column if not exists taken_at timestamptz;
alter table public.purchase_requests
  add column if not exists warehouse_notes text not null default '';
alter table public.purchase_requests
  add column if not exists compras_notes text not null default '';

-- No se copian notes ni quantity a las columnas nuevas: la app lee las originales.

alter table public.purchase_request_lines
  add column if not exists source_line_id uuid;
alter table public.purchase_request_lines
  add column if not exists quantity_requested numeric(14,2);
alter table public.purchase_request_lines
  add column if not exists quantity_ordered numeric(14,2) not null default 0;
alter table public.purchase_request_lines
  add column if not exists quantity_received numeric(14,2) not null default 0;

-- Manuales y documentos de catálogo (hasta 2 GB por archivo).

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit)
  values
    ('inventory-media', 'inventory-media', true, 52428800),
    ('sales-catalog', 'sales-catalog', true, 2147483648)
  on conflict (id) do update
    set public = true,
        file_size_limit = excluded.file_size_limit;
end $$;

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'inventory_media_select'
  ) then
    create policy inventory_media_select on storage.objects
      for select using (bucket_id = 'inventory-media');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'inventory_media_insert'
  ) then
    create policy inventory_media_insert on storage.objects
      for insert with check (bucket_id = 'inventory-media');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'inventory_media_update'
  ) then
    create policy inventory_media_update on storage.objects
      for update using (bucket_id = 'inventory-media');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'inventory_media_delete'
  ) then
    create policy inventory_media_delete on storage.objects
      for delete using (bucket_id = 'inventory-media');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'sales_catalog_objects_select'
  ) then
    create policy sales_catalog_objects_select on storage.objects
      for select to public using (bucket_id = 'sales-catalog');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'sales_catalog_objects_insert'
  ) then
    create policy sales_catalog_objects_insert on storage.objects
      for insert to public with check (bucket_id = 'sales-catalog');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'sales_catalog_objects_update'
  ) then
    create policy sales_catalog_objects_update on storage.objects
      for update to public using (bucket_id = 'sales-catalog');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'sales_catalog_objects_delete'
  ) then
    create policy sales_catalog_objects_delete on storage.objects
      for delete to public using (bucket_id = 'sales-catalog');
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
