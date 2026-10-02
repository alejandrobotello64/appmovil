-- Fixed-amount discount per quote line (alternative to discount_percent).
alter table public.quote_lines add column if not exists discount_amount numeric(14, 2) not null default 0;
alter table public.quote_lines drop constraint if exists quote_lines_discount_amount_check;
alter table public.quote_lines add constraint quote_lines_discount_amount_check check (discount_amount >= 0);
