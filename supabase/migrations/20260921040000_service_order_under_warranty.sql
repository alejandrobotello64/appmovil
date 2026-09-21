-- Marcar órdenes de servicio cubiertas por garantía
alter table public.service_orders
  add column if not exists under_warranty boolean not null default false;

comment on column public.service_orders.under_warranty is
  'True when the service order is covered by warranty';
