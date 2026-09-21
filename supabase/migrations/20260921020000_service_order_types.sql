-- Tipos de orden de servicio: diagnóstico, preventivo, correctivo o instalación

update public.service_orders
set service_type = case service_type
  when 'mantenimiento' then 'preventivo'
  when 'reparacion' then 'correctivo'
  when 'calibracion' then 'preventivo'
  when 'levantamiento' then 'diagnostico'
  when 'capacitacion' then 'diagnostico'
  when 'otro' then 'diagnostico'
  else service_type
end
where service_type not in (
  'diagnostico',
  'preventivo',
  'correctivo',
  'instalacion'
);

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
