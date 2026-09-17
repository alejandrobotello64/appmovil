-- Ficha completa de colaborador: editar datos personales, laborales y acceso.

create or replace function public.update_app_user_profile(
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
  p_password text default null
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
  uuid, text, text, text, text, text, text, text, text, text, text, date, date, text, text, text
) from public;
grant execute on function public.update_app_user_profile(
  uuid, text, text, text, text, text, text, text, text, text, text, date, date, text, text, text
) to anon, authenticated;
