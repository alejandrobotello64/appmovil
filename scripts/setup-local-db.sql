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

-- Postgres local no trae Supabase Storage. Varias migraciones insertan
-- buckets y políticas; sin estas tablas `db:local` se detiene.
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, authenticator;
grant select, insert, update, delete on storage.buckets, storage.objects to anon, authenticated;
