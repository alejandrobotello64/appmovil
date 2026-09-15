-- Datos iniciales para despliegue en nube (idempotente)

insert into public.app_users (username, password_hash, full_name, role)
values (
  'alejandro.botelloaz@hotmail.com',
  extensions.crypt('admin123', extensions.gen_salt('bf')),
  'Administrador MAS',
  'admin'
)
on conflict (username) do nothing;

insert into public.inventory_items (
  sku, name, category, item_kind, quantity, min_stock, unit, location,
  brand, model, serial_number, unit_price, supplier, expiry_date, asset_status
) values
  ('INS-001', 'Guantes de nitrilo talla M', 'insumos', 'producto', 48, 10, 'caja', 'Almacén A - Estante 2', 'MediPro', '', '', 185.00, 'Distribuidora Médica MX', '2027-06-30', 'operativo'),
  ('REF-014', 'Sensor de oxígeno O2', 'refacciones', 'producto', 3, 2, 'pieza', 'Almacén B - Refacciones', 'Philips', 'M1026A', '', 4200.00, 'Philips Healthcare', null, 'operativo'),
  ('MED-008', 'Solución salina 0.9% 500ml', 'medicamentos', 'producto', 120, 30, 'frasco', 'Farmacia - Refrigerado', 'Pisa', '', '', 28.00, 'Laboratorios Pisa', '2026-11-15', 'operativo'),
  ('ACC-022', 'Cable ECG 10 derivaciones', 'accesorios', 'producto', 8, 3, 'pieza', 'Almacén A - Accesorios', 'GE Healthcare', 'MAC 2000', '', 890.00, 'GE Healthcare México', null, 'operativo'),
  ('EQP-003', 'Monitor de signos vitales', 'equipos', 'equipo', 2, 1, 'pieza', 'Bodega equipos', 'Mindray', 'ePM 12M', 'MDY-2024-8812', 85000.00, 'Mindray México', null, 'operativo'),
  ('REA-005', 'Tiras reactivas glucosa', 'reactivos', 'producto', 5, 8, 'caja', 'Almacén A - Reactivos', 'Accu-Chek', 'Performa', '', 420.00, 'Roche Diagnostics', '2026-04-20', 'operativo')
on conflict (sku) do nothing;
