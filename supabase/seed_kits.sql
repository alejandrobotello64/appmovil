-- Kits de ejemplo. Se aplica después del catálogo para resolver product_id por SKU.

insert into public.supply_kits (code, name, description, service_type, equipment_kind, is_active, created_by)
values
  (
    'KIT-000001',
    'Preventivo mensual · esterilización STERRAD',
    'Consumibles típicos para el servicio preventivo mensual de esterilizadores STERRAD.',
    'preventivo',
    'autoclave',
    true,
    'seed'
  ),
  (
    'KIT-000002',
    'Preventivo mensual · circuito Dräger',
    'Accesorios e insumos de respiración que suelen pedirse en preventivos de anestesia o ventilación.',
    'preventivo',
    'ventilador',
    true,
    'seed'
  ),
  (
    'KIT-000003',
    'Instalación · sondas de temperatura',
    'Juego base de probes de temperatura para una instalación o puesta en marcha.',
    'instalacion',
    'monitor',
    true,
    'seed'
  )
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  service_type = excluded.service_type,
  equipment_kind = excluded.equipment_kind,
  is_active = excluded.is_active;

insert into public.supply_kit_lines (kit_id, product_id, quantity, sort_order, notes)
select kits.id, items.id, lines.quantity, lines.sort_order, lines.notes
from (
  values
    ('KIT-000001', 'INSUMOS-000005', 1::numeric, 0, 'Cassette del ciclo'),
    ('KIT-000001', 'INSUMOS-000006', 1::numeric, 1, 'Indicador químico'),
    ('KIT-000001', 'INSUMOS-000007', 1::numeric, 2, 'Cinta indicadora'),
    ('KIT-000001', 'INSUMOS-000003', 1::numeric, 3, 'Indicador biológico / PCD'),
    ('KIT-000001', 'INSUMOS-000015', 1::numeric, 4, 'Bowie-Dick'),
    ('KIT-000002', 'ACCESORIOS-000001', 1::numeric, 0, 'Válvula respiratoria'),
    ('KIT-000002', 'ACCESORIOS-000002', 1::numeric, 1, 'Adaptador de calentador'),
    ('KIT-000002', 'INSUMOS-000001', 1::numeric, 2, 'Mascarilla silicona'),
    ('KIT-000003', 'ACCESORIOS-000003', 1::numeric, 0, ''),
    ('KIT-000003', 'ACCESORIOS-000004', 1::numeric, 1, ''),
    ('KIT-000003', 'ACCESORIOS-000006', 1::numeric, 2, '')
) as lines(kit_code, sku, quantity, sort_order, notes)
join public.supply_kits kits on kits.code = lines.kit_code
join public.inventory_items items on items.sku = lines.sku
on conflict (kit_id, product_id) do update set
  quantity = excluded.quantity,
  sort_order = excluded.sort_order,
  notes = excluded.notes;
