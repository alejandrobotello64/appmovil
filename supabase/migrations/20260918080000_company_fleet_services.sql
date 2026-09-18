-- Flotilla de la empresa: vehículos y servicios de mantenimiento

create table if not exists public.company_vehicles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  plate text not null unique,
  brand text not null default '',
  model text not null default '',
  year integer,
  color text not null default '',
  vin text not null default '',
  vehicle_type text not null default 'utilitario'
    check (vehicle_type in (
      'utilitario', 'pickup', 'sedan', 'van', 'camion', 'moto', 'otro'
    )),
  status text not null default 'activo'
    check (status in ('activo', 'taller', 'baja')),
  odometer_km numeric(12,1) not null default 0,
  fuel_type text not null default 'gasolina'
    check (fuel_type in ('gasolina', 'diesel', 'hibrido', 'electrico', 'otro')),
  assigned_to text not null default '',
  insurance_policy text not null default '',
  insurance_expires date,
  verification_expires date,
  next_service_km numeric(12,1),
  next_service_date date,
  notes text not null default '',
  is_active boolean not null default true,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_services (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  vehicle_id uuid not null references public.company_vehicles(id) on delete cascade,
  service_type text not null default 'preventivo'
    check (service_type in (
      'preventivo', 'correctivo', 'afinacion', 'aceite', 'llantas',
      'frenos', 'verificacion', 'seguro', 'carroceria', 'electrico', 'otro'
    )),
  status text not null default 'programado'
    check (status in ('programado', 'en_proceso', 'completado', 'cancelado')),
  priority text not null default 'normal'
    check (priority in ('normal', 'urgente')),
  title text not null default '',
  description text not null default '',
  workshop text not null default '',
  technician text not null default '',
  requested_by text not null default '',
  odometer_km numeric(12,1),
  scheduled_at date,
  started_at date,
  completed_at date,
  next_service_km numeric(12,1),
  next_service_date date,
  labor_cost numeric(14,2) not null default 0,
  parts_cost numeric(14,2) not null default 0,
  other_cost numeric(14,2) not null default 0,
  total_cost numeric(14,2) not null default 0,
  invoice_folio text not null default '',
  notes text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_service_lines (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.vehicle_services(id) on delete cascade,
  description text not null default '',
  quantity numeric(14,2) not null default 1 check (quantity > 0),
  unit_cost numeric(14,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_service_events (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.vehicle_services(id) on delete cascade,
  event_type text not null default 'nota',
  message text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists company_vehicles_status_idx on public.company_vehicles (status, is_active);
create index if not exists company_vehicles_plate_idx on public.company_vehicles (plate);
create index if not exists vehicle_services_vehicle_idx on public.vehicle_services (vehicle_id, scheduled_at desc);
create index if not exists vehicle_services_status_idx on public.vehicle_services (status, scheduled_at);
create index if not exists vehicle_service_lines_service_idx on public.vehicle_service_lines (service_id);
create index if not exists vehicle_service_events_service_idx on public.vehicle_service_events (service_id, created_at desc);

drop trigger if exists company_vehicles_set_updated_at on public.company_vehicles;
create trigger company_vehicles_set_updated_at
before update on public.company_vehicles
for each row execute function public.set_updated_at();

drop trigger if exists vehicle_services_set_updated_at on public.vehicle_services;
create trigger vehicle_services_set_updated_at
before update on public.vehicle_services
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.company_vehicles to anon, authenticated;
grant select, insert, update, delete on public.vehicle_services to anon, authenticated;
grant select, insert, update, delete on public.vehicle_service_lines to anon, authenticated;
grant select, insert, update, delete on public.vehicle_service_events to anon, authenticated;

notify pgrst, 'reload schema';
