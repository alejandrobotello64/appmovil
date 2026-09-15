-- Local PostgREST roles matching the hosted Supabase API (anon JWT).
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticator') then
    create role authenticator login password 'maslocaldev';
  end if;
end
$$;

grant anon to authenticator;
grant authenticated to authenticator;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

grant usage on schema public to anon, authenticated, authenticator;
grant usage on schema extensions to anon, authenticated, authenticator, public;
grant execute on all functions in schema extensions to anon, authenticated, public;
