-- Solicitudes de surtimiento también desde cotizaciones de venta (además de órdenes de servicio).

alter table public.service_order_requisitions
  alter column service_order_id drop not null;

alter table public.service_order_requisitions
  add column if not exists source_type text not null default 'orden_servicio',
  add column if not exists quote_id uuid references public.quotes(id) on delete set null,
  add column if not exists quote_folio text not null default '',
  add column if not exists client_name text not null default '',
  add column if not exists priority text not null default 'normal',
  add column if not exists needed_by date,
  add column if not exists delivery_address text not null default '';

alter table public.service_order_requisitions
  drop constraint if exists service_order_requisitions_source_type_check,
  add constraint service_order_requisitions_source_type_check
    check (source_type in ('orden_servicio', 'cotizacion'));

alter table public.service_order_requisitions
  drop constraint if exists service_order_requisitions_priority_check,
  add constraint service_order_requisitions_priority_check
    check (priority in ('normal', 'urgente'));

-- Una solicitud de servicio siempre trae su OS; la de cotización conserva folio y cliente aunque se borre la cotización.
alter table public.service_order_requisitions
  drop constraint if exists service_order_requisitions_source_ref_check,
  add constraint service_order_requisitions_source_ref_check
    check (source_type <> 'orden_servicio' or service_order_id is not null);

create index if not exists service_order_requisitions_quote_idx
  on public.service_order_requisitions (quote_id);
create index if not exists service_order_requisitions_source_idx
  on public.service_order_requisitions (source_type, requested_at desc);

alter table public.service_order_requisition_lines
  add column if not exists quote_line_id uuid references public.quote_lines(id) on delete set null;

notify pgrst, 'reload schema';
