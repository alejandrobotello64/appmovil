-- Idempotent: the cloud already has stub purchase_requests / purchase_request_lines
-- (id, folio, status, notes, quantity, …). Add the Compras tracking columns.

alter table public.purchase_requests
  add column if not exists source_type text not null default 'manual';
alter table public.purchase_requests
  add column if not exists source_id uuid;
alter table public.purchase_requests
  add column if not exists source_folio text not null default '';
alter table public.purchase_requests
  add column if not exists reason text not null default 'no_surtible';
alter table public.purchase_requests
  add column if not exists taken_by text not null default '';
alter table public.purchase_requests
  add column if not exists taken_at timestamptz;
alter table public.purchase_requests
  add column if not exists warehouse_notes text not null default '';
alter table public.purchase_requests
  add column if not exists compras_notes text not null default '';

-- La app lee notes, justification, quantity y description. No se copian a las columnas nuevas.

alter table public.purchase_request_lines
  add column if not exists source_line_id uuid;
alter table public.purchase_request_lines
  add column if not exists quantity_requested numeric(14,2);
alter table public.purchase_request_lines
  add column if not exists quantity_ordered numeric(14,2) not null default 0;
alter table public.purchase_request_lines
  add column if not exists quantity_received numeric(14,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'purchase_requests_status_check'
  ) then
    alter table public.purchase_requests
      add constraint purchase_requests_status_check
      check (status in (
        'solicitada', 'en_compra', 'pedida', 'parcial', 'recibida', 'cancelada'
      ));
  end if;
exception when others then
  null;
end $$;

create index if not exists purchase_requests_status_idx
  on public.purchase_requests (status, requested_at desc);
create index if not exists purchase_requests_source_idx
  on public.purchase_requests (source_type, source_id);
create index if not exists purchase_requests_order_idx
  on public.purchase_requests (purchase_order_id);
create index if not exists purchase_request_lines_request_idx
  on public.purchase_request_lines (request_id);

drop trigger if exists purchase_requests_set_updated_at on public.purchase_requests;
create trigger purchase_requests_set_updated_at
before update on public.purchase_requests
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.purchase_requests to anon, authenticated;
grant select, insert, update, delete on public.purchase_request_lines to anon, authenticated;

notify pgrst, 'reload schema';
