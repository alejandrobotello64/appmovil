-- Tipo de sangre y contacto de emergencia en ficha de colaborador.

alter table public.app_users
  add column if not exists blood_type text not null default '',
  add column if not exists emergency_contact_name text not null default '',
  add column if not exists emergency_contact_phone text not null default '',
  add column if not exists emergency_contact_relation text not null default '';

drop function if exists public.list_app_users();
drop function if exists public.create_app_user(text, text, text, text, text, text, text, text, text, text, text, date, date, text, text);
drop function if exists public.create_app_user(text, text, text, text, text, text, text, text, text, text, text, date, date, text, text, text, text, text, text);
drop function if exists public.update_app_user_profile(uuid, text, text, text, text, text, text, text, text, text, text, date, date, text, text, text);
drop function if exists public.update_app_user_profile(uuid, text, text, text, text, text, text, text, text, text, text, date, date, text, text, text, text, text, text, text);

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
  emergency_contact_relation text
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
    coalesce(u.emergency_contact_relation, '')
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
  p_notes text default '',
  p_blood_type text default '',
  p_emergency_contact_name text default '',
  p_emergency_contact_phone text default '',
  p_emergency_contact_relation text default ''
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
    hire_date, birth_date, address, notes,
    blood_type, emergency_contact_name, emergency_contact_phone, emergency_contact_relation
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
    coalesce(trim(p_notes), ''),
    upper(coalesce(trim(p_blood_type), '')),
    coalesce(trim(p_emergency_contact_name), ''),
    coalesce(trim(p_emergency_contact_phone), ''),
    coalesce(trim(p_emergency_contact_relation), '')
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
  text, text, text, text, text, text, text, text, text, text, text, date, date, text, text, text, text, text, text
) from public;
grant execute on function public.create_app_user(
  text, text, text, text, text, text, text, text, text, text, text, date, date, text, text, text, text, text, text
) to anon, authenticated;

create function public.update_app_user_profile(
  p_user_id uuid,
  p_username text,
  p_full_name text,
  p_role text,
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
  p_notes text default '',
  p_password text default null,
  p_blood_type text default '',
  p_emergency_contact_name text default '',
  p_emergency_contact_phone text default '',
  p_emergency_contact_relation text default ''
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
  v_username text := lower(trim(coalesce(p_username, '')));
  v_role text := lower(trim(coalesce(p_role, '')));
  v_full_name text := nullif(trim(coalesce(p_full_name, '')), '');
begin
  if p_user_id is null then
    raise exception 'El usuario es obligatorio';
  end if;
  if v_username = '' then
    raise exception 'El usuario de acceso es obligatorio';
  end if;
  if v_full_name is null then
    raise exception 'El nombre completo es obligatorio';
  end if;
  if p_password is not null and length(p_password) > 0 and length(p_password) < 6 then
    raise exception 'La contraseña debe tener al menos 6 caracteres';
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

  if exists (
    select 1
    from public.app_users u
    where u.username = v_username
      and u.id <> p_user_id
  ) then
    raise exception 'Ya existe un colaborador con el usuario %', v_username;
  end if;

  return query
  update public.app_users u
  set
    username = v_username,
    full_name = v_full_name,
    role = v_role,
    email = coalesce(trim(p_email), ''),
    phone = coalesce(trim(p_phone), ''),
    employee_number = coalesce(trim(p_employee_number), ''),
    curp = upper(coalesce(trim(p_curp), '')),
    rfc = upper(coalesce(trim(p_rfc), '')),
    job_title = coalesce(trim(p_job_title), ''),
    department = coalesce(trim(p_department), ''),
    hire_date = p_hire_date,
    birth_date = p_birth_date,
    address = coalesce(trim(p_address), ''),
    notes = coalesce(trim(p_notes), ''),
    blood_type = upper(coalesce(trim(p_blood_type), '')),
    emergency_contact_name = coalesce(trim(p_emergency_contact_name), ''),
    emergency_contact_phone = coalesce(trim(p_emergency_contact_phone), ''),
    emergency_contact_relation = coalesce(trim(p_emergency_contact_relation), ''),
    password_hash = case
      when p_password is null or length(p_password) = 0 then u.password_hash
      else extensions.crypt(p_password, extensions.gen_salt('bf'))
    end,
    updated_at = now()
  where u.id = p_user_id
  returning u.id, u.username, u.full_name, u.role, u.is_active;

  if not found then
    raise exception 'Usuario no encontrado';
  end if;
end;
$$;

revoke all on function public.update_app_user_profile(
  uuid, text, text, text, text, text, text, text, text, text, text, date, date, text, text, text, text, text, text, text
) from public;
grant execute on function public.update_app_user_profile(
  uuid, text, text, text, text, text, text, text, text, text, text, date, date, text, text, text, text, text, text, text
) to anon, authenticated;

notify pgrst, 'reload schema';
