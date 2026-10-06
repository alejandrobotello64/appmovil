-- Varias fotos por pieza serializada; image_path / image_url siguen siendo la principal.

alter table public.serial_numbers
  add column if not exists gallery_images jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'serial_numbers_gallery_images_array'
  ) then
    alter table public.serial_numbers
      add constraint serial_numbers_gallery_images_array
      check (jsonb_typeof(gallery_images) = 'array');
  end if;
end $$;

notify pgrst, 'reload schema';
