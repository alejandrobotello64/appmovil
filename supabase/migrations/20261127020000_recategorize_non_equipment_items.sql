-- Registros capturados como "equipos" que en realidad son accesorios,
-- refacciones o insumos. Se conserva SKU, existencias, series y lotes.
-- El trigger inventory_items_enforce_category_rules exige cambiar
-- item_kind y category a la vez para salir de "equipos".

-- Accesorios (bases, soportes, cables, carros)
--   EQ-47  Radical Docking Station RDS-3 (9171)
--   EQ-46  Radical Docking Station (9172)
--   ACC-24 Radical Docking Station RDS-3 (9023)
--   EQ-5   Mounting arm with basket
--   EQ-22  Bair Hugger Rolling Cart
--   EQ-19  Cable adaptador EtCO2 Vista 120
--   EQ-18  Infinity Dock Station CAN/MIB
update public.inventory_items
set category = 'accesorios',
    item_kind = 'producto'
where category = 'equipos'
  and sku in ('EQ-47', 'EQ-46', 'ACC-24', 'EQ-5', 'EQ-22', 'EQ-19', 'EQ-18');

-- Manual impreso: accesorio sin control por serie (no tiene series registradas)
--   EQ-23  Instrucciones de uso IntelliVue MX100/X3
update public.inventory_items
set category = 'accesorios',
    item_kind = 'producto',
    tracks_serial = false
where category = 'equipos'
  and sku = 'EQ-23';

-- Refacciones (licencias / herramientas de actualización Rainbow)
--   REF-7  Full Rainbow License
--   REF-8  Field Upgrader Rainbow PVi
update public.inventory_items
set category = 'refacciones',
    item_kind = 'producto'
where category = 'equipos'
  and sku in ('REF-7', 'REF-8');

-- Insumo consumible: lote y caducidad (los activa el trigger), sin serie por pieza
--   EQ-16  Pads para desfibrilador (M5072A)
update public.inventory_items
set category = 'insumos',
    item_kind = 'producto',
    tracks_serial = false
where category = 'equipos'
  and sku = 'EQ-16';
