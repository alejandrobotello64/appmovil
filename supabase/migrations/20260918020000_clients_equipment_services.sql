-- Clientes, equipos en sitio (levantamientos) e historial de servicios.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  rfc text not null default '',
  address text not null default '',
  city text not null default '',
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_equipment (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  brand text not null default '',
  model text not null default '',
  serial_number text not null default '',
  location text not null default '',
  status text not null default 'operativo'
    check (status in ('operativo', 'fuera_servicio', 'en_reparacion', 'baja')),
  installed_at date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  equipment_id uuid references public.client_equipment(id) on delete set null,
  service_type text not null default 'levantamiento'
    check (
      service_type in (
        'levantamiento',
        'instalacion',
        'mantenimiento',
        'reparacion',
        'capacitacion',
        'otro'
      )
    ),
  title text not null,
  description text not null default '',
  performed_at date not null default current_date,
  technician text not null default '',
  folio text not null default '',
  notes text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists clients_name_idx on public.clients (name);
create index if not exists client_equipment_client_idx on public.client_equipment (client_id);
create index if not exists client_services_client_idx on public.client_services (client_id);
create index if not exists client_services_equipment_idx on public.client_services (equipment_id);
create index if not exists client_services_performed_idx on public.client_services (performed_at desc);

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists client_equipment_set_updated_at on public.client_equipment;
create trigger client_equipment_set_updated_at
before update on public.client_equipment
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.clients to anon, authenticated;
grant select, insert, update, delete on public.client_equipment to anon, authenticated;
grant select, insert, update, delete on public.client_services to anon, authenticated;

notify pgrst, 'reload schema';
