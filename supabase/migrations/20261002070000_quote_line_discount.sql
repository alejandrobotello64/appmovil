alter table public.quote_lines
  add column if not exists discount_percent numeric(5, 2) not null default 0;

alter table public.quote_lines
  drop constraint if exists quote_lines_discount_percent_check;

alter table public.quote_lines
  add constraint quote_lines_discount_percent_check
  check (discount_percent >= 0 and discount_percent <= 100);
