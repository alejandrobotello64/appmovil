-- Ubicación de cliente en apartados + estado (entidad) en clientes.

alter table public.clients
  add column if not exists state text not null default '';

alter table public.inventory_holds
  add column if not exists client_city text not null default '',
  add column if not exists client_state text not null default '';

notify pgrst, 'reload schema';
