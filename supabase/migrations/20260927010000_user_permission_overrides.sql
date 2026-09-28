-- Ajustes individuales de permisos sobre la plantilla del rol.
-- Formato: { "<modulo>.<accion>": true | false }; las claves ausentes heredan del rol.

alter table public.app_users
  add column if not exists permission_overrides jsonb not null default '{}'::jsonb;

drop function if exists public.authenticate_user(text, text);

create function public.authenticate_user(p_username text, p_password text)
returns table (
  id uuid,
  username text,
  full_name text,
  role text,
  photo_url text,
  permission_overrides jsonb
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
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
    coalesce(u.photo_url, ''),
    coalesce(u.permission_overrides, '{}'::jsonb)
  from public.app_users u
  where u.is_active = true
    and (
      lower(u.username) = v_login
      or lower(nullif(trim(u.email), '')) = v_login
    )
    and u.password_hash = extensions.crypt(p_password, u.password_hash);
end;
$$;

grant execute on function public.authenticate_user(text, text) to anon, authenticated;

drop function if exists public.list_app_users();

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
  photo_url text,
  is_technician boolean,
  is_service_advisor boolean,
  permission_overrides jsonb
)
language sql
security definer
set search_path to 'public'
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
    coalesce(u.photo_url, ''),
    coalesce(u.is_technician, false),
    coalesce(u.is_service_advisor, false),
    coalesce(u.permission_overrides, '{}'::jsonb)
  from public.app_users u
  order by u.created_at desc;
$$;

grant execute on function public.list_app_users() to anon, authenticated;

create or replace function public.set_app_user_permissions(
  p_user_id uuid,
  p_permission_overrides jsonb
)
returns table (id uuid, role text, permission_overrides jsonb)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_user_id is null then
    raise exception 'El usuario es obligatorio';
  end if;
  if p_permission_overrides is null or jsonb_typeof(p_permission_overrides) <> 'object' then
    raise exception 'Los permisos deben ser un objeto JSON';
  end if;

  return query
  update public.app_users u
  set
    permission_overrides = p_permission_overrides,
    updated_at = now()
  where u.id = p_user_id
  returning u.id, u.role, u.permission_overrides;

  if not found then
    raise exception 'Usuario no encontrado';
  end if;
end;
$$;

grant execute on function public.set_app_user_permissions(uuid, jsonb) to anon, authenticated;

create or replace function public.get_app_user_access(p_user_id uuid)
returns table (
  id uuid,
  role text,
  is_active boolean,
  permission_overrides jsonb
)
language sql
security definer
set search_path to 'public'
as $$
  select
    u.id,
    u.role,
    u.is_active,
    coalesce(u.permission_overrides, '{}'::jsonb)
  from public.app_users u
  where u.id = p_user_id;
$$;

grant execute on function public.get_app_user_access(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
