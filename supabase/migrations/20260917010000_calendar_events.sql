-- Calendario operativo: eventos, visibilidad por área y recordatorios.

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  event_date date not null,
  start_time text not null default '',
  end_time text not null default '',
  location text not null default '',
  visible_areas text[] not null default '{}',
  notify_email boolean not null default false,
  notify_whatsapp boolean not null default false,
  reminder_days integer not null default 1,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp')),
  recipient_name text not null default '',
  recipient_target text not null default '',
  message text not null default '',
  status text not null default 'pendiente'
    check (status in ('pendiente', 'enviado', 'fallido')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists calendar_events_date_idx
  on public.calendar_events (event_date);

create index if not exists calendar_reminders_event_idx
  on public.calendar_reminders (event_id);

grant select, insert, update, delete on public.calendar_events to anon, authenticated;
grant select, insert, update, delete on public.calendar_reminders to anon, authenticated;

-- Datos de demo para que el calendario muestre cumpleaños de usuarios seed
-- sin pisar una ficha que ya tenga fecha, correo o teléfono.
update public.app_users
set
  birth_date = coalesce(birth_date, '1988-09-18'),
  email = coalesce(nullif(email, ''), username),
  department = coalesce(nullif(department, ''), 'administracion')
where username = 'alexbazz64@gmail.com';

update public.app_users
set
  birth_date = coalesce(birth_date, '1992-03-21'),
  email = coalesce(nullif(email, ''), username),
  department = coalesce(nullif(department, ''), 'servicio')
where username = 'masservice.lcs@gmail.com';

notify pgrst, 'reload schema';
