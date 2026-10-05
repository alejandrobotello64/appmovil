-- Customizable pricing summary for service orders.
-- `discount` keeps the resulting general discount amount; when
-- `discount_percent` > 0 it takes precedence over a fixed amount.
alter table public.service_orders
  add column if not exists discount_percent numeric not null default 0,
  add column if not exists tax_exempt boolean not null default false,
  add column if not exists retention_isr_percent numeric not null default 0,
  add column if not exists retention_iva_percent numeric not null default 0,
  add column if not exists retention_amount numeric not null default 0,
  add column if not exists extra_charges jsonb not null default '[]'::jsonb,
  add column if not exists show_prices_in_pdf boolean not null default true;

alter table public.service_orders drop constraint if exists service_orders_pricing_ranges;
alter table public.service_orders add constraint service_orders_pricing_ranges check (
  discount_percent between 0 and 100
  and tax_rate between 0 and 100
  and retention_isr_percent between 0 and 100
  and retention_iva_percent between 0 and 100
  and jsonb_typeof(extra_charges) = 'array'
);

alter table public.service_order_lines
  add column if not exists discount_percent numeric not null default 0;

alter table public.service_order_lines drop constraint if exists service_order_lines_discount_range;
alter table public.service_order_lines add constraint service_order_lines_discount_range
  check (discount_percent between 0 and 100);
