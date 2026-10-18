-- Costo de lista y control de alertas de agotado en el catálogo.
-- No toca existencias ni precio de venta (unit_price).

alter table public.inventory_items
  add column if not exists cost_price numeric(14,4) not null default 0;

alter table public.inventory_items
  add column if not exists stock_alerts_enabled boolean not null default true;

comment on column public.inventory_items.cost_price is
  'Costo de lista / compra. El precio de venta sigue en unit_price.';
comment on column public.inventory_items.stock_alerts_enabled is
  'Si es false, el SKU sigue activo y se puede consultar, pero no genera alerta de agotado o bajo stock.';

update public.inventory_items
set cost_price = substring(notes from '<!--mas-cost:([0-9]+(?:\.[0-9]+)?)-->')::numeric
where notes ~ '<!--mas-cost:[0-9]+(?:\.[0-9]+)?-->'
  and coalesce(cost_price, 0) = 0;

update public.inventory_items
set stock_alerts_enabled = false
where notes like '%<!--mas-no-stock-alert-->%'
  and stock_alerts_enabled is distinct from false;

notify pgrst, 'reload schema';
