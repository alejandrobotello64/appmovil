-- Bóveda de contraseñas de servicio (Biomédica).
-- Las tablas quedan cerradas (RLS sin políticas y sin grants para anon/authenticated).
-- El secreto se guarda cifrado en Supabase Vault; la app solo accede mediante
-- funciones SECURITY DEFINER que vuelven a validar usuario + contraseña del
-- colaborador y sus permisos del módulo `contrasenas_servicio`.

create table if not exists public.service_passwords (
  id uuid primary key default gen_random_uuid(),
  password_type text not null
    check (password_type in ('usuario', 'biomedica', 'servicio')),
  title text not null,
  equipment_type text not null default '',
  brand text not null default '',
  model text not null default '',
  software_version text not null default '',
  client_name text not null default '',
  access_user text not null default '',
  secret_id uuid not null,
  notes text not null default '',
  created_by uuid references public.app_users (id) on delete set null,
  created_by_name text not null default '',
  updated_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_password_access_log (
  id bigint generated always as identity primary key,
  password_id uuid references public.service_passwords (id) on delete set null,
  password_title text not null default '',
  action text not null check (action in ('reveal', 'create', 'update', 'delete')),
  user_id uuid references public.app_users (id) on delete set null,
  user_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists service_password_access_log_password_idx
  on public.service_password_access_log (password_id, created_at desc);

alter table public.service_passwords enable row level security;
alter table public.service_password_access_log enable row level security;
revoke all on table public.service_passwords from anon, authenticated;
revoke all on table public.service_password_access_log from anon, authenticated;

-- Replica de la plantilla de roles de src/lib/auth/permissions.ts para este módulo.
create or replace function public.service_vault_has_permission(
  p_role text,
  p_overrides jsonb,
  p_action text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(coalesce(p_overrides, '{}'::jsonb) -> ('contrasenas_servicio.' || p_action)) = 'boolean'
      then (p_overrides ->> ('contrasenas_servicio.' || p_action))::boolean
    when p_action = 'approve'
      then lower(trim(coalesce(p_role, ''))) in ('admin', 'administrador')
    else lower(trim(coalesce(p_role, ''))) in ('admin', 'administrador', 'servicio')
  end
$$;

create or replace function public.service_vault_authorize(
  p_username text,
  p_password text,
  p_action text
)
returns public.app_users
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_login text := lower(trim(coalesce(p_username, '')));
  v_user public.app_users;
begin
  select u.* into v_user
  from public.app_users u
  where u.is_active = true
    and (
      lower(u.username) = v_login
      or lower(nullif(trim(u.email), '')) = v_login
    )
    and u.password_hash = extensions.crypt(coalesce(p_password, ''), u.password_hash)
  limit 1;

  if v_user.id is null then
    raise exception 'Contraseña incorrecta.' using errcode = '28P01';
  end if;

  if not public.service_vault_has_permission(v_user.role, v_user.permission_overrides, 'view')
    or not public.service_vault_has_permission(v_user.role, v_user.permission_overrides, p_action)
  then
    raise exception 'No tienes permiso para esta acción.' using errcode = '42501';
  end if;

  return v_user;
end;
$$;

create or replace function public.service_vault_list(p_username text, p_password text)
returns table (
  id uuid,
  password_type text,
  title text,
  equipment_type text,
  brand text,
  model text,
  software_version text,
  client_name text,
  access_user text,
  notes text,
  created_by_name text,
  updated_by_name text,
  created_at timestamptz,
  updated_at timestamptz,
  reveal_count bigint,
  last_revealed_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
begin
  perform public.service_vault_authorize(p_username, p_password, 'view');

  return query
  select
    p.id,
    p.password_type,
    p.title,
    p.equipment_type,
    p.brand,
    p.model,
    p.software_version,
    p.client_name,
    p.access_user,
    p.notes,
    p.created_by_name,
    p.updated_by_name,
    p.created_at,
    p.updated_at,
    coalesce(l.reveal_count, 0),
    l.last_revealed_at
  from public.service_passwords p
  left join lateral (
    select count(*) as reveal_count, max(a.created_at) as last_revealed_at
    from public.service_password_access_log a
    where a.password_id = p.id and a.action = 'reveal'
  ) l on true
  order by lower(p.brand), lower(p.model), lower(p.title);
end;
$$;

create or replace function public.service_vault_reveal(
  p_username text,
  p_password text,
  p_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.app_users;
  v_row public.service_passwords;
  v_secret text;
begin
  v_user := public.service_vault_authorize(p_username, p_password, 'export');

  select * into v_row from public.service_passwords where id = p_id;
  if not found then
    raise exception 'La contraseña ya no existe.' using errcode = 'P0002';
  end if;

  select s.decrypted_secret into v_secret
  from vault.decrypted_secrets s
  where s.id = v_row.secret_id;

  insert into public.service_password_access_log (password_id, password_title, action, user_id, user_name)
  values (
    v_row.id,
    v_row.title,
    'reveal',
    v_user.id,
    coalesce(nullif(trim(v_user.full_name), ''), v_user.username)
  );

  return coalesce(v_secret, '');
end;
$$;

create or replace function public.service_vault_save(
  p_username text,
  p_password text,
  p_id uuid,
  p_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.app_users;
  v_row public.service_passwords;
  v_name text;
  v_type text := trim(coalesce(p_data ->> 'password_type', ''));
  v_title text := trim(coalesce(p_data ->> 'title', ''));
  v_secret text := coalesce(p_data ->> 'secret', '');
  v_id uuid;
begin
  v_user := public.service_vault_authorize(
    p_username,
    p_password,
    case when p_id is null then 'create' else 'edit' end
  );
  v_name := coalesce(nullif(trim(v_user.full_name), ''), v_user.username);

  if v_type not in ('usuario', 'biomedica', 'servicio') then
    raise exception 'Tipo de contraseña inválido.' using errcode = '22023';
  end if;
  if v_title = '' then
    raise exception 'El nombre de la contraseña es obligatorio.' using errcode = '22023';
  end if;

  if p_id is null then
    if v_secret = '' then
      raise exception 'Escribe la contraseña.' using errcode = '22023';
    end if;

    insert into public.service_passwords (
      password_type, title, equipment_type, brand, model, software_version,
      client_name, access_user, notes, secret_id,
      created_by, created_by_name, updated_by_name
    )
    values (
      v_type,
      v_title,
      trim(coalesce(p_data ->> 'equipment_type', '')),
      trim(coalesce(p_data ->> 'brand', '')),
      trim(coalesce(p_data ->> 'model', '')),
      trim(coalesce(p_data ->> 'software_version', '')),
      trim(coalesce(p_data ->> 'client_name', '')),
      trim(coalesce(p_data ->> 'access_user', '')),
      trim(coalesce(p_data ->> 'notes', '')),
      vault.create_secret(v_secret, null, 'MAS · contraseña de servicio'),
      v_user.id,
      v_name,
      v_name
    )
    returning id into v_id;

    insert into public.service_password_access_log (password_id, password_title, action, user_id, user_name)
    values (v_id, v_title, 'create', v_user.id, v_name);
  else
    select * into v_row from public.service_passwords where id = p_id for update;
    if not found then
      raise exception 'La contraseña ya no existe.' using errcode = 'P0002';
    end if;

    update public.service_passwords set
      password_type = v_type,
      title = v_title,
      equipment_type = trim(coalesce(p_data ->> 'equipment_type', '')),
      brand = trim(coalesce(p_data ->> 'brand', '')),
      model = trim(coalesce(p_data ->> 'model', '')),
      software_version = trim(coalesce(p_data ->> 'software_version', '')),
      client_name = trim(coalesce(p_data ->> 'client_name', '')),
      access_user = trim(coalesce(p_data ->> 'access_user', '')),
      notes = trim(coalesce(p_data ->> 'notes', '')),
      updated_by_name = v_name,
      updated_at = now()
    where id = p_id;

    if v_secret <> '' then
      perform vault.update_secret(v_row.secret_id, v_secret);
    end if;

    v_id := p_id;
    insert into public.service_password_access_log (password_id, password_title, action, user_id, user_name)
    values (v_id, v_title, 'update', v_user.id, v_name);
  end if;

  return v_id;
end;
$$;

create or replace function public.service_vault_delete(
  p_username text,
  p_password text,
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.app_users;
  v_row public.service_passwords;
begin
  v_user := public.service_vault_authorize(p_username, p_password, 'delete');

  delete from public.service_passwords where id = p_id returning * into v_row;
  if v_row.id is null then
    raise exception 'La contraseña ya no existe.' using errcode = 'P0002';
  end if;

  delete from vault.secrets where id = v_row.secret_id;

  insert into public.service_password_access_log (password_id, password_title, action, user_id, user_name)
  values (
    null,
    v_row.title,
    'delete',
    v_user.id,
    coalesce(nullif(trim(v_user.full_name), ''), v_user.username)
  );
end;
$$;

create or replace function public.service_vault_log(
  p_username text,
  p_password text,
  p_id uuid default null
)
returns table (
  id bigint,
  password_id uuid,
  password_title text,
  action text,
  user_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
begin
  perform public.service_vault_authorize(p_username, p_password, 'approve');

  return query
  select a.id, a.password_id, a.password_title, a.action, a.user_name, a.created_at
  from public.service_password_access_log a
  where p_id is null or a.password_id = p_id
  order by a.created_at desc
  limit 300;
end;
$$;

revoke all on function public.service_vault_has_permission(text, jsonb, text) from public, anon, authenticated;
revoke all on function public.service_vault_authorize(text, text, text) from public, anon, authenticated;

revoke all on function public.service_vault_list(text, text) from public;
revoke all on function public.service_vault_reveal(text, text, uuid) from public;
revoke all on function public.service_vault_save(text, text, uuid, jsonb) from public;
revoke all on function public.service_vault_delete(text, text, uuid) from public;
revoke all on function public.service_vault_log(text, text, uuid) from public;

grant execute on function public.service_vault_list(text, text) to anon, authenticated;
grant execute on function public.service_vault_reveal(text, text, uuid) to anon, authenticated;
grant execute on function public.service_vault_save(text, text, uuid, jsonb) to anon, authenticated;
grant execute on function public.service_vault_delete(text, text, uuid) to anon, authenticated;
grant execute on function public.service_vault_log(text, text, uuid) to anon, authenticated;
