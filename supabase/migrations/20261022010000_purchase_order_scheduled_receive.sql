-- Cita de recepción de material: almacén agenda cuándo llega el pedido
-- y el calendario operativo la muestra (independiente de expected_date del proveedor).

alter table public.purchase_orders
  add column if not exists scheduled_receive_at date,
  add column if not exists scheduled_receive_time text not null default '',
  add column if not exists scheduled_receive_note text not null default '';

create index if not exists purchase_orders_scheduled_receive_idx
  on public.purchase_orders (scheduled_receive_at)
  where scheduled_receive_at is not null;

notify pgrst, 'reload schema';
