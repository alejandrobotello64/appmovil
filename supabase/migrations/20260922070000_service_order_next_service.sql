-- Fecha de próximo servicio en la orden; el calendario la agenda automáticamente.

alter table public.service_orders
  add column if not exists next_service_at date;

create index if not exists service_orders_next_service_idx
  on public.service_orders (next_service_at)
  where next_service_at is not null;

notify pgrst, 'reload schema';
