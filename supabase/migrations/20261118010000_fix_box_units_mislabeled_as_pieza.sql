-- Presentaciones de caja etiquetadas como pieza → unit = caja
with to_fix as (
  select i.id
  from inventory_items i
  where coalesce(i.is_active, true)
    and lower(i.unit) = 'pieza'
    and (
      i.name ~* 'caja[[:space:]]*c[[:space:]]*/[[:space:]]*[[:digit:]]+'
      or i.name ~* 'caja[[:space:]]*con[[:space:]]*[[:digit:]]+'
      or i.name ~* '[[:digit:]]+[[:space:]]*/[[:space:]]*caja'
      or i.name ~* 'caja[[:space:]]*/[[:space:]]*[[:digit:]]+'
      or i.name ~* 'caja[[:space:]]+[[:digit:]]+[[:space:]]*(pzas?|piezas?|uds?|pcs?\\.?)?'
      or i.name ~* '[[:digit:]]+[[:space:]]*bolsas?[[:space:]]*/[[:space:]]*caja'
      or i.name ~* '[[:digit:]]+[[:space:]]*pz(?:as?)?[[:space:]]*/[[:space:]]*caja'
      or i.name ~* '[[:digit:]]+[[:space:]]*juegos?[[:space:]]*/[[:space:]]*caja'
      or i.name ~* 'caja/[[:digit:]]+[[:space:]]*pzas?'
      or i.name ~* '[[:digit:]]+[[:space:]]*pzas?\\.?[[:space:]]*/[[:space:]]*caja'
    )
    and (
      i.name !~* '[[:space:]]piezas?[[:space:]]*$'
      or not exists (
        select 1 from inventory_items s
        where coalesce(s.is_active, true)
          and s.id <> i.id
          and coalesce(trim(s.part_number), '') <> ''
          and lower(trim(s.part_number)) = lower(trim(i.part_number))
          and lower(s.unit) in ('caja', 'paquete')
      )
    )
)
update inventory_items i
set unit = 'caja',
    updated_at = now()
from to_fix t
where i.id = t.id;

-- Limpiar nombres de presentaciones en pieza que aún cargan el texto de empaque CAJA
update inventory_items i
set name = trim(both ' .' from regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    i.name,
                    '[[:space:]]*CAJA[[:space:]]*C[[:space:]]*/[[:space:]]*[[:digit:]]+',
                    '',
                    'gi'
                  ),
                  '[[:space:]]*CAJA[[:space:]]*CON[[:space:]]*[[:digit:]]+([[:space:]]*/?[[:space:]]*PZAS?\\.?)?',
                  '',
                  'gi'
                ),
                '[[:space:]]*CAJA[[:space:]]*/[[:space:]]*[[:digit:]]+[[:space:]]*PZAS?\\.?',
                '',
                'gi'
              ),
              '[[:space:]]*[[:digit:]]+[[:space:]]*(PZAS?\\.?|PIEZAS?|UDS?|JUEGOS?)[[:space:]]*/[[:space:]]*CAJA',
              '',
              'gi'
            ),
            '[[:space:]]*[[:digit:]]+[[:space:]]*/[[:space:]]*CAJA',
            '',
            'gi'
          ),
          '[[:space:]]*CAJA[[:space:]]+[[:digit:]]+[[:space:]]*(PZAS?\\.?|PIEZAS?|HJS)?',
          '',
          'gi'
        ),
        '[[:space:]]{2,}',
        ' ',
        'g'
      ),
      '[[:space:]]piezas?[[:space:]]*$',
      ' pieza',
      'gi'
    )),
    updated_at = now()
where coalesce(i.is_active, true)
  and lower(i.unit) = 'pieza'
  and i.name ~* 'caja'
  and exists (
    select 1 from inventory_items s
    where coalesce(s.is_active, true)
      and s.id <> i.id
      and coalesce(trim(s.part_number), '') <> ''
      and lower(trim(s.part_number)) = lower(trim(i.part_number))
      and lower(s.unit) in ('caja', 'paquete')
  );

update inventory_items i
set name = trim(i.name) || ' pieza',
    updated_at = now()
where coalesce(i.is_active, true)
  and lower(i.unit) = 'pieza'
  and i.name !~* '[[:space:]]piezas?[[:space:]]*$'
  and exists (
    select 1 from inventory_items s
    where coalesce(s.is_active, true)
      and s.id <> i.id
      and coalesce(trim(s.part_number), '') <> ''
      and lower(trim(s.part_number)) = lower(trim(i.part_number))
      and lower(s.unit) in ('caja', 'paquete')
  )
  and i.name ~* 'caja';

-- Duplicados EN de BabyFlow (qty 0): dejar ficha en español
update inventory_items
set is_active = false,
    updated_at = now()
where sku in (
  'ACCESORIOS-001171',
  'ACCESORIOS-002224',
  'ACCESORIOS-001156',
  'ACCESORIOS-002219',
  'ACCESORIOS-001142',
  'ACCESORIOS-002380'
)
and coalesce(quantity, 0) = 0;
