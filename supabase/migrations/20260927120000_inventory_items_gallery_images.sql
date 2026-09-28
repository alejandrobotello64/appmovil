alter table public.inventory_items
  add column if not exists gallery_images jsonb not null default '[]'::jsonb;

comment on column public.inventory_items.gallery_images is
  'Imágenes adicionales del artículo: [{path, url, uploadedAt}]. La principal sigue en image_path/image_url.';
