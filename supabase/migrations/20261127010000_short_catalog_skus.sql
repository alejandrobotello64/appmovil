-- SKUs cortos sin ceros de relleno: ACCESORIOS-000012 → ACC-12, EQUIPO-000026 → EQ-26.

with mapped as (
  select
    id,
    sku as old_sku,
    case
      when sku ~ '^ACCESORIOS-[0-9]+$' then 'ACC-' || (substring(sku from '[0-9]+$'))::bigint::text
      when sku ~ '^INSUMOS-[0-9]+$' then 'INS-' || (substring(sku from '[0-9]+$'))::bigint::text
      when sku ~ '^EQUIPO-[0-9]+$' then 'EQ-' || (substring(sku from '[0-9]+$'))::bigint::text
      when sku ~ '^MEDICAMENTOS-[0-9]+$' then 'MED-' || (substring(sku from '[0-9]+$'))::bigint::text
      when sku ~ '^REFACCIONES-[0-9]+$' then 'REF-' || (substring(sku from '[0-9]+$'))::bigint::text
      when sku ~ '^REACTIVOS-[0-9]+$' then 'REA-' || (substring(sku from '[0-9]+$'))::bigint::text
      when sku ~ '^OTROS-[0-9]+$' then 'OTR-' || (substring(sku from '[0-9]+$'))::bigint::text
      else null
    end as new_sku
  from public.inventory_items
)
update public.inventory_items i
set sku = m.new_sku
from mapped m
where i.id = m.id
  and m.new_sku is not null
  and m.new_sku is distinct from i.sku
  and not exists (
    select 1
    from public.inventory_items other
    where other.sku = m.new_sku
      and other.id <> i.id
  );

-- Referencias denormalizadas
update public.inventory_movements m
set product_sku = i.sku
from public.inventory_items i
where m.product_id = i.id
  and coalesce(m.product_sku, '') is distinct from i.sku;

update public.warehouse_movements m
set item_sku = i.sku
from public.inventory_items i
where m.item_id = i.id
  and coalesce(m.item_sku, '') is distinct from i.sku;

update public.purchase_order_items poi
set item_sku = i.sku
from public.inventory_items i
where poi.item_id = i.id
  and coalesce(poi.item_sku, '') is distinct from i.sku;

update public.purchase_request_lines prl
set product_sku = i.sku
from public.inventory_items i
where prl.product_id = i.id
  and coalesce(prl.product_sku, '') is distinct from i.sku;

notify pgrst, 'reload schema';
