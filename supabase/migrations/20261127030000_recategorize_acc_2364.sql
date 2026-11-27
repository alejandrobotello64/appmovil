-- ACC-2364 "KIT, PRONTO HNDHLD, NEX GEN PIEZA" (Masimo 9757) estaba como
-- equipo; es un accesorio. Se conserva SKU, existencias y series.
update public.inventory_items
set category = 'accesorios',
    item_kind = 'producto'
where category = 'equipos'
  and sku = 'ACC-2364';
