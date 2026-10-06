-- Fotos y notas por lote (mismo esquema que serial_numbers) y evidencia fotográfica por movimiento.

alter table public.lots
  add column if not exists notes text not null default '',
  add column if not exists image_path text not null default '',
  add column if not exists image_url text not null default '',
  add column if not exists gallery_images jsonb not null default '[]'::jsonb;

alter table public.inventory_movements
  add column if not exists evidence_images jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lots_gallery_images_array') then
    alter table public.lots
      add constraint lots_gallery_images_array check (jsonb_typeof(gallery_images) = 'array');
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'inventory_movements_evidence_images_array'
  ) then
    alter table public.inventory_movements
      add constraint inventory_movements_evidence_images_array
      check (jsonb_typeof(evidence_images) = 'array');
  end if;
end $$;

notify pgrst, 'reload schema';
