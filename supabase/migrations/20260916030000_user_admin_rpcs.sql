-- Alta / baja / permisos de usuarios de la app.

create or replace function public.set_app_user_active(
  p_user_id uuid,
  p_is_active boolean
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
begin
  if p_user_id is null then
    raise exception 'El usuario es obligatorio';
  end if;

  return query
  update public.app_users u
  set
    is_active = p_is_active,
    updated_at = now()
  where u.id = p_user_id
  returning u.id, u.username, u.full_name, u.role, u.is_active;

  if not found then
    raise exception 'Usuario no encontrado';
  end if;
end;
$$;

revoke all on function public.set_app_user_active(uuid, boolean) from public;
grant execute on function public.set_app_user_active(uuid, boolean) to anon, authenticated;

create or replace function public.update_app_user_access(
  p_user_id uuid,
  p_role text,
  p_full_name text default null
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
  if v_role not in (
    'administrador',
    'almacen',
    'compras',
    'ventas',
    'servicio',
    'direccion',
    'operador',
    'admin'
  ) then
    raise exception 'Rol no válido: %', p_role;
  end if;

  -- Normaliza alias legacy
  if v_role in ('operador') then
    v_role := 'almacen';
  elsif v_role = 'admin' then
    v_role := 'administrador';
  end if;

  return query
  update public.app_users u
  set
    role = v_role,
    full_name = case
      when p_full_name is null then u.full_name
      else nullif(trim(p_full_name), '')
    end,
    updated_at = now()
  where u.id = p_user_id
  returning u.id, u.username, u.full_name, u.role, u.is_active;

  if not found then
    raise exception 'Usuario no encontrado';
  end if;
end;
$$;

revoke all on function public.update_app_user_access(uuid, text, text) from public;
grant execute on function public.update_app_user_access(uuid, text, text) to anon, authenticated;
