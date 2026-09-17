-- Login by username or email, case-insensitive.

create or replace function public.authenticate_user(p_username text, p_password text)
returns table (id uuid, username text, full_name text, role text)
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_login text := lower(trim(p_username));
begin
  return query
  select u.id, u.username, u.full_name, u.role
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

notify pgrst, 'reload schema';
