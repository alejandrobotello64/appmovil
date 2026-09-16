-- Usuarios iniciales (idempotente). El catálogo va en seed_catalog.sql.

insert into public.app_users (username, password_hash, full_name, role)
values (
  'alexbazz64@gmail.com',
  extensions.crypt('admin123', extensions.gen_salt('bf')),
  'Administrador MAS',
  'admin'
)
on conflict (username) do nothing;

insert into public.app_users (username, password_hash, full_name, role)
values (
  'masservice.lcs@gmail.com',
  extensions.crypt('mas101012', extensions.gen_salt('bf')),
  'MAS Service',
  'admin'
)
on conflict (username) do nothing;
