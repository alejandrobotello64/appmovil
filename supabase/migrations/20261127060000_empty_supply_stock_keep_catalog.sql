-- Vacía las existencias de insumos, refacciones y medicamentos: queda solo el catálogo.
-- No toca accesorios, reactivos ni equipos.
-- Conserva productos, registros de lote e historial de movimientos.
-- Antes de borrar se guarda un respaldo en el esquema mas_backup (no expuesto por la API).

create schema if not exists mas_backup;
revoke all on schema mas_backup from public, anon, authenticated;

create table mas_backup.stock_reset_20261127_items as
select i.id, i.sku, i.name, i.category, i.quantity, now() as backed_up_at
from public.inventory_items i
where i.category in ('insumos', 'refacciones', 'medicamentos');

create table mas_backup.stock_reset_20261127_balances as
select b.*
from public.inventory_balances b
join public.inventory_items i on i.id = b.product_id
where i.category in ('insumos', 'refacciones', 'medicamentos');

create table mas_backup.stock_reset_20261127_serials as
select s.*
from public.serial_numbers s
join public.inventory_items i on i.id = s.product_id
where i.category in ('insumos', 'refacciones', 'medicamentos');

-- Al borrar una serie, inventory_movements.serial_id queda en null: se guarda el vínculo.
create table mas_backup.stock_reset_20261127_movement_serials as
select m.id as movement_id, m.serial_id
from public.inventory_movements m
join public.serial_numbers s on s.id = m.serial_id
join public.inventory_items i on i.id = s.product_id
where i.category in ('insumos', 'refacciones', 'medicamentos');

alter table mas_backup.stock_reset_20261127_items enable row level security;
alter table mas_backup.stock_reset_20261127_balances enable row level security;
alter table mas_backup.stock_reset_20261127_serials enable row level security;
alter table mas_backup.stock_reset_20261127_movement_serials enable row level security;

-- Series en almacén: se eliminan (una entrada posterior las vuelve a crear como disponibles).
delete from public.serial_numbers s
using public.inventory_items i
where s.product_id = i.id
  and i.category in ('insumos', 'refacciones', 'medicamentos')
  and s.status = 'disponible';

-- Existencias a 0 en todos los almacenes y ubicaciones.
update public.inventory_balances b
set qty_on_hand = 0,
    updated_at = now()
from public.inventory_items i
where b.product_id = i.id
  and i.category in ('insumos', 'refacciones', 'medicamentos')
  and coalesce(b.qty_on_hand, 0) <> 0;

do $$
declare
  r record;
begin
  perform set_config('mas.allow_qty', '1', true);
  for r in
    select i.id
    from public.inventory_items i
    where i.category in ('insumos', 'refacciones', 'medicamentos')
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
  where i.category in ('insumos', 'refacciones', 'medicamentos')
    and coalesce(i.quantity, 0) <> 0;
end $$;
