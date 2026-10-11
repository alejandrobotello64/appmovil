-- Nombres y marcas alineados al inventario Cedros (n.º de parte).
-- Se aplica después del snapshot para no perder las correcciones locales.

-- Marcas con grafía unificada.
update public.inventory_items
set
  brand = 'Dräger',
  manufacturer = case
    when coalesce(trim(manufacturer), '') = '' or manufacturer ~* 'drag' then 'Dräger'
    else manufacturer
  end
where brand ~* 'drag';

update public.inventory_items
set
  brand = 'Philips',
  manufacturer = case
    when coalesce(trim(manufacturer), '') = '' or manufacturer ~* 'phil' then 'Philips'
    else manufacturer
  end
where brand ~* 'phil';

update public.inventory_items
set
  brand = 'ASP',
  manufacturer = case
    when coalesce(trim(manufacturer), '') = '' or lower(trim(manufacturer)) = 'asp' then 'ASP'
    else manufacturer
  end
where lower(trim(brand)) = 'asp';

update public.inventory_items
set manufacturer = brand
where coalesce(trim(manufacturer), '') = ''
  and coalesce(trim(brand), '') <> '';

-- Nombres genéricos o mal capturados, según n.º de parte de Cedros.
update public.inventory_items
set name = 'Válvula espiratoria para Evita'
where regexp_replace(upper(trim(part_number)), '[^A-Z0-9]', '', 'g') = '8410580';

update public.inventory_items
set name = 'Adaptador de calentador de tubo'
where regexp_replace(upper(trim(part_number)), '[^A-Z0-9]', '', 'g') = '8414968';

update public.inventory_items
set name = 'Probe 3, skin temp, reusable'
where sku = 'ACCESORIOS-000005'
   or regexp_replace(upper(trim(part_number)), '[^A-Z0-9]', '', 'g') = '221701';

update public.inventory_items
set name = 'Mascarilla de silicona infante pequeña 0 reutilizable'
where regexp_replace(upper(trim(part_number)), '[^A-Z0-9]', '', 'g') = 'MP01910';

-- El catálogo arranca sin color; se etiqueta a mano en Inventario.
update public.inventory_items set color_tag = '';
