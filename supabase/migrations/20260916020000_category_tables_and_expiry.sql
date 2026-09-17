-- Tablas lógicas por categoría + caducidad obligatoria en insumos/medicamentos/reactivos.

create or replace view public.insumos_items as
select *
from public.inventory_items
where item_kind = 'producto' and category = 'insumos';

create or replace view public.medicamentos_items as
select *
from public.inventory_items
where item_kind = 'producto' and category = 'medicamentos';

create or replace view public.refacciones_items as
select *
from public.inventory_items
where item_kind = 'producto' and category = 'refacciones';

create or replace view public.accesorios_items as
select *
from public.inventory_items
where item_kind = 'producto' and category = 'accesorios';

create or replace view public.reactivos_items as
select *
from public.inventory_items
where item_kind = 'producto' and category = 'reactivos';

create or replace view public.supply_items as
select *
from public.inventory_items
where item_kind = 'producto'
  and category in ('insumos', 'medicamentos', 'refacciones', 'accesorios', 'reactivos');

create or replace view public.equipment_items as
select *
from public.inventory_items
where item_kind = 'equipo'
   or category = 'equipos';

comment on view public.insumos_items is
  'Insumos médicos con control de caducidad y lote.';
comment on view public.medicamentos_items is
  'Medicamentos con control de caducidad y lote.';
comment on view public.refacciones_items is
  'Refacciones de equipos (tabla propia, sin caducidad obligatoria).';
comment on view public.accesorios_items is
  'Accesorios (tabla propia, sin caducidad obligatoria).';
comment on view public.reactivos_items is
  'Reactivos de laboratorio con control de caducidad.';
comment on view public.supply_items is
  'Union de tablas de consumibles (sin equipos).';
comment on view public.equipment_items is
  'Equipos médicos con control por serie y mantenimiento.';

-- Forzar caducidad/lote en categorías que lo requieren.
update public.inventory_items
set
  tracks_expiry = true,
  tracks_lot = true
where item_kind = 'producto'
  and category in ('insumos', 'medicamentos', 'reactivos');

create or replace function public.inventory_items_enforce_category_rules()
returns trigger
language plpgsql
as $$
begin
  if new.item_kind = 'equipo' or new.category = 'equipos' then
    new.item_kind := 'equipo';
    new.category := 'equipos';
    new.tracks_serial := true;
    return new;
  end if;

  if new.category in ('insumos', 'medicamentos', 'reactivos') then
    new.tracks_expiry := true;
    new.tracks_lot := true;
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_items_enforce_category_rules on public.inventory_items;
create trigger inventory_items_enforce_category_rules
before insert or update on public.inventory_items
for each row
execute function public.inventory_items_enforce_category_rules();
