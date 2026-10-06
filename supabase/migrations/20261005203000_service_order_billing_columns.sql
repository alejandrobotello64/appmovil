-- Columnas de facturación que ya están en el proyecto de Supabase
-- y no venían en las migraciones del repo.

alter table public.service_orders
  add column if not exists discount_percent numeric(5,2) not null default 0;
alter table public.service_orders
  add column if not exists extra_charges jsonb not null default '[]'::jsonb;
alter table public.service_orders
  add column if not exists retention_amount numeric(14,2) not null default 0;
alter table public.service_orders
  add column if not exists retention_isr_percent numeric(5,2) not null default 0;
alter table public.service_orders
  add column if not exists retention_iva_percent numeric(5,2) not null default 0;
alter table public.service_orders
  add column if not exists show_prices_in_pdf boolean not null default true;
alter table public.service_orders
  add column if not exists tax_exempt boolean not null default false;

alter table public.service_order_lines
  add column if not exists discount_percent numeric(5,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'service_orders_discount_percent_range'
  ) then
    alter table public.service_orders
      add constraint service_orders_discount_percent_range
      check (discount_percent >= 0 and discount_percent <= 100);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'service_order_lines_discount_percent_range'
  ) then
    alter table public.service_order_lines
      add constraint service_order_lines_discount_percent_range
      check (discount_percent >= 0 and discount_percent <= 100);
  end if;
end $$;

notify pgrst, 'reload schema';
