-- Foto de perfil de colaboradores

alter table public.app_users
  add column if not exists photo_url text not null default '';

insert into storage.buckets (id, name, public)
values ('user-photos', 'user-photos', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'user_photos_select'
  ) then
    create policy user_photos_select on storage.objects
      for select using (bucket_id = 'user-photos');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'user_photos_insert'
  ) then
    create policy user_photos_insert on storage.objects
      for insert with check (bucket_id = 'user-photos');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'user_photos_update'
  ) then
    create policy user_photos_update on storage.objects
      for update using (bucket_id = 'user-photos');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'user_photos_delete'
  ) then
    create policy user_photos_delete on storage.objects
      for delete using (bucket_id = 'user-photos');
  end if;
end $$;

drop function if exists public.list_app_users();
drop function if exists public.get_app_user_by_id(uuid);
drop function if exists public.authenticate_user(text, text);
drop function if exists public.set_app_user_photo(uuid, text);

create function public.list_app_users()
returns table (
  id uuid,
  username text,
  full_name text,
  role text,
  is_active boolean,
  created_at timestamptz,
  email text,
  phone text,
  employee_number text,
  curp text,
  rfc text,
  job_title text,
  department text,
  hire_date date,
  birth_date date,
  address text,
  notes text,
  blood_type text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  photo_url text
)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    u.username,
    u.full_name,
    u.role,
    u.is_active,
    u.created_at,
    coalesce(u.email, ''),
    coalesce(u.phone, ''),
    coalesce(u.employee_number, ''),
    coalesce(u.curp, ''),
    coalesce(u.rfc, ''),
    coalesce(u.job_title, ''),
    coalesce(u.department, ''),
    u.hire_date,
    u.birth_date,
    coalesce(u.address, ''),
    coalesce(u.notes, ''),
    coalesce(u.blood_type, ''),
    coalesce(u.emergency_contact_name, ''),
    coalesce(u.emergency_contact_phone, ''),
    coalesce(u.emergency_contact_relation, ''),
    coalesce(u.photo_url, '')
  from public.app_users u
  order by u.created_at desc;
$$;

revoke all on function public.list_app_users() from public;
grant execute on function public.list_app_users() to anon, authenticated;

create function public.get_app_user_by_id(p_user_id uuid)
returns table (
  id uuid,
  username text,
  full_name text,
  role text,
  is_active boolean,
  created_at timestamptz,
  email text,
  phone text,
  employee_number text,
  curp text,
  rfc text,
  job_title text,
  department text,
  hire_date date,
  birth_date date,
  address text,
  notes text,
  blood_type text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  photo_url text
)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    u.username,
    u.full_name,
    u.role,
    u.is_active,
    u.created_at,
    coalesce(u.email, ''),
    coalesce(u.phone, ''),
    coalesce(u.employee_number, ''),
    coalesce(u.curp, ''),
    coalesce(u.rfc, ''),
    coalesce(u.job_title, ''),
    coalesce(u.department, ''),
    u.hire_date,
    u.birth_date,
    coalesce(u.address, ''),
    coalesce(u.notes, ''),
    coalesce(u.blood_type, ''),
    coalesce(u.emergency_contact_name, ''),
    coalesce(u.emergency_contact_phone, ''),
    coalesce(u.emergency_contact_relation, ''),
    coalesce(u.photo_url, '')
  from public.app_users u
  where u.id = p_user_id;
$$;

revoke all on function public.get_app_user_by_id(uuid) from public;
grant execute on function public.get_app_user_by_id(uuid) to anon, authenticated;

create function public.authenticate_user(p_username text, p_password text)
returns table (
  id uuid,
  username text,
  full_name text,
  role text,
  photo_url text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_login text := lower(trim(p_username));
begin
  return query
  select
    u.id,
    u.username,
    u.full_name,
    u.role,
    coalesce(u.photo_url, '')
  from public.app_users u
  where u.is_active = true
    and (
      lower(u.username) = v_login
      or lower(nullif(trim(u.email), '')) = v_login
    )
    and u.password_hash = extensions.crypt(p_password, u.password_hash);
end;
$$;

revoke all on function public.authenticate_user(text, text) from public;
grant execute on function public.authenticate_user(text, text) to anon, authenticated;

create function public.set_app_user_photo(p_user_id uuid, p_photo_url text)
returns table (
  id uuid,
  username text,
  full_name text,
  role text,
  photo_url text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'El usuario es obligatorio';
  end if;

  return query
  update public.app_users u
  set
    photo_url = coalesce(trim(p_photo_url), ''),
    updated_at = now()
  where u.id = p_user_id
  returning
    u.id,
    u.username,
    u.full_name,
    u.role,
    coalesce(u.photo_url, '');

  if not found then
    raise exception 'Usuario no encontrado';
  end if;
end;
$$;

revoke all on function public.set_app_user_photo(uuid, text) from public;
grant execute on function public.set_app_user_photo(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
