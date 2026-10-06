-- Descuento porcentual en cotizaciones comerciales (además del monto en pesos).
alter table public.quotes
  add column if not exists discount_percent numeric(5,2) not null default 0;

alter table public.quotes
  drop constraint if exists quotes_discount_percent_range;

alter table public.quotes
  add constraint quotes_discount_percent_range
  check (discount_percent >= 0 and discount_percent <= 100);
