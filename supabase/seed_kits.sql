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
  ),
  (
    'KIT-000004',
    'Instalación · IntelliVue MX550',
    'Accesorios típicos para poner en marcha o reponer un monitor Philips IntelliVue MX550.',
    'instalacion',
    'monitor',
    true,
    'seed'
  ),
  (
    'KIT-000005',
    'Instalación · Efficia DFM100',
    'Accesorios típicos para poner en marcha o reponer un desfibrilador Philips Efficia DFM100.',
    'instalacion',
    'desfibrilador',
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
    ('KIT-000003', 'ACCESORIOS-000006', 1::numeric, 2, ''),
    ('KIT-000004', 'M1668A', 1::numeric, 0, 'Tronco ECG 5 derivaciones'),
    ('KIT-000004', 'M1644A', 1::numeric, 1, 'Leadset 5 snap AAMI'),
    ('KIT-000004', 'M1191BL', 1::numeric, 2, 'SpO2 adulto 3 m'),
    ('KIT-000004', 'M1574A', 1::numeric, 3, 'Manguito adulto'),
    ('KIT-000004', 'M1572A', 1::numeric, 4, 'Manguito pediátrico'),
    ('KIT-000004', 'M1598B', 1::numeric, 5, 'Manguera NBP 1.5 m'),
    ('KIT-000004', '21078A', 1::numeric, 6, 'Sonda cutánea'),
    ('KIT-000004', '21076A', 1::numeric, 7, 'Sonda rectal'),
    ('KIT-000004', 'M4605A', 1::numeric, 8, 'Batería MX550'),
    ('KIT-000004', '40457C', 1::numeric, 9, 'Papel de registro'),
    ('KIT-000005', '989803160641', 1::numeric, 0, 'Tronco ECG Efficia 3/5'),
    ('KIT-000005', '989803160651', 1::numeric, 1, 'Leadset 3 grabber AAMI'),
    ('KIT-000005', '989803197111', 1::numeric, 2, 'Cable de parches'),
    ('KIT-000005', 'M3713A', 1::numeric, 3, 'Parches adulto/niño'),
    ('KIT-000005', '989803190371', 1::numeric, 4, 'Batería DFM100'),
    ('KIT-000005', 'M1191B', 1::numeric, 5, 'SpO2 adulto 2 m'),
    ('KIT-000005', '989803177521', 1::numeric, 6, 'Manguito adulto'),
    ('KIT-000005', '989803209761', 1::numeric, 7, 'Manguera NBP 1.5 m'),
    ('KIT-000005', '989803196431', 1::numeric, 8, 'Paletas externas Efficia'),
    ('KIT-000005', '989803190381', 1::numeric, 9, 'Papel 50 mm')
) as lines(kit_code, sku, quantity, sort_order, notes)
join public.supply_kits kits on kits.code = lines.kit_code
join public.inventory_items items
  on items.sku = lines.sku or items.part_number = lines.sku
on conflict (kit_id, product_id) do update set
  quantity = excluded.quantity,
  sort_order = excluded.sort_order,
  notes = excluded.notes;
