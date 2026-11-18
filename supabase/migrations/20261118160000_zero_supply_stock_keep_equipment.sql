-- Pone en 0 las existencias de insumos/accesorios/refacciones.
-- Conserva equipos (item_kind = equipo / category = equipos).

update public.inventory_balances b
set qty_on_hand = 0,
    updated_at = now()
from public.inventory_items i
where b.product_id = i.id
  and not (i.item_kind = 'equipo' or i.category = 'equipos')
  and coalesce(b.qty_on_hand, 0) <> 0;

do $$
declare
  r record;
begin
  perform set_config('mas.allow_qty', '1', true);
  for r in
    select i.id
    from public.inventory_items i
    where not (i.item_kind = 'equipo' or i.category = 'equipos')
      and (
        coalesce(i.quantity, 0) <> 0
        or exists (
          select 1 from public.inventory_balances b where b.product_id = i.id
        )
      )
  loop
    perform public.sync_item_quantity(r.id);
  end loop;

  update public.inventory_items i
  set quantity = 0
  where not (i.item_kind = 'equipo' or i.category = 'equipos')
    and coalesce(i.quantity, 0) <> 0;
end $$;
