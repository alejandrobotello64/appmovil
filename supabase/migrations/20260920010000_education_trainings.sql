-- Módulo de educación: capacitaciones de especialistas

create table if not exists public.education_trainings (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  name text not null,
  personnel_name text not null default '',
  shift text not null default '',
  phone text not null default '',
  training_date date,
  notes text not null default '',
  signature_path text not null default '',
  signature_url text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists education_trainings_created_at_idx
  on public.education_trainings (created_at desc);

create index if not exists education_trainings_personnel_idx
  on public.education_trainings (personnel_name);

create table if not exists public.education_training_photos (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.education_trainings(id) on delete cascade,
  caption text not null default '',
  file_path text not null default '',
  file_url text not null default '',
  uploaded_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists education_training_photos_training_idx
  on public.education_training_photos (training_id, created_at desc);

drop trigger if exists education_trainings_set_updated_at on public.education_trainings;
create trigger education_trainings_set_updated_at
before update on public.education_trainings
for each row execute function public.set_updated_at();

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public)
  values ('education-media', 'education-media', true)
  on conflict (id) do nothing;
end $$;

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'education_media_select'
  ) then
    create policy education_media_select on storage.objects
      for select using (bucket_id = 'education-media');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'education_media_insert'
  ) then
    create policy education_media_insert on storage.objects
      for insert with check (bucket_id = 'education-media');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'education_media_update'
  ) then
    create policy education_media_update on storage.objects
      for update using (bucket_id = 'education-media');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'education_media_delete'
  ) then
    create policy education_media_delete on storage.objects
      for delete using (bucket_id = 'education-media');
  end if;
end $$;

grant select, insert, update, delete on public.education_trainings to anon, authenticated;
grant select, insert, update, delete on public.education_training_photos to anon, authenticated;

notify pgrst, 'reload schema';
