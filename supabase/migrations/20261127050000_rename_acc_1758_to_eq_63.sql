-- ACC-1758 "CO-OXIMETER RAINBOW PRONTO NEONATAL" (Masimo 9167) es un equipo
-- pero conservaba SKU de accesorio. Pasa al siguiente consecutivo de equipos.
update public.inventory_items i
set sku = 'EQ-63'
where i.sku = 'ACC-1758'
  and i.category = 'equipos'
  and not exists (
    select 1 from public.inventory_items other where other.sku = 'EQ-63'
  );

-- Referencias denormalizadas del mismo producto
update public.inventory_movements m
set product_sku = i.sku
from public.inventory_items i
where m.product_id = i.id
  and i.sku = 'EQ-63'
  and coalesce(m.product_sku, '') is distinct from i.sku;

update public.warehouse_movements m
set item_sku = i.sku
from public.inventory_items i
where m.item_id = i.id
  and i.sku = 'EQ-63'
  and coalesce(m.item_sku, '') is distinct from i.sku;

update public.purchase_order_items poi
set item_sku = i.sku
from public.inventory_items i
where poi.item_id = i.id
  and i.sku = 'EQ-63'
  and coalesce(poi.item_sku, '') is distinct from i.sku;

update public.purchase_request_lines prl
set product_sku = i.sku
from public.inventory_items i
where prl.product_id = i.id
  and i.sku = 'EQ-63'
  and coalesce(prl.product_sku, '') is distinct from i.sku;
