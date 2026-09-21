-- Capacitaciones: varios asistentes + datos de sesión imprimibles

alter table public.education_trainings
  add column if not exists location text not null default '',
  add column if not exists instructor text not null default '',
  add column if not exists client_name text not null default '',
  add column if not exists duration_hours numeric(6,2);

create table if not exists public.education_training_attendees (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.education_trainings(id) on delete cascade,
  full_name text not null,
  shift text not null default '',
  phone text not null default '',
  job_title text not null default '',
  employee_number text not null default '',
  signature_path text not null default '',
  signature_url text not null default '',
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists education_training_attendees_training_idx
  on public.education_training_attendees (training_id, sort_order, created_at);

drop trigger if exists education_training_attendees_set_updated_at
  on public.education_training_attendees;
create trigger education_training_attendees_set_updated_at
before update on public.education_training_attendees
for each row execute function public.set_updated_at();

-- Migrar el personal único previo a la tabla de asistentes
insert into public.education_training_attendees (
  training_id,
  full_name,
  shift,
  phone,
  signature_path,
  signature_url,
  sort_order
)
select
  t.id,
  coalesce(nullif(trim(t.personnel_name), ''), 'Sin nombre'),
  coalesce(t.shift, ''),
  coalesce(t.phone, ''),
  coalesce(t.signature_path, ''),
  coalesce(t.signature_url, ''),
  0
from public.education_trainings t
where coalesce(nullif(trim(t.personnel_name), ''), '') <> ''
  and not exists (
    select 1
    from public.education_training_attendees a
    where a.training_id = t.id
  );

grant select, insert, update, delete on public.education_training_attendees to anon, authenticated;

notify pgrst, 'reload schema';
