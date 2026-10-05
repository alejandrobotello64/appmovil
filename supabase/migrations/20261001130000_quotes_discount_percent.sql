-- Percentage discount on sales quotes. `discount` keeps the resulting amount.
alter table public.quotes
  add column if not exists discount_percent numeric not null default 0;
