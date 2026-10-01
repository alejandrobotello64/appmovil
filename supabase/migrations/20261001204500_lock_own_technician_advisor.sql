-- Los colaboradores no pueden autoasignarse técnico ni asesor.
-- Esas marcas solo las cambia administración en Usuarios.

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
  p_notes text default '',
  p_is_technician boolean default null,
  p_is_service_advisor boolean default null
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

  -- p_is_technician y p_is_service_advisor se ignoran a propósito.
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

notify pgrst, 'reload schema';
