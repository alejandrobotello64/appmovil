-- EQ-24 "Paletas water resistant" (Philips M3543A) estaba como equipo;
-- es una refacción. Se conserva SKU, existencias, serie y lote.
update public.inventory_items
set category = 'refacciones',
    item_kind = 'producto'
where category = 'equipos'
  and sku = 'EQ-24';
