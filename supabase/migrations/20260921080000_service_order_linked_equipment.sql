-- Equipos ligados a una orden de servicio (ej. monitor ↔ máquina de anestesia)

create table if not exists public.service_order_linked_equipment (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  equipment_id uuid references public.client_equipment(id) on delete set null,
  equipment_name text not null default '',
  equipment_brand text not null default '',
  equipment_model text not null default '',
  equipment_serial text not null default '',
  equipment_location text not null default '',
  relation_label text not null default 'Equipo ligado',
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists service_order_linked_equipment_order_idx
  on public.service_order_linked_equipment (service_order_id, sort_order);

create unique index if not exists service_order_linked_equipment_unique_eq
  on public.service_order_linked_equipment (service_order_id, equipment_id)
  where equipment_id is not null;

grant select, insert, update, delete on public.service_order_linked_equipment to anon, authenticated;
