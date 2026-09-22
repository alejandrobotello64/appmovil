-- Candado de orden de servicio: solo el asesor puede fijarlo.

alter table public.service_orders
  add column if not exists locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text not null default '';

create index if not exists service_orders_locked_idx
  on public.service_orders (locked)
  where locked = true;

notify pgrst, 'reload schema';
