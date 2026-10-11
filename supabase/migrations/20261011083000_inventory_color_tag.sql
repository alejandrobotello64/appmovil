-- Color de etiqueta para separar productos en el catálogo.

alter table public.inventory_items
  add column if not exists color_tag text not null default '';

alter table public.inventory_items
  drop constraint if exists inventory_items_color_tag_check;

alter table public.inventory_items
  add constraint inventory_items_color_tag_check
  check (color_tag in (
    '',
    'rojo',
    'naranja',
    'amarillo',
    'verde',
    'azul',
    'morado',
    'turquesa',
    'rosa',
    'gris'
  ));

notify pgrst, 'reload schema';
