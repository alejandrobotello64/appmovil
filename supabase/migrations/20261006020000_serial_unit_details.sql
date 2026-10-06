-- Datos propios de cada pieza serializada: un producto (modelo) agrupa varias series
-- y cada serie conserva su estado físico, fechas y foto.

alter table public.serial_numbers
  add column if not exists notes text not null default '',
  add column if not exists manufactured_at date,
  add column if not exists last_maintenance_date date,
  add column if not exists next_maintenance_date date,
  add column if not exists image_path text not null default '',
  add column if not exists image_url text not null default '';

notify pgrst, 'reload schema';
