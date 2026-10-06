-- Contratos simples, opcionales, ligados a equipos de cliente y visibles en órdenes de servicio.

create table if not exists public.service_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_number text not null,
  title text not null default '',
  client_id uuid references public.clients(id) on delete set null,
  tender_id uuid references public.tenders(id) on delete set null,
  starts_on date,
  ends_on date,
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_contracts_number_unique unique (contract_number)
);

alter table public.client_equipment
  add column if not exists contract_id uuid references public.service_contracts(id) on delete set null;

alter table public.service_orders
  add column if not exists contract_id uuid references public.service_contracts(id) on delete set null;

alter table public.service_orders
  add column if not exists contract_number text not null default '';

create index if not exists service_contracts_client_idx
  on public.service_contracts (client_id);
create index if not exists client_equipment_contract_idx
  on public.client_equipment (contract_id);
create index if not exists service_orders_contract_idx
  on public.service_orders (contract_id);

drop trigger if exists service_contracts_set_updated_at on public.service_contracts;
create trigger service_contracts_set_updated_at
before update on public.service_contracts
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.service_contracts to anon, authenticated;

notify pgrst, 'reload schema';
