-- Vistas lógicas para separar insumos y equipos sobre inventory_items.

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

comment on view public.supply_items is
  'Insumos, medicamentos, accesorios, refacciones y reactivos (sin equipos).';

comment on view public.equipment_items is
  'Equipos médicos con control por serie y mantenimiento.';
