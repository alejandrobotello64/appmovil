-- Partidas fuera de catálogo en solicitudes de surtimiento: se compran y se entregan sin pasar por inventario.
alter table public.service_order_requisition_lines
  alter column product_id drop not null;

alter table public.service_order_requisition_lines
  drop constraint if exists service_order_requisition_lines_product_or_description;

alter table public.service_order_requisition_lines
  add constraint service_order_requisition_lines_product_or_description
  check (product_id is not null or btrim(description) <> '');
