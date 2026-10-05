insert into public.warehouses (code, name, city)
values
  ('MID', 'Almacén Mérida', 'Mérida'),
  ('PALMA', 'Almacén Palma', 'Villahermosa'),
  ('MENDEZ', 'Almacén Méndez', 'Villahermosa')
on conflict (code) do nothing;

insert into public.locations (warehouse_id, code, name)
select w.id, l.code, l.name
from public.warehouses w
cross join (
  values
    ('GENERAL', 'General'),
    ('INSUMOS', 'Insumos'),
    ('MEDICAMENTOS', 'Medicamentos'),
    ('REFACCIONES', 'Refacciones'),
    ('ACCESORIOS', 'Accesorios'),
    ('EQUIPOS', 'Equipos médicos')
) as l(code, name)
where w.code in ('MID', 'PALMA', 'MENDEZ')
  and not exists (
    select 1 from public.locations x where x.warehouse_id = w.id and x.code = l.code
  );
