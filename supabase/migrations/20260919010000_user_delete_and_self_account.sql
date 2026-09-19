-- Eliminar usuarios y auto-servicio de perfil / contraseña

create or replace function public.delete_app_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_role text;
  v_admin_count integer;
begin
  if p_user_id is null then
    raise exception 'El usuario es obligatorio';
  end if;

  select u.username, u.role
  into v_username, v_role
  from public.app_users u
  where u.id = p_user_id;

  if not found then
    raise exception 'Usuario no encontrado';
  end if;

  if v_role in ('administrador', 'admin') then
    select count(*)::integer
    into v_admin_count
    from public.app_users
    where role in ('administrador', 'admin')
      and id <> p_user_id
      and is_active = true;

    if coalesce(v_admin_count, 0) = 0 then
      raise exception 'No puedes eliminar al último administrador activo';
    end if;
  end if;

  delete from public.app_users where id = p_user_id;
end;
$$;

revoke all on function public.delete_app_user(uuid) from public;
grant execute on function public.delete_app_user(uuid) to anon, authenticated;

create or replace function public.get_app_user_by_id(p_user_id uuid)
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
  where u.id = p_user_id;
$$;

revoke all on function public.get_app_user_by_id(uuid) from public;
grant execute on function public.get_app_user_by_id(uuid) to anon, authenticated;

create or replace function public.update_own_profile(
  p_user_id uuid,
  p_full_name text,
  p_email text default '',
  p_phone text default '',
  p_curp text default '',
  p_rfc text default '',
  p_birth_date date default null,
  p_address text default '',
  p_blood_type text default '',
  p_emergency_contact_name text default '',
  p_emergency_contact_phone text default '',
  p_emergency_contact_relation text default '',
  p_notes text default ''
)
returns table (
  id uuid,
  username text,
  full_name text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text := nullif(trim(coalesce(p_full_name, '')), '');
begin
  if p_user_id is null then
    raise exception 'El usuario es obligatorio';
  end if;
  if v_full_name is null then
    raise exception 'El nombre completo es obligatorio';
  end if;

  return query
  update public.app_users u
  set
    full_name = v_full_name,
    email = coalesce(trim(p_email), ''),
    phone = coalesce(trim(p_phone), ''),
    curp = upper(coalesce(trim(p_curp), '')),
    rfc = upper(coalesce(trim(p_rfc), '')),
    birth_date = p_birth_date,
    address = coalesce(trim(p_address), ''),
    blood_type = upper(coalesce(trim(p_blood_type), '')),
    emergency_contact_name = coalesce(trim(p_emergency_contact_name), ''),
    emergency_contact_phone = coalesce(trim(p_emergency_contact_phone), ''),
    emergency_contact_relation = coalesce(trim(p_emergency_contact_relation), ''),
    notes = coalesce(trim(p_notes), ''),
    updated_at = now()
  where u.id = p_user_id
  returning u.id, u.username, u.full_name, u.role;

  if not found then
    raise exception 'Usuario no encontrado';
  end if;
end;
$$;

revoke all on function public.update_own_profile(
  uuid, text, text, text, text, text, date, text, text, text, text, text, text
) from public;
grant execute on function public.update_own_profile(
  uuid, text, text, text, text, text, date, text, text, text, text, text, text
) to anon, authenticated;

create or replace function public.change_own_password(
  p_user_id uuid,
  p_current_password text,
  p_new_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  if p_user_id is null then
    raise exception 'El usuario es obligatorio';
  end if;
  if p_new_password is null or length(p_new_password) < 6 then
    raise exception 'La nueva contraseña debe tener al menos 6 caracteres';
  end if;

  select u.password_hash into v_hash
  from public.app_users u
  where u.id = p_user_id and u.is_active = true;

  if not found then
    raise exception 'Usuario no encontrado o inactivo';
  end if;

  if v_hash is distinct from extensions.crypt(p_current_password, v_hash) then
    raise exception 'La contraseña actual no es correcta';
  end if;

  update public.app_users
  set
    password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
    updated_at = now()
  where id = p_user_id;
end;
$$;

revoke all on function public.change_own_password(uuid, text, text) from public;
grant execute on function public.change_own_password(uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
