-- Agregar instalación a los tipos de orden de servicio

alter table public.service_orders
  drop constraint if exists service_orders_service_type_check;

alter table public.service_orders
  alter column service_type set default 'diagnostico';

alter table public.service_orders
  add constraint service_orders_service_type_check
  check (service_type in (
    'diagnostico',
    'preventivo',
    'correctivo',
    'instalacion'
  ));

notify pgrst, 'reload schema';
