-- Esquema de costos y alertas de stock. Aditivo; no borra datos ni toca unit_price.
-- Pegar en: https://supabase.com/dashboard/project/iqfareiwiadqsauejaaf/sql/new

begin;

alter table public.inventory_items
  add column if not exists cost_price numeric(14,4) not null default 0;

alter table public.inventory_items
  add column if not exists stock_alerts_enabled boolean not null default true;

update public.inventory_items
set cost_price = substring(notes from '<!--mas-cost:([0-9]+(?:\.[0-9]+)?)-->')::numeric
where notes ~ '<!--mas-cost:[0-9]+(?:\.[0-9]+)?-->'
  and coalesce(cost_price, 0) = 0;

update public.inventory_items
set stock_alerts_enabled = false
where notes like '%<!--mas-no-stock-alert-->%'
  and stock_alerts_enabled is distinct from false;

commit;

notify pgrst, 'reload schema';
