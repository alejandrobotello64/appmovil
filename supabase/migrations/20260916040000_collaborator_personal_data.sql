-- Datos personales de colaboradores + RPCs actualizados.

alter table public.app_users
  add column if not exists email text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists employee_number text not null default '',
  add column if not exists curp text not null default '',
  add column if not exists rfc text not null default '',
  add column if not exists job_title text not null default '',
  add column if not exists department text not null default '',
  add column if not exists hire_date date,
  add column if not exists birth_date date,
  add column if not exists address text not null default '',
  add column if not exists notes text not null default '';

drop function if exists public.list_app_users();
drop function if exists public.create_app_user(text, text, text, text);
drop function if exists public.create_app_user(text, text, text, text, text, text, text, text, text, text, text, date, date, text, text);
drop function if exists public.update_app_user_access(uuid, text, text);
drop function if exists public.update_app_user_access(uuid, text, text, text, text, text, text, text, text, text, date, date, text, text);

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
  notes text
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
    coalesce(u.notes, '')
  from public.app_users u
  order by u.created_at desc;
$$;

revoke all on function public.list_app_users() from public;
grant execute on function public.list_app_users() to anon, authenticated;

create function public.create_app_user(
  p_username text,
  p_password text,
  p_full_name text default null,
  p_role text default 'almacen',
  p_email text default '',
  p_phone text default '',
  p_employee_number text default '',
  p_curp text default '',
  p_rfc text default '',
  p_job_title text default '',
  p_department text default '',
  p_hire_date date default null,
  p_birth_date date default null,
  p_address text default '',
  p_notes text default ''
)
returns table (
  id uuid,
  username text,
  full_name text,
  role text,
  is_active boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_username text := lower(trim(p_username));
  v_role text := lower(trim(coalesce(p_role, 'almacen')));
begin
  if v_username is null or v_username = '' then
    raise exception 'El usuario es obligatorio';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'La contraseña debe tener al menos 6 caracteres';
  end if;
  if nullif(trim(coalesce(p_full_name, '')), '') is null then
    raise exception 'El nombre completo es obligatorio';
  end if;

  if v_role in ('operador') then
    v_role := 'almacen';
  elsif v_role = 'admin' then
    v_role := 'administrador';
  end if;

  if v_role not in (
    'administrador', 'almacen', 'compras', 'ventas', 'servicio', 'direccion'
  ) then
    raise exception 'Rol no válido: %', p_role;
  end if;

  return query
  insert into public.app_users (
    username, password_hash, full_name, role, is_active,
    email, phone, employee_number, curp, rfc, job_title, department,
    hire_date, birth_date, address, notes
  )
  values (
    v_username,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    trim(p_full_name),
    v_role,
    true,
    coalesce(trim(p_email), ''),
    coalesce(trim(p_phone), ''),
    coalesce(trim(p_employee_number), ''),
    upper(coalesce(trim(p_curp), '')),
    upper(coalesce(trim(p_rfc), '')),
    coalesce(trim(p_job_title), ''),
    coalesce(trim(p_department), ''),
    p_hire_date,
    p_birth_date,
    coalesce(trim(p_address), ''),
    coalesce(trim(p_notes), '')
  )
  returning
    app_users.id,
    app_users.username,
    app_users.full_name,
    app_users.role,
    app_users.is_active;
end;
$$;

revoke all on function public.create_app_user(
  text, text, text, text, text, text, text, text, text, text, text, date, date, text, text
) from public;
grant execute on function public.create_app_user(
  text, text, text, text, text, text, text, text, text, text, text, date, date, text, text
) to anon, authenticated;

create function public.update_app_user_access(
  p_user_id uuid,
  p_role text,
  p_full_name text default null,
  p_email text default null,
  p_phone text default null,
  p_employee_number text default null,
  p_curp text default null,
  p_rfc text default null,
  p_job_title text default null,
  p_department text default null,
  p_hire_date date default null,
  p_birth_date date default null,
  p_address text default null,
  p_notes text default null
)
returns table (
  id uuid,
  username text,
  full_name text,
  role text,
  is_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(trim(coalesce(p_role, '')));
begin
  if p_user_id is null then
    raise exception 'El usuario es obligatorio';
  end if;

  if v_role in ('operador') then
    v_role := 'almacen';
  elsif v_role = 'admin' then
    v_role := 'administrador';
  end if;

  if v_role not in (
    'administrador', 'almacen', 'compras', 'ventas', 'servicio', 'direccion'
  ) then
    raise exception 'Rol no válido: %', p_role;
  end if;

  return query
  update public.app_users u
  set
    role = v_role,
    full_name = case
      when p_full_name is null then u.full_name
      else nullif(trim(p_full_name), '')
    end,
    email = case when p_email is null then u.email else coalesce(trim(p_email), '') end,
    phone = case when p_phone is null then u.phone else coalesce(trim(p_phone), '') end,
    employee_number = case
      when p_employee_number is null then u.employee_number
      else coalesce(trim(p_employee_number), '')
    end,
    curp = case when p_curp is null then u.curp else upper(coalesce(trim(p_curp), '')) end,
    rfc = case when p_rfc is null then u.rfc else upper(coalesce(trim(p_rfc), '')) end,
    job_title = case
      when p_job_title is null then u.job_title
      else coalesce(trim(p_job_title), '')
    end,
    department = case
      when p_department is null then u.department
      else coalesce(trim(p_department), '')
    end,
    hire_date = case when p_hire_date is null then u.hire_date else p_hire_date end,
    birth_date = case when p_birth_date is null then u.birth_date else p_birth_date end,
    address = case when p_address is null then u.address else coalesce(trim(p_address), '') end,
    notes = case when p_notes is null then u.notes else coalesce(trim(p_notes), '') end,
    updated_at = now()
  where u.id = p_user_id
  returning u.id, u.username, u.full_name, u.role, u.is_active;

  if not found then
    raise exception 'Usuario no encontrado';
  end if;
end;
$$;

revoke all on function public.update_app_user_access(
  uuid, text, text, text, text, text, text, text, text, text, date, date, text, text
) from public;
grant execute on function public.update_app_user_access(
  uuid, text, text, text, text, text, text, text, text, text, date, date, text, text
) to anon, authenticated;
