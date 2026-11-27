-- Vacía también las existencias de accesorios: queda solo el catálogo.
-- No toca reactivos ni equipos.
-- Conserva productos, registros de lote e historial de movimientos.
-- El respaldo se agrega a las tablas mas_backup.stock_reset_20261127_* ya existentes.

insert into mas_backup.stock_reset_20261127_items (id, sku, name, category, quantity, backed_up_at)
select i.id, i.sku, i.name, i.category, i.quantity, now()
from public.inventory_items i
where i.category = 'accesorios';

insert into mas_backup.stock_reset_20261127_balances
select b.*
from public.inventory_balances b
join public.inventory_items i on i.id = b.product_id
where i.category = 'accesorios';

insert into mas_backup.stock_reset_20261127_serials
select s.*
from public.serial_numbers s
join public.inventory_items i on i.id = s.product_id
where i.category = 'accesorios';

insert into mas_backup.stock_reset_20261127_movement_serials (movement_id, serial_id)
select m.id, m.serial_id
from public.inventory_movements m
join public.serial_numbers s on s.id = m.serial_id
join public.inventory_items i on i.id = s.product_id
where i.category = 'accesorios';

-- Series en almacén: se eliminan (una entrada posterior las vuelve a crear como disponibles).
delete from public.serial_numbers s
using public.inventory_items i
where s.product_id = i.id
  and i.category = 'accesorios'
  and s.status = 'disponible';

-- Existencias a 0 en todos los almacenes y ubicaciones.
update public.inventory_balances b
set qty_on_hand = 0,
    updated_at = now()
from public.inventory_items i
where b.product_id = i.id
  and i.category = 'accesorios'
  and coalesce(b.qty_on_hand, 0) <> 0;

do $$
declare
  r record;
begin
  perform set_config('mas.allow_qty', '1', true);
  for r in
    select i.id
    from public.inventory_items i
    where i.category = 'accesorios'
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
  where i.category = 'accesorios'
    and coalesce(i.quantity, 0) <> 0;
end $$;
