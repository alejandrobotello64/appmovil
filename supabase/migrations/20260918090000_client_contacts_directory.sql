-- Directorio de contactos por cliente

create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  role_title text not null default '',
  department text not null default '',
  phone text not null default '',
  email text not null default '',
  extension text not null default '',
  notes text not null default '',
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_contacts_client_idx
  on public.client_contacts (client_id, sort_order, name);

drop trigger if exists client_contacts_set_updated_at on public.client_contacts;
create trigger client_contacts_set_updated_at
before update on public.client_contacts
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.client_contacts to anon, authenticated;

notify pgrst, 'reload schema';
