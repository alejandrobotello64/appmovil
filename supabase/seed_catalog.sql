-- Catálogo real de MAS. Generado desde la base local (589 productos).
-- Idempotente: inserta o actualiza por sku. No borra filas extra.
-- La existencia (quantity) solo se carga en SKU nuevos; no pisa stock ya existente.
-- Regenerar: bash scripts/export-catalog.sh

begin;
alter table public.inventory_items disable trigger inventory_items_protect_quantity;

insert into public.inventory_items (
  sku,
  name,
  category,
  item_kind,
  description,
  quantity,
  min_stock,
  unit,
  location,
  brand,
  model,
  serial_number,
  unit_price,
  supplier,
  expiry_date,
  manufactured_at,
  notes,
  asset_status,
  last_maintenance_date,
  next_maintenance_date,
  is_active,
  tracks_lot,
  tracks_serial,
  tracks_expiry,
  max_stock,
  reorder_point,
  part_number,
  manufacturer,
  subcategory
) values
  ('ACCESORIOS-000001', 'Válvula de espiración, PatientSys', 'accesorios', 'producto', 'Válvula respiratoria ', 22, 0, 'pieza', 'A/1', 'Dräger', '', 'N/A', 0.0, 'Drager', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8410580', 'Drager', ''),
  ('ACCESORIOS-000002', 'Adaptador de calentador de tubo', 'accesorios', 'producto', '', 126, 0, 'pieza', 'A/1', 'Dräger', 'Drager ', '', 46.0, 'Drager', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8414968', 'Drager', ''),
  ('ACCESORIOS-000003', 'Probe 3, skin temp, reusable', 'accesorios', 'producto', '', 51, 0, 'pieza', 'A/2', 'Dräger', 'Drager', '2152-01', 0.0, 'Drager', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MU11225', 'Drager', ''),
  ('ACCESORIOS-000004', 'Probe skin 3, skin temp, reusable', 'accesorios', 'producto', '', 2, 0, 'pieza', 'A/2', 'Dräger', 'Drager', '2145-02', 0.0, 'Drager', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MU11225', 'Drager', ''),
  ('ACCESORIOS-000005', 'Probe 3, skin temp, reusable', 'accesorios', 'producto', '', 3, 0, 'pieza', 'A/2', 'Dräger', '', '2217-01', 0.0, 'Drager', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2217-01', 'Drager', ''),
  ('ACCESORIOS-000006', 'Temperature probe skin 3m', 'accesorios', 'producto', '', 1, 0, 'pieza', 'A/2', 'Dräger', '', '', 0.0, 'Drager ', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '', 'Drager', ''),
  ('ACCESORIOS-000007', 'Red PC-12 – Cable paciente LNOP 20 pines, 12 ft', 'accesorios', 'producto', '', 4, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2016-09-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2060', 'Masimo', ''),
  ('ACCESORIOS-000008', 'LNCS DCIP – Sensor reutilizable pediátrico/dedo delgado, 3 ft', 'accesorios', 'producto', '', 119, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2018-12-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '1864', 'Masimo', ''),
  ('ACCESORIOS-000009', 'RD rainbow SET R25-12 – Cable paciente 25 pines, 12 ft', 'accesorios', 'producto', '', 7, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2025-02-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '4078', 'Masimo', ''),
  ('ACCESORIOS-000010', 'Rainbow RC-4 – Cable paciente 20 pines, 4 ft', 'accesorios', 'producto', '', 25, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2017-10-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2406', 'Masimo', ''),
  ('ACCESORIOS-000011', 'Rainbow RC-1 – Cable paciente 20 pines, 1 ft', 'accesorios', 'producto', '', 60, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2017-05-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2405', 'Masimo', ''),
  ('ACCESORIOS-000012', 'Clamp (sujetador) para módulo SedLine', 'accesorios', 'producto', '', 47, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2026-01-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '4574', 'Masimo', ''),
  ('ACCESORIOS-000013', 'Clamp para módulo O3 de oximetría regional', 'accesorios', 'producto', '', 10, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2026-02-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '4575', 'Masimo', ''),
  ('ACCESORIOS-000014', 'Cable de transferencia de datos Red 20 pines (Rad-57/Rad-5/Pronto a PC)', 'accesorios', 'producto', '', 25, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2019-06-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2063', 'Masimo', ''),
  ('ACCESORIOS-000015', 'Spacelabs Replacement Cable', 'accesorios', 'producto', '', 7, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2016-09-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2335', 'Masimo', ''),
  ('ACCESORIOS-000016', 'rainbow DCI SC-1000 – Sensor adulto SpO2/SpHb/SpMet, 1000 mediciones', 'accesorios', 'producto', '', 1, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '3647', 'Masimo', ''),
  ('ACCESORIOS-000017', 'LNCS DCI – Sensor reutilizable adulto de clip para dedo, 3 ft', 'accesorios', 'producto', '', 215, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2020-05-04', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '1863', 'Masimo', ''),
  ('ACCESORIOS-000018', 'RD SET MP-12 – Cable paciente para Philips IntelliVue, 12 ft', 'accesorios', 'producto', '', 48, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2025-02-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '4083', 'Masimo', ''),
  ('ACCESORIOS-000019', 'LNC-4 – Cable paciente LNCS, 4 ft (14 pines)', 'accesorios', 'producto', '', 15, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2025-10-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2017', 'Masimo', ''),
  ('ACCESORIOS-000020', 'RD SET DCI-P – Sensor reutilizable pediátrico de clip', 'accesorios', 'producto', '', 10, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2023-09-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '4051', 'Masimo', ''),
  ('ACCESORIOS-000021', 'LNC MP-10 – Cable paciente LNCS para Philips IntelliVue (IVM/MMS), 10 ft', 'accesorios', 'producto', '', 37, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2025-11-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2281', 'Masimo', ''),
  ('ACCESORIOS-000022', 'Herramienta de prueba para RD SedLine Tester', 'accesorios', 'producto', '', 4, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2025-08-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '4554', 'Masimo', ''),
  ('ACCESORIOS-000023', 'LNCS DCI – Sensor reutilizable adulto de clip para dedo, 3 ft', 'accesorios', 'producto', '', 0, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, false, true, false, false, 0, 0, '1863', 'Masimo', ''),
  ('ACCESORIOS-000024', 'Radical Docking Station RDS-3 signal extraction pulse oximeter', 'accesorios', 'producto', '', 0, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2017-10-01', '', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '9023', 'Masimo', ''),
  ('ACCESORIOS-000025', 'RED LNC-10 Patient Cable 10ft.', 'accesorios', 'producto', '', 31, 0, 'pieza', '', 'Masimo', 'Masimo', '', 0.0, 'Masimo', NULL, '2020-12-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2056', 'Masimo', ''),
  ('ACCESORIOS-000026', 'RD RAINBOW SET MD20-12 RD Rainbow SET Series Patient Cable', 'accesorios', 'producto', '', 12, 0, 'pieza', '', 'Masimo', 'Masimo', '', 0.0, 'Masimo', NULL, '2023-02-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '4073', '', ''),
  ('ACCESORIOS-000027', 'Rainbow RC-12 Rainbow Patient Cable 12ft.', 'accesorios', 'producto', '', 1, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2404', 'Masimo', ''),
  ('ACCESORIOS-000028', 'Red LNC M20-04 LNCS Patient Cable 4ft.', 'accesorios', 'producto', '', 2, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2020-09-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '4252', 'Masimo', ''),
  ('ACCESORIOS-000029', 'Accessory handheld lock for use with Radical 7 Color Screen signal extraction pulse oximeter', 'accesorios', 'producto', '', 37, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2350', 'Masimo', ''),
  ('ACCESORIOS-000030', 'Rainbow M20-01 Rainbow Patient Cable', 'accesorios', 'producto', '', 0, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '4236', 'Masimo', ''),
  ('ACCESORIOS-000031', 'RD Rainbow Set M20-12 RD Rainbow SET Series Patient Cable', 'accesorios', 'producto', '', 11, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2024-07-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '4257', 'Masimo', ''),
  ('ACCESORIOS-000032', 'RD SedLine Patient Cable', 'accesorios', 'producto', '', 15, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2023-03-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '4298', 'Masimo', ''),
  ('ACCESORIOS-000033', 'LNOP DCIP Pediatric/slender digital SpO2 Reusable Sensor', 'accesorios', 'producto', '', 3, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '1276', 'Masimo', ''),
  ('ACCESORIOS-000034', 'LNCS TC-I SpO2 Reusable Ear Sensor', 'accesorios', 'producto', '', 1, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '1895', 'Masimo', ''),
  ('ACCESORIOS-000035', 'LNCS TF-I SpO2 Adult Reusable Forehead Sensor', 'accesorios', 'producto', '', 1, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '1896', 'Masimo', ''),
  ('ACCESORIOS-000036', 'ProCal+ SpO2 extension Cable, 2m', 'accesorios', 'producto', '', 1, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2014', 'Masimo', ''),
  ('ACCESORIOS-000037', 'Demonstration Tool, 30 min', 'accesorios', 'producto', '', 9, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2389', 'Masimo', ''),
  ('ACCESORIOS-000038', 'Accessory handheld lock key for use with Radical 7 Color Screen signal extraction pulse oximeter', 'accesorios', 'producto', '', 3, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2351', 'Masimo', ''),
  ('ACCESORIOS-000039', 'Cubrebocas', 'accesorios', 'producto', 'Presentación: CAJA/ 20 PIEZAS', 1, 0, 'caja', '', '3M', '', '', 0.0, '', NULL, NULL, 'CUBREBOCAS
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '1860', '3M', ''),
  ('ACCESORIOS-000040', 'Auto-Reader', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', '3M', '', '', 0.0, '', NULL, NULL, 'AUTO-READER
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '390G', '3M', ''),
  ('ACCESORIOS-000041', 'Sábana térmica adulto', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', '3M', '', '', 0.0, '', NULL, NULL, '(SABANA TERMICA ADULT)
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '54500', '3M', ''),
  ('ACCESORIOS-000042', 'Manta térmica pediátrica', 'accesorios', 'producto', 'Presentación: CAJA/ 10 PIEZAS', 4, 0, 'caja', '', '3M', '', '', 0.0, '', NULL, NULL, 'MANTA TERMICA PEDIATRICA
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '55000', '3M', ''),
  ('ACCESORIOS-000043', 'Cubrebocas', 'accesorios', 'producto', 'Presentación: BOLSA/75', 7, 0, 'paquete', '', '3M', '', '', 0.0, '', NULL, NULL, 'CUBREBOCAS
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '9010', '3M', ''),
  ('ACCESORIOS-000044', 'Broche De Pared Bomba De Pie', 'accesorios', 'producto', 'Presentación: PIEZA', 14, 0, 'pieza', '', '3M', '', '', 0.0, '', NULL, NULL, 'BROCHE DE PARED BOMBA DE PIE
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '9201', '3M', ''),
  ('ACCESORIOS-000045', 'Foaming White Bracket', 'accesorios', 'producto', 'Presentación: CAJA/ 16 PIEZAS', 2, 0, 'caja', '', '3M', '', '', 0.0, '', NULL, NULL, 'FOAMING WHITE BRACKET
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '9246', '3M', ''),
  ('ACCESORIOS-000046', 'Clean, Trace', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', '3M', '', '', 0.0, '', NULL, NULL, 'CLEAN, TRACE
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'LX25', '3M', ''),
  ('ACCESORIOS-000047', 'NIBP cuff, child', 'accesorios', 'producto', 'Presentación: PIEZA', 6, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '01.57.40018-11', 'Dräger', ''),
  ('ACCESORIOS-000048', 'Cardiac Output Cable', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '01.57.471012-12', 'Dräger', ''),
  ('ACCESORIOS-000049', 'Manguito Nbp, Niño 16cm-21.6cm, Reutilizable', 'accesorios', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '01.57.471442', 'Dräger', ''),
  ('ACCESORIOS-000050', 'Power cord USA/J 10 A 3m GR RoHS', 'accesorios', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '1841793-04', 'Dräger', ''),
  ('ACCESORIOS-000051', 'Sim-Card Usb Stick Rohs', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '1868039', 'Dräger', ''),
  ('ACCESORIOS-000052', 'Temperature Cable', 'accesorios', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2021700', 'Dräger', ''),
  ('ACCESORIOS-000053', 'Breathing Bag 1.5 L With Hole', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2165775-10', 'Dräger', ''),
  ('ACCESORIOS-000054', 'Atembeutel 0.5l Iso-Silicone', 'accesorios', 'producto', 'Presentación: PIEZA', 25, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2166054', 'Dräger', ''),
  ('ACCESORIOS-000055', 'Bolsa de respiración 2.3 L, silicona', 'accesorios', 'producto', 'Presentación: PIEZA', 40, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2166062', 'Dräger', ''),
  ('ACCESORIOS-000056', 'Breathing Bag 3.0 L, Silicone', 'accesorios', 'producto', 'Presentación: PIEZA', 19, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2166070', 'Dräger', ''),
  ('ACCESORIOS-000057', 'Bolsa de respiración 1.5 L, silicona', 'accesorios', 'producto', 'Presentación: PIEZA', 18, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2166127', 'Dräger', ''),
  ('ACCESORIOS-000058', 'Mounting plate roll stand', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2601146', 'Dräger', ''),
  ('ACCESORIOS-000059', 'Cardiac Output Cable', 'accesorios', 'producto', 'Presentación: PIEZA', 9, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2601189', 'Dräger', ''),
  ('ACCESORIOS-000060', 'Tubo Nibp 3m', 'accesorios', 'producto', 'Presentación: PIEZA', 13, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2601195', 'Dräger', ''),
  ('ACCESORIOS-000061', 'Sonda de temperatura cutánea (skin temp probe)', 'accesorios', 'producto', 'Presentación: PIEZA', 34, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2601197', 'Dräger', ''),
  ('ACCESORIOS-000062', 'Temperature Probe Rectal/Oral', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2601198', 'Dräger', ''),
  ('ACCESORIOS-000063', 'Temp. Probe Neonatal, Skin 3m', 'accesorios', 'producto', 'Presentación: PIEZA', 8, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2601200', 'Dräger', ''),
  ('ACCESORIOS-000064', 'IBP transducer adapter cable, Baxter/Edwards, 2m', 'accesorios', 'producto', 'Presentación: PIEZA', 6, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2601221', 'Dräger', ''),
  ('ACCESORIOS-000065', 'Ibp Transducer Adapter Cable, Argon/Bd/Ohmeda, 2m', 'accesorios', 'producto', 'Presentación: PIEZA', 6, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2601223', 'Dräger', ''),
  ('ACCESORIOS-000066', 'Cable Para V300- V500- V500', 'accesorios', 'producto', 'Presentación: PIEZA', 6, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2603245', 'Dräger', ''),
  ('ACCESORIOS-000067', 'Nibp Cuff Infant', 'accesorios', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2606151', 'Dräger', ''),
  ('ACCESORIOS-000068', 'NIBP cuff, child', 'accesorios', 'producto', 'Presentación: PIEZA', 0, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2606153', 'Dräger', ''),
  ('ACCESORIOS-000069', 'Manguito Adulto', 'accesorios', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2606155', 'Dräger', ''),
  ('ACCESORIOS-000070', 'Nibp Cuff Larger Adult', 'accesorios', 'producto', 'Presentación: PIEZA', 17, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2606156', 'Dräger', ''),
  ('ACCESORIOS-000071', 'Rechargeable Li.ion Battery', 'accesorios', 'producto', 'Presentación: PIEZA', 14, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2606229', 'Dräger', ''),
  ('ACCESORIOS-000072', 'Power Cord North America', 'accesorios', 'producto', 'Presentación: PIEZA', 7, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2606235', 'Dräger', ''),
  ('ACCESORIOS-000073', 'Spo2 De Adulto', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2606434', 'Dräger', ''),
  ('ACCESORIOS-000074', 'Sensor De Dedo Spo2', 'accesorios', 'producto', 'Presentación: PIEZA', 9, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2606483', 'Dräger', ''),
  ('ACCESORIOS-000075', 'Sensor Spo2 De Dedo Adulto 1m Reutilizable', 'accesorios', 'producto', 'Presentación: PIEZA', 42, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2606484', 'Dräger', ''),
  ('ACCESORIOS-000076', 'Spo2 Silicone Soft-Tip Sensor, 1m, Reusable', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2606485', 'Dräger', ''),
  ('ACCESORIOS-000077', 'Spo2 Silicone Soft-Tip Sensor, Pediatric, 1m, Reusable', 'accesorios', 'producto', 'Presentación: PIEZA', 0, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2606486', 'Dräger', ''),
  ('ACCESORIOS-000078', 'SpO2 extension cable, 2m, reusable', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2606487', 'Dräger', ''),
  ('ACCESORIOS-000079', 'Ibp Cable Becton Dickinson', 'accesorios', 'producto', 'Presentación: PIEZA', 34, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2606488', 'Dräger', ''),
  ('ACCESORIOS-000080', 'Ibp Cable Edwards', 'accesorios', 'producto', 'Presentación: PIEZA', 8, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2606489', 'Dräger', '')
on conflict (sku) do update set
  name = excluded.name,
  category = excluded.category,
  item_kind = excluded.item_kind,
  description = excluded.description,
  min_stock = excluded.min_stock,
  unit = excluded.unit,
  location = excluded.location,
  brand = excluded.brand,
  model = excluded.model,
  serial_number = excluded.serial_number,
  unit_price = excluded.unit_price,
  supplier = excluded.supplier,
  expiry_date = excluded.expiry_date,
  manufactured_at = excluded.manufactured_at,
  notes = excluded.notes,
  asset_status = excluded.asset_status,
  last_maintenance_date = excluded.last_maintenance_date,
  next_maintenance_date = excluded.next_maintenance_date,
  is_active = excluded.is_active,
  tracks_lot = excluded.tracks_lot,
  tracks_serial = excluded.tracks_serial,
  tracks_expiry = excluded.tracks_expiry,
  max_stock = excluded.max_stock,
  reorder_point = excluded.reorder_point,
  part_number = excluded.part_number,
  manufacturer = excluded.manufacturer,
  subcategory = excluded.subcategory;

insert into public.inventory_items (
  sku,
  name,
  category,
  item_kind,
  description,
  quantity,
  min_stock,
  unit,
  location,
  brand,
  model,
  serial_number,
  unit_price,
  supplier,
  expiry_date,
  manufactured_at,
  notes,
  asset_status,
  last_maintenance_date,
  next_maintenance_date,
  is_active,
  tracks_lot,
  tracks_serial,
  tracks_expiry,
  max_stock,
  reorder_point,
  part_number,
  manufacturer,
  subcategory
) values
  ('ACCESORIOS-000081', 'Ecg Trunk Cable, 3-Lead, For Neonates, Iec & Aha', 'accesorios', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2606492', 'Dräger', ''),
  ('ACCESORIOS-000082', 'Ecg Limb Wires, 5 Lead, Grabber, Aha', 'accesorios', 'producto', 'Presentación: PIEZA', 26, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2606494', 'Dräger', ''),
  ('ACCESORIOS-000083', 'Cables Ecg Extremidades 5 Derivaciones Grabber Aha', 'accesorios', 'producto', 'Presentación: PIEZA', 16, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2606498', 'Dräger', ''),
  ('ACCESORIOS-000084', 'Temperature Probe Skin, Neonatal/Infant, 3m, Reusable', 'accesorios', 'producto', 'Presentación: PIEZA', 23, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2607006', 'Dräger', ''),
  ('ACCESORIOS-000085', 'Nibp Cuff Neo', 'accesorios', 'producto', 'Presentación: CAJA/ 20 PZS', 6, 0, 'caja', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2607035', 'Dräger', ''),
  ('ACCESORIOS-000086', 'Brazalete pediátrico', 'accesorios', 'producto', 'Presentación: CAJA/ 20 PZS', 2, 0, 'caja', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2607037', 'Dräger', ''),
  ('ACCESORIOS-000087', 'ECG 3-lead single pin AHA 1 m', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2612001', 'Dräger', ''),
  ('ACCESORIOS-000088', 'Ecg 5-Leads Pin Aha 1.5m', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2612003', 'Dräger', ''),
  ('ACCESORIOS-000089', 'Cable Troncal Ecg 3/5 Derivaciones 1.5m', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2612020', 'Dräger', ''),
  ('ACCESORIOS-000090', 'Ecg Defib Trunk 3/5 Leads Single Pin 2.5m', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2612021', 'Dräger', ''),
  ('ACCESORIOS-000091', 'Ecg Esu Trunk 3/5 Leads Single Pin 1.5m', 'accesorios', 'producto', 'Presentación: PIEZA', 0, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2612024', 'Dräger', ''),
  ('ACCESORIOS-000092', 'Ecg Neo Defib Trunk 3-Leads 2.5m', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2612027', 'Dräger', ''),
  ('ACCESORIOS-000093', 'Brazalete Nibp Neonatal #3 5.8-15cm', 'accesorios', 'producto', 'Presentación: BOLSA/10 PZA', 75, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2870173', 'Dräger', ''),
  ('ACCESORIOS-000094', 'Manguito Nibp Neonatal', 'accesorios', 'producto', 'Presentación: BOLSA/10 PZA', 20, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2870181', 'Dräger', ''),
  ('ACCESORIOS-000095', 'Brazalete Nibp Neonatal #2 4.3-8cm', 'accesorios', 'producto', 'Presentación: BOLSA/10 PZA', 19, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2870199', 'Dräger', ''),
  ('ACCESORIOS-000096', 'Nibp Neo #3 Cuff 5.8-10.9cm', 'accesorios', 'producto', 'Presentación: BOLSA/10 PZA', 49, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2870207', 'Dräger', ''),
  ('ACCESORIOS-000097', 'Brazalete Nibp Neonatal #4 7.1-13.1cm', 'accesorios', 'producto', 'Presentación: BOLSA/10 PZA', 21, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2870215', 'Dräger', ''),
  ('ACCESORIOS-000098', 'Nibp Hose Neonatal Cuff,2.4m', 'accesorios', 'producto', 'Presentación: PIEZA', 20, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2870298', 'Dräger', ''),
  ('ACCESORIOS-000099', 'SOPORTE', 'accesorios', 'producto', 'Presentación: BOLSA/10 PZA', 1, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2M12754-00', 'Dräger', ''),
  ('ACCESORIOS-000100', 'Pasatubos para incubadora 8000, reutilizable', 'accesorios', 'producto', 'Presentación: PIEZA', 7, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2M20434', 'Dräger', ''),
  ('ACCESORIOS-000101', 'Fluorescent lamp, blue (Leuchtstofflampe, blau)', 'accesorios', 'producto', 'Presentación: PIEZA', 9, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2M21010', 'Dräger', ''),
  ('ACCESORIOS-000102', 'Corner With Surface Finish Ecke M.of', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2M21390', 'Dräger', ''),
  ('ACCESORIOS-000103', 'Hose grommet large', 'accesorios', 'producto', 'Presentación: PIEZA', 24, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '2M50385', 'Dräger', ''),
  ('ACCESORIOS-000104', 'Latiguillos de 5 SG electrocardiograma genérico', 'accesorios', 'producto', 'Presentación: PIEZA', 8, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '3.12.03.001', 'Dräger', ''),
  ('ACCESORIOS-000105', 'Conductive Adhesive Hydrogel', 'accesorios', 'producto', 'Presentación: PAQUETE/ 100 PZS', 2, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '31118733', 'Dräger', ''),
  ('ACCESORIOS-000106', 'Pod Communication Cable 3m', 'accesorios', 'producto', 'Presentación: PIEZA', 19, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '3368425', 'Dräger', ''),
  ('ACCESORIOS-000107', 'Spo2 Nellcor Interm Cable, 1m', 'accesorios', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '3368433', 'Dräger', ''),
  ('ACCESORIOS-000108', 'Spo2 Nellcor Interm Cable, 2m', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '3375834', 'Dräger', ''),
  ('ACCESORIOS-000109', 'Ibp Interm Cable Argon, 3.7m', 'accesorios', 'producto', 'Presentación: PIEZA', 55, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '3375933', 'Dräger', ''),
  ('ACCESORIOS-000110', 'Dedal SpO2 genérico', 'accesorios', 'producto', 'Presentación: PIEZA', 7, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '36.13.001.004', 'Dräger', ''),
  ('ACCESORIOS-000111', 'Manguera Nibps Ge Medical Systems', 'accesorios', 'producto', 'Presentación: PIEZA', 8, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '414873-001', 'Dräger', ''),
  ('ACCESORIOS-000112', 'Multi-Link Ecg Ldwr Sed', 'accesorios', 'producto', 'Presentación: PIEZA', 35, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '416467', 'Dräger', ''),
  ('ACCESORIOS-000113', 'SHP UNT EtCO2 module white', 'accesorios', 'producto', 'Presentación: KIT', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '4319310', 'Dräger', ''),
  ('ACCESORIOS-000114', 'Ibp Interm Cable Sensor 3.7m', 'accesorios', 'producto', 'Presentación: PIEZA', 13, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '4321563', 'Dräger', ''),
  ('ACCESORIOS-000115', 'Sonda De Temperatura Adulto 1.5 M Reutilizable', 'accesorios', 'producto', 'Presentación: PIEZA', 14, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '4329889', 'Dräger', ''),
  ('ACCESORIOS-000116', 'EtCO2 airway adapter adult', 'accesorios', 'producto', 'Presentación: PIEZA', 12, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '4721796', 'Dräger', ''),
  ('ACCESORIOS-000117', 'Ethernet Patch Cable 1.2m', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '4726373', 'Dräger', ''),
  ('ACCESORIOS-000118', 'Ethernet Patch Cable 1.2m', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '4726373-08', 'Dräger', ''),
  ('ACCESORIOS-000119', 'MIB cable Nivus/Julian CO2 genérico', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '493690', 'Dräger', ''),
  ('ACCESORIOS-000120', 'Ecg Neo Adapter Pins', 'accesorios', 'producto', 'Presentación: PAQUETE 10', 10, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '5194779', 'Dräger', ''),
  ('ACCESORIOS-000121', 'Temp Probe Adapter Cable', 'accesorios', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '5198333', 'Dräger', ''),
  ('ACCESORIOS-000122', 'Temp. Probe, Reus, Adult, 3m', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '5204644', 'Dräger', ''),
  ('ACCESORIOS-000123', 'Temp Probe, Reus., Child. 3m', 'accesorios', 'producto', 'Presentación: PIEZA', 23, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '5204651', 'Dräger', ''),
  ('ACCESORIOS-000124', 'Skin Temp Probe Reusable 3m', 'accesorios', 'producto', 'Presentación: PIEZA', 21, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '5204669', 'Dräger', ''),
  ('ACCESORIOS-000125', 'Ibp Y- Cable Baxter, 3.7m', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '5206607', 'Dräger', ''),
  ('ACCESORIOS-000126', 'Hemomed Cable To Monitor 3m', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '5591925', 'Dräger', ''),
  ('ACCESORIOS-000127', 'Ibp Cable Y-Cable 16 To 7 Pin', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '5592147', 'Dräger', ''),
  ('ACCESORIOS-000128', 'Temperature Y-Cable', 'accesorios', 'producto', 'Presentación: PIEZA', 12, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '5592154', 'Dräger', ''),
  ('ACCESORIOS-000129', 'Ecg Neomed Adapter Cable, 1.5 M', 'accesorios', 'producto', 'Presentación: PIEZA', 15, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '5592162', 'Dräger', ''),
  ('ACCESORIOS-000130', 'Eeg Leads 0.6m, Reusable, 9pc.', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '5947804', 'Dräger', ''),
  ('ACCESORIOS-000131', 'Multimed 5 Pod, 1.5 M', 'accesorios', 'producto', 'Presentación: PIEZA', 36, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '5950196', 'Dräger', ''),
  ('ACCESORIOS-000132', 'Block F.eeg Ref Id Conversion', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '5954859', 'Dräger', ''),
  ('ACCESORIOS-000133', 'Adaptador En T Adulto', 'accesorios', 'producto', 'Presentación: PIEZA', 9, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '60-032', 'Dräger', ''),
  ('ACCESORIOS-000134', 'Reusable bipolar cord, 12 ft (3.6m) genérico', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '60-8046-001', 'Dräger', ''),
  ('ACCESORIOS-000135', 'Microfilter', 'accesorios', 'producto', 'Presentación: PIEZA', 23, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '6737545', 'Dräger', ''),
  ('ACCESORIOS-000136', 'In-line injection temp. probe', 'accesorios', 'producto', 'Presentación: PIEZA', 14, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '684056', 'Dräger', ''),
  ('ACCESORIOS-000137', 'Co2-Cuvette Erw', 'accesorios', 'producto', 'Presentación: PIEZA', 11, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '6870279', 'Dräger', ''),
  ('ACCESORIOS-000138', 'Co2-Cuvette (Cubeta Co2)', 'accesorios', 'producto', 'Presentación: PIEZA', 31, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '6870280', 'Dräger', ''),
  ('ACCESORIOS-000139', 'Mainstream Sensor', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '6871500', 'Dräger', ''),
  ('ACCESORIOS-000140', 'Mcable-Mainstream Co2 (Sensor Co2 Mainstream)', 'accesorios', 'producto', 'Presentación: PIEZA', 11, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '6871950', 'Dräger', ''),
  ('ACCESORIOS-000141', 'Infinity Id Flow Sensor', 'accesorios', 'producto', 'Presentación: PAQUETE/5', 20, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '6871980', 'Dräger', ''),
  ('ACCESORIOS-000142', 'Infinity ID WaterLock 2', 'accesorios', 'producto', 'Presentación: PAQUETE/12 PIEZAS', 1, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '6872020', 'Dräger', ''),
  ('ACCESORIOS-000143', '01-Sensor Oxycell A', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '6872666', 'Dräger', ''),
  ('ACCESORIOS-000144', 'Trulink Ecg Lead Wire Set Shielded, 5 Lead', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '700-0006-08', 'Dräger', ''),
  ('ACCESORIOS-000145', 'Trulink Ecg Lead Wire Set Shielded, 5 Lead', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '700-0006-16', 'Dräger', ''),
  ('ACCESORIOS-000146', 'Protective Covers Temp', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '7014616', 'Dräger', ''),
  ('ACCESORIOS-000147', 'Pod Communication Cable 3m', 'accesorios', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '7257988', 'Dräger', ''),
  ('ACCESORIOS-000148', 'Cardiac Output Kit Argon', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '7265163', 'Dräger', ''),
  ('ACCESORIOS-000149', 'Shp Acc Masimo Lnop Dcip Reuse', 'accesorios', 'producto', 'Presentación: PIEZA', 22, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '7270304', 'Dräger', ''),
  ('ACCESORIOS-000150', 'Shp Acc Masimo Lnop Dcip Reuse', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '7270304-02', 'Dräger', ''),
  ('ACCESORIOS-000151', 'Shp Acc Masimo Lnop Dcip Reuse', 'accesorios', 'producto', 'Presentación: PIEZA', 8, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '7270304-1', 'Dräger', ''),
  ('ACCESORIOS-000152', 'Sensor Spo2 Masimo Lnop Dcip Reutilizable', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '7270312', 'Dräger', ''),
  ('ACCESORIOS-000153', 'Mibii Proto Conv-Ls', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '7356931', 'Dräger', ''),
  ('ACCESORIOS-000154', 'Sensor Spo2 Masimo Adhesivo Cuadrado 12 Pzs', 'accesorios', 'producto', 'Presentación: PIEZA', 9, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '7496875', 'Dräger', ''),
  ('ACCESORIOS-000155', 'Ecg 3-Lead Trust Ahu/Us, Telem Latex Free', 'accesorios', 'producto', 'Presentación: PIEZA', 42, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '7499812', 'Dräger', ''),
  ('ACCESORIOS-000156', 'Etco2 Airw Adaptr Microstr N/P', 'accesorios', 'producto', 'Presentación: KIT', 4, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '7869550', 'Dräger', ''),
  ('ACCESORIOS-000157', 'Interm Cbl Trident (Nmt), 1.9m', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '7872174', 'Dräger', ''),
  ('ACCESORIOS-000158', 'Thumb adapter for acceleration transduction', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '79950152', 'Dräger', ''),
  ('ACCESORIOS-000159', 'Acceleration transducer', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '79950163', 'Dräger', ''),
  ('ACCESORIOS-000160', 'Oxiband Sensor A/N', 'accesorios', 'producto', 'Presentación: PIEZA', 11, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8201013', 'Dräger', '')
on conflict (sku) do update set
  name = excluded.name,
  category = excluded.category,
  item_kind = excluded.item_kind,
  description = excluded.description,
  min_stock = excluded.min_stock,
  unit = excluded.unit,
  location = excluded.location,
  brand = excluded.brand,
  model = excluded.model,
  serial_number = excluded.serial_number,
  unit_price = excluded.unit_price,
  supplier = excluded.supplier,
  expiry_date = excluded.expiry_date,
  manufactured_at = excluded.manufactured_at,
  notes = excluded.notes,
  asset_status = excluded.asset_status,
  last_maintenance_date = excluded.last_maintenance_date,
  next_maintenance_date = excluded.next_maintenance_date,
  is_active = excluded.is_active,
  tracks_lot = excluded.tracks_lot,
  tracks_serial = excluded.tracks_serial,
  tracks_expiry = excluded.tracks_expiry,
  max_stock = excluded.max_stock,
  reorder_point = excluded.reorder_point,
  part_number = excluded.part_number,
  manufacturer = excluded.manufacturer,
  subcategory = excluded.subcategory;

insert into public.inventory_items (
  sku,
  name,
  category,
  item_kind,
  description,
  quantity,
  min_stock,
  unit,
  location,
  brand,
  model,
  serial_number,
  unit_price,
  supplier,
  expiry_date,
  manufactured_at,
  notes,
  asset_status,
  last_maintenance_date,
  next_maintenance_date,
  is_active,
  tracks_lot,
  tracks_serial,
  tracks_expiry,
  max_stock,
  reorder_point,
  part_number,
  manufacturer,
  subcategory
) values
  ('ACCESORIOS-000161', 'Spirolog flow sensor', 'accesorios', 'producto', 'Presentación: PAQUETE/5', 5, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '84010179', 'Dräger', ''),
  ('ACCESORIOS-000162', 'Juego De Tapas (Set Of Caps)', 'accesorios', 'producto', 'Presentación: PIEZA', 20, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8402953-02', 'Dräger', ''),
  ('ACCESORIOS-000163', 'Pieza en Y con abertura de aspiración', 'accesorios', 'producto', 'Presentación: PIEZA', 10, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8403075', 'Dräger', ''),
  ('ACCESORIOS-000164', 'Test lung (Testlunge)', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8403208', 'Dräger', ''),
  ('ACCESORIOS-000165', 'Set Stand Cone P Plastic', 'accesorios', 'producto', 'Presentación: PAQUETE/10 PZS', 4, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8403684', 'Dräger', ''),
  ('ACCESORIOS-000166', 'Sensor De Flujo Spirolog', 'accesorios', 'producto', 'Presentación: PAQUETE/5', 24, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8403735', 'Dräger', ''),
  ('ACCESORIOS-000167', 'Temperature Sensor', 'accesorios', 'producto', 'Presentación: PIEZA', 6, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8405371-21', 'Dräger', ''),
  ('ACCESORIOS-000168', 'Test Lung, Kompl', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8409742-07', 'Dräger', ''),
  ('ACCESORIOS-000169', 'Test Lung, Cpl', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8409742-10', 'Dräger', ''),
  ('ACCESORIOS-000170', 'Pulmón de prueba silicona N con tubo flexible', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8410079', 'Dräger', ''),
  ('ACCESORIOS-000171', 'Neonatal Flow Sensor Insert', 'accesorios', 'producto', 'Presentación: CAJA/5 PZA', 22, 0, 'caja', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8410179', 'Dräger', ''),
  ('ACCESORIOS-000172', 'Tapón sellante (sealing plug)', 'accesorios', 'producto', 'Presentación: PAQUETE/5 PZS', 3, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8411024', 'Dräger', ''),
  ('ACCESORIOS-000173', 'Accessories nebuliser BO 8000', 'accesorios', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8411031', 'Dräger', ''),
  ('ACCESORIOS-000174', 'Draw Wire', 'accesorios', 'producto', 'Presentación: PIEZA', 53, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8411050', 'Dräger', ''),
  ('ACCESORIOS-000175', 'Juego de fijación para humidificador', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8411074', 'Dräger', ''),
  ('ACCESORIOS-000176', 'Calentador De Tubos Para F&p Mr 700/730, 70cm', 'accesorios', 'producto', 'Presentación: PIEZA', 14, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8411154', 'Dräger', ''),
  ('ACCESORIOS-000177', 'Flow Sensor', 'accesorios', 'producto', 'Presentación: PIEZA', 18, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8412034', 'Dräger', ''),
  ('ACCESORIOS-000178', '90° Winkeltuelle', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8412235', 'Dräger', ''),
  ('ACCESORIOS-000179', 'Nebulizador Hose', 'accesorios', 'producto', 'Presentación: PIEZA', 8, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8412985', 'Dräger', ''),
  ('ACCESORIOS-000180', 'Kit Neoflow', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8413563-25', 'Dräger', ''),
  ('ACCESORIOS-000181', 'ID expiration valve complete', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8413660', 'Dräger', ''),
  ('ACCESORIOS-000182', 'Blueset Heated (N)', 'accesorios', 'producto', 'Presentación: KIT', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8414987', 'Dräger', ''),
  ('ACCESORIOS-000183', 'Safety Valve', 'accesorios', 'producto', 'Presentación: PIEZA', 23, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8415195', 'Dräger', ''),
  ('ACCESORIOS-000184', 'Válvula espiratoria Infinity ID reutilizable (Babylog VN500)', 'accesorios', 'producto', 'Presentación: PIEZA', 46, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8415270', 'Dräger', ''),
  ('ACCESORIOS-000185', 'Expiration Valve Reuse', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8415296', 'Dräger', ''),
  ('ACCESORIOS-000186', 'Standby Holder W/O Calibration', 'accesorios', 'producto', 'Presentación: PIEZA', 6, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8416352', 'Dräger', ''),
  ('ACCESORIOS-000187', 'Válvula espiratoria ID reutilizable (Evita Infinity V500)', 'accesorios', 'producto', 'Presentación: PIEZA', 38, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8416750', 'Dräger', ''),
  ('ACCESORIOS-000188', 'Válvula espiratoria ID completa', 'accesorios', 'producto', 'Presentación: PIEZA', 16, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8417050', 'Dräger', ''),
  ('ACCESORIOS-000189', 'Medikamente Vernebler P', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8418054-02', 'Dräger', ''),
  ('ACCESORIOS-000190', 'Headband Xs', 'accesorios', 'producto', 'Presentación: BOLSA/5', 5, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8418418', 'Dräger', ''),
  ('ACCESORIOS-000191', 'Headband Xxl', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8418423', 'Dräger', ''),
  ('ACCESORIOS-000192', 'Adapter-Schlauchheizung', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8418433-03', 'Dräger', ''),
  ('ACCESORIOS-000193', 'Adaptador de calentador de tubo', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8418462-01', 'Dräger', ''),
  ('ACCESORIOS-000194', 'Humidifier MR850JSU 115V', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8418523', 'Dräger', ''),
  ('ACCESORIOS-000195', 'CAP XS', 'accesorios', 'producto', 'Presentación: BOLSA/5', 3, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8418533-04', 'Dräger', ''),
  ('ACCESORIOS-000196', 'Cap S (Small 5pcs)', 'accesorios', 'producto', 'Presentación: PIEZA', 14, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8418534', 'Dräger', ''),
  ('ACCESORIOS-000197', 'Cap M (Medium, 5 Pcs.)', 'accesorios', 'producto', 'Presentación: BOLSA/5 PZAS', 12, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8418535', 'Dräger', ''),
  ('ACCESORIOS-000198', 'Cap L (Large 5pcs)', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8418536', 'Dräger', ''),
  ('ACCESORIOS-000199', 'Cap Xl (Extra Large 5 Pcs)', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8418537', 'Dräger', ''),
  ('ACCESORIOS-000200', 'Cap Xxl(Ex.ex.large (5pcs)', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8418538', 'Dräger', ''),
  ('ACCESORIOS-000201', 'Cap Xxl Plus 5pcs)', 'accesorios', 'producto', 'Presentación: PIEZA', 11, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8418539', 'Dräger', ''),
  ('ACCESORIOS-000202', 'Neomask L', 'accesorios', 'producto', 'Presentación: CAJA/ 10 PZS', 2, 0, 'caja', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8418619', 'Dräger', ''),
  ('ACCESORIOS-000203', 'Kit mandatory minute ventilation', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '8420432', 'Dräger', ''),
  ('ACCESORIOS-000204', 'Monitoring Line Set', 'accesorios', 'producto', 'Presentación: KIT', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '844-26', 'Dräger', ''),
  ('ACCESORIOS-000205', 'Data Cable 2m', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8601473', 'Dräger', ''),
  ('ACCESORIOS-000206', 'Holder For Suction Drive Unit', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8609643', 'Dräger', ''),
  ('ACCESORIOS-000207', 'Kit cylinder wrench', 'accesorios', 'producto', 'Presentación: PIEZA', 6, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '8621198', 'Dräger', ''),
  ('ACCESORIOS-000208', 'Cable de interfaz', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '896140021', 'Dräger', ''),
  ('ACCESORIOS-000209', 'Adaptador De Calentador De Manguera', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '900MR558', 'Dräger', ''),
  ('ACCESORIOS-000210', 'Sonda De Temperatura Para Conductos', 'accesorios', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '900MR569', 'Dräger', ''),
  ('ACCESORIOS-000211', 'Hose Heater Adapter 900 Mr 754', 'accesorios', 'producto', 'Presentación: PIEZA', 14, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '900MR754', 'Dräger', ''),
  ('ACCESORIOS-000212', 'Sensor de temperatura para MR850', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '900MR869', 'Dräger', ''),
  ('ACCESORIOS-000213', 'Airvo 2 Oxygen Inlet Kit', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '900PT422', 'Dräger', ''),
  ('ACCESORIOS-000214', 'Filter Holder Airvo 2', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '900PT912', 'Dräger', ''),
  ('ACCESORIOS-000215', 'Nibp Cuff Neo', 'accesorios', 'producto', 'Presentación: CAJA/ 20 PZS', 1, 0, 'caja', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '98-0400-98', 'Dräger', ''),
  ('ACCESORIOS-000216', 'Solo Pediatric T-Piece 10mm', 'accesorios', 'producto', 'Presentación: PIEZA', 19, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'AG-AS3036', 'Dräger', ''),
  ('ACCESORIOS-000217', 'Manguera para brazalete genérico', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'BRAZGEN1', 'Dräger', ''),
  ('ACCESORIOS-000218', 'Cable de corriente para bomba genérico', 'accesorios', 'producto', 'Presentación: PIEZA', 22, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'CABLEBOM10', 'Dräger', ''),
  ('ACCESORIOS-000219', 'Troncal de SpO2 genérico', 'accesorios', 'producto', 'Presentación: PIEZA', 7, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'CABTRNGEN1.10', 'Dräger', ''),
  ('ACCESORIOS-000220', 'AAMI compatible direct-connect ECG cable, 3 leads snap, adult/pediatric, AHA', 'accesorios', 'producto', 'Presentación: PIEZA', 16, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'CS2340SO', 'Dräger', ''),
  ('ACCESORIOS-000221', 'Reusable Peep 10 Valve', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'D137001000', 'Dräger', ''),
  ('ACCESORIOS-000222', 'Dedal SpO2 de pulsioximetría genérico', 'accesorios', 'producto', 'Presentación: PIEZA', 7, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'DED2POG', 'Dräger', ''),
  ('ACCESORIOS-000223', 'Sensor Spo2 Adulto', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'DS100A', 'Dräger', ''),
  ('ACCESORIOS-000224', 'Cable ECG 3m/10 ft, AAMI genérico', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'ECGGEN1', 'Dräger', ''),
  ('ACCESORIOS-000225', 'Heavy Duty Anchor', 'accesorios', 'producto', 'Presentación: PAQUETE', 1, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'G13568', 'Dräger', ''),
  ('ACCESORIOS-000226', 'Halogen Lamp 700', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'G18339', 'Dräger', ''),
  ('ACCESORIOS-000227', 'Lamp Base', 'accesorios', 'producto', 'Presentación: PIEZA', 6, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'G18362', 'Dräger', ''),
  ('ACCESORIOS-000228', 'Soporte De Humidificador M25.2', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'G93111', 'Dräger', ''),
  ('ACCESORIOS-000229', 'Latiguillos de 3 SG electrocardiograma genérico', 'accesorios', 'producto', 'Presentación: PIEZA', 18, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'LATELECGEN1', 'Dräger', ''),
  ('ACCESORIOS-000230', 'Latiguillos SG electrocardiograma genérico', 'accesorios', 'producto', 'Presentación: PIEZA', 11, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'LATELECGEN1.10', 'Dräger', ''),
  ('ACCESORIOS-000231', 'Packing Ring', 'accesorios', 'producto', 'Presentación: PAQUETE/6 PZA', 1, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'M05128-11', 'Dräger', ''),
  ('ACCESORIOS-000232', 'Double Adapter', 'accesorios', 'producto', 'Presentación: PIEZA', 8, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'M25647', 'Dräger', ''),
  ('ACCESORIOS-000233', '90-Luerlock For Neonates', 'accesorios', 'producto', 'Presentación: PIEZA', 7, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'M34568-01', 'Dräger', ''),
  ('ACCESORIOS-000234', 'Manguera NIBP genérico', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MANGNBPS1', 'Dräger', ''),
  ('ACCESORIOS-000235', 'Medibus.X 3m accessory kit', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MK09270', 'Dräger', ''),
  ('ACCESORIOS-000236', 'Tubo De Conexión Ntp Adulto', 'accesorios', 'producto', 'Presentación: PIEZA', 31, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP00053', 'Dräger', ''),
  ('ACCESORIOS-000237', 'Manguito Nbp Xs, 12-19cm', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP00912', 'Dräger', ''),
  ('ACCESORIOS-000238', 'Nbp Cuff S, 17-25/29cm, Box', 'accesorios', 'producto', 'Presentación: PIEZA', 8, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP00913', 'Dräger', ''),
  ('ACCESORIOS-000239', 'Nbp Cuff M 23-33cm', 'accesorios', 'producto', 'Presentación: PIEZA', 11, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP00917', 'Dräger', ''),
  ('ACCESORIOS-000240', 'Brazalete Nbp L+ 31-40/55cm', 'accesorios', 'producto', 'Presentación: PIEZA', 53, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP00919', 'Dräger', '')
on conflict (sku) do update set
  name = excluded.name,
  category = excluded.category,
  item_kind = excluded.item_kind,
  description = excluded.description,
  min_stock = excluded.min_stock,
  unit = excluded.unit,
  location = excluded.location,
  brand = excluded.brand,
  model = excluded.model,
  serial_number = excluded.serial_number,
  unit_price = excluded.unit_price,
  supplier = excluded.supplier,
  expiry_date = excluded.expiry_date,
  manufactured_at = excluded.manufactured_at,
  notes = excluded.notes,
  asset_status = excluded.asset_status,
  last_maintenance_date = excluded.last_maintenance_date,
  next_maintenance_date = excluded.next_maintenance_date,
  is_active = excluded.is_active,
  tracks_lot = excluded.tracks_lot,
  tracks_serial = excluded.tracks_serial,
  tracks_expiry = excluded.tracks_expiry,
  max_stock = excluded.max_stock,
  reorder_point = excluded.reorder_point,
  part_number = excluded.part_number,
  manufacturer = excluded.manufacturer,
  subcategory = excluded.subcategory;

insert into public.inventory_items (
  sku,
  name,
  category,
  item_kind,
  description,
  quantity,
  min_stock,
  unit,
  location,
  brand,
  model,
  serial_number,
  unit_price,
  supplier,
  expiry_date,
  manufactured_at,
  notes,
  asset_status,
  last_maintenance_date,
  next_maintenance_date,
  is_active,
  tracks_lot,
  tracks_serial,
  tracks_expiry,
  max_stock,
  reorder_point,
  part_number,
  manufacturer,
  subcategory
) values
  ('ACCESORIOS-000241', 'Nbp Cuff Xl, 38-50 Cm', 'accesorios', 'producto', 'Presentación: PIEZA', 7, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP00921', 'Dräger', ''),
  ('ACCESORIOS-000242', 'Nbp Cuff Xs, 12-19cm, Box10', 'accesorios', 'producto', 'Presentación: PAQUETE/ 10 PZS', 3, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP00925', 'Dräger', ''),
  ('ACCESORIOS-000243', 'Brazalete Nbp S 17-25/29cm', 'accesorios', 'producto', 'Presentación: PIEZA', 93, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP00926', 'Dräger', ''),
  ('ACCESORIOS-000244', 'Brazalete Adulto Desechable', 'accesorios', 'producto', 'Presentación: PIEZA', 68, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP00929', 'Dräger', ''),
  ('ACCESORIOS-000245', 'Nbp Adapter, Box10', 'accesorios', 'producto', 'Presentación: PAQUETE/10 PZA', 11, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP00945', 'Dräger', ''),
  ('ACCESORIOS-000246', 'Manguera de extensión adulto 3.7m', 'accesorios', 'producto', 'Presentación: PIEZA', 41, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP00953', 'Dräger', ''),
  ('ACCESORIOS-000247', 'Adaptador de calentador de tubo', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MP01001', 'Dräger', ''),
  ('ACCESORIOS-000248', 'Adaptador De Cable Calentador', 'accesorios', 'producto', 'Presentación: PIEZA', 16, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MP01006', 'Dräger', ''),
  ('ACCESORIOS-000249', 'Temp.probe Housing 900mr532', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MP01007-03', 'Dräger', ''),
  ('ACCESORIOS-000250', 'Adaptador en T adulto con tapón, caja 5', 'accesorios', 'producto', 'Presentación: PIEZA', 100, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MP01031', 'Dräger', ''),
  ('ACCESORIOS-000251', 'Adaptador en T neonatal con tapón, caja 5', 'accesorios', 'producto', 'Presentación: PIEZA', 69, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MP01032', 'Dräger', ''),
  ('ACCESORIOS-000252', 'Disposable Co2 Cuvette, Adult', 'accesorios', 'producto', 'Presentación: PIEZA', 8, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP01062', 'Dräger', ''),
  ('ACCESORIOS-000253', 'Neonate T-Adapter W,Plug,Box5 T-Adapter M.ver (Neon.),Box5', 'accesorios', 'producto', 'Presentación: PIEZA', 15, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MP01232', 'Dräger', ''),
  ('ACCESORIOS-000254', 'Set Chico', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP01415', 'Dräger', ''),
  ('ACCESORIOS-000255', 'Set, Klein', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP01418', 'Dräger', ''),
  ('ACCESORIOS-000256', 'Softconnector N', 'accesorios', 'producto', 'Presentación: PIEZA', 16, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP01456', 'Dräger', ''),
  ('ACCESORIOS-000257', 'NEO MASK 4', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP01480', 'Dräger', ''),
  ('ACCESORIOS-000258', 'Headgear Reusable Silicone Small', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP01557', 'Dräger', ''),
  ('ACCESORIOS-000259', 'Kopfband Einweg, Weiches Gummi, Klein', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP01561', 'Dräger', ''),
  ('ACCESORIOS-000260', 'Kopfband Einweg, Weiches Gummi, Gross', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP01562', 'Dräger', ''),
  ('ACCESORIOS-000261', '2 Side Pump Ball For Air Management', 'accesorios', 'producto', 'Presentación: PIEZA', 29, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MP01590-02', 'Dräger', ''),
  ('ACCESORIOS-000262', '2 Side Pump Ball For Air Management', 'accesorios', 'producto', 'Presentación: PIEZA', 29, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MP01590-1', 'Dräger', ''),
  ('ACCESORIOS-000263', 'Mask LiteStar 2 w/o hook', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP01702', 'Dräger', ''),
  ('ACCESORIOS-000264', 'Mask LiteStar 5 w/o hook', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP01705', 'Dräger', ''),
  ('ACCESORIOS-000265', 'Pulmón de prueba para comprobación de equipo', 'accesorios', 'producto', 'Presentación: PIEZA', 27, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP02400RI09', 'Dräger', ''),
  ('ACCESORIOS-000266', 'Cubierta De Incubadora Babyleo', 'accesorios', 'producto', 'Presentación: PIEZA', 25, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP03402', 'Dräger', ''),
  ('ACCESORIOS-000267', 'Ecg 5-Lead Dual-Pin Aha 1.5m', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MP03404', 'Dräger', ''),
  ('ACCESORIOS-000268', 'Cubierta De Incubadora Babyleo', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP03405', 'Dräger', ''),
  ('ACCESORIOS-000269', 'Ecg 6-Lead Single-P Aha 1.5m', 'accesorios', 'producto', 'Presentación: PIEZA', 17, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP03406', 'Dräger', ''),
  ('ACCESORIOS-000270', 'Ecg-Lead Dual-Pin Aha, 1m', 'accesorios', 'producto', 'Presentación: PIEZA', 20, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP03412', 'Dräger', ''),
  ('ACCESORIOS-000271', 'Ecg 5-Lead Dual-Pin Aha 1.5m', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP03414', 'Dräger', ''),
  ('ACCESORIOS-000272', 'Cable ECG 5 derivaciones telemetría AHA 70cm', 'accesorios', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, '2020-09-01', '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP03424', 'Dräger', ''),
  ('ACCESORIOS-000273', 'Babyleo Incubator Cover', 'accesorios', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MP03730', 'Dräger', ''),
  ('ACCESORIOS-000274', 'Eyemax 2 Micro', 'accesorios', 'producto', 'Presentación: PIEZA', 21, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP03770', 'Dräger', ''),
  ('ACCESORIOS-000275', 'Eyemax 2 Regular', 'accesorios', 'producto', 'Presentación: PAQUETE/20 PZS', 10, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP03772', 'Dräger', ''),
  ('ACCESORIOS-000276', 'Ecg 6-Lead Single-P Aha 2m', 'accesorios', 'producto', 'Presentación: PIEZA', 60, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP05115', 'Dräger', ''),
  ('ACCESORIOS-000277', 'Hi- Flow Star Adult M', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP05512', 'Dräger', ''),
  ('ACCESORIOS-000278', 'Sujetador De Cables', 'accesorios', 'producto', 'Presentación: PAQUETE DE 2', 4, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MP0692', 'Dräger', ''),
  ('ACCESORIOS-000279', 'Silikon Mask Infant Reusable', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP1911', 'Dräger', ''),
  ('ACCESORIOS-000280', 'Neonatal Test Lung, Reusable', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MP200050', 'Dräger', ''),
  ('ACCESORIOS-000281', 'Adaptador Ecg Para Cable Ecg De Pin Sencillo', 'accesorios', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MR35371', 'Dräger', ''),
  ('ACCESORIOS-000282', 'Nmt Cbl Trident, 2-Lead, 0.3 M', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MS13218', 'Dräger', ''),
  ('ACCESORIOS-000283', 'Sensor SpO2 Dräger reutilizable', 'accesorios', 'producto', 'Presentación: PIEZA', 17, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MS13235', 'Dräger', ''),
  ('ACCESORIOS-000284', 'Cable Scio/Ids 1.5m', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS13865', 'Dräger', ''),
  ('ACCESORIOS-000285', 'Spo2 Cable Masimo Procal , 1.5m', 'accesorios', 'producto', 'Presentación: PIEZA', 35, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS13926', 'Dräger', ''),
  ('ACCESORIOS-000286', 'Cuff 12-19 Adult', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MS14428', 'Dräger', ''),
  ('ACCESORIOS-000287', 'Cuff 12-19 Child', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MS14430', 'Dräger', ''),
  ('ACCESORIOS-000288', 'Monolead 3, Aha/Us, 2m', 'accesorios', 'producto', 'Presentación: PIEZA', 20, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS14556', 'Dräger', ''),
  ('ACCESORIOS-000289', 'Ecg Cbl Monolead 6 Aha/Us 5.7m', 'accesorios', 'producto', 'Presentación: PIEZA', 20, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS14560', 'Dräger', ''),
  ('ACCESORIOS-000290', 'Multimed 5 Singlepin Adapter', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS14679', 'Dräger', ''),
  ('ACCESORIOS-000291', 'Monolead-Multimed Adapter 6/5', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS14679E530U', 'Dräger', ''),
  ('ACCESORIOS-000292', 'Monolead 6 AHA/US, 3 m', 'accesorios', 'producto', 'Presentación: PIEZA', 6, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS14682', 'Dräger', ''),
  ('ACCESORIOS-000293', 'Nmt-Thermistor Trident', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MS15053', 'Dräger', ''),
  ('ACCESORIOS-000294', 'Nmt Thumb Adpt Trident 5opcs', 'accesorios', 'producto', 'Presentación: CAJA/50 PZS', 5, 0, 'caja', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS15084', 'Dräger', ''),
  ('ACCESORIOS-000295', 'Nmt Accelerometer Trident', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS15085', 'Dräger', ''),
  ('ACCESORIOS-000296', 'Bed Clip For Cables', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS15087', 'Dräger', ''),
  ('ACCESORIOS-000297', 'Nmt Hand Adapter Trident', 'accesorios', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS15088', 'Dräger', ''),
  ('ACCESORIOS-000298', 'Cable Control Cnap Latex Free', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS15893', 'Dräger', ''),
  ('ACCESORIOS-000299', 'Cnap Sensor Cuff, Medium', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MS15895', 'Dräger', ''),
  ('ACCESORIOS-000300', 'Cuff Cnap Pod Large', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MS15896', 'Dräger', ''),
  ('ACCESORIOS-000301', 'Monolead 5 chest AHA, 1.5 m', 'accesorios', 'producto', 'Presentación: PIEZA', 16, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS16230', 'Dräger', ''),
  ('ACCESORIOS-000302', 'Ecg Extension Single Pin. 2m', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS16256', 'Dräger', ''),
  ('ACCESORIOS-000303', 'Monolead 5 Dual-Pin Aha, 2.5m', 'accesorios', 'producto', 'Presentación: PIEZA', 25, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS16299', 'Dräger', ''),
  ('ACCESORIOS-000304', 'SpO2 interm cbl Masimo LNOP, 3m', 'accesorios', 'producto', 'Presentación: PIEZA', 18, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS17041', 'Dräger', ''),
  ('ACCESORIOS-000305', 'Spo2 Intermediate Cable, 3m', 'accesorios', 'producto', 'Presentación: PIEZA', 10, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS17330', 'Dräger', ''),
  ('ACCESORIOS-000306', 'Spo2 Masimo Cable 3m', 'accesorios', 'producto', 'Presentación: PIEZA', 11, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS17522', 'Dräger', ''),
  ('ACCESORIOS-000307', 'Spo2 Cable Masimo Lnop, 1.2m Latex Free', 'accesorios', 'producto', 'Presentación: PIEZA', 47, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS18680', 'Dräger', ''),
  ('ACCESORIOS-000308', 'Spo2 Intermediate Cable, 1.2 M', 'accesorios', 'producto', 'Presentación: PIEZA', 11, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS18683', 'Dräger', ''),
  ('ACCESORIOS-000309', 'Multimed Plus', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS20093', 'Dräger', ''),
  ('ACCESORIOS-000310', 'Spo2 Masimo Cable Lncs 1.2m', 'accesorios', 'producto', 'Presentación: PIEZA', 17, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS24303', 'Dräger', ''),
  ('ACCESORIOS-000311', 'Ecg Neo Adapter Cable Mm, 2m', 'accesorios', 'producto', 'Presentación: PIEZA', 11, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS25951', 'Dräger', ''),
  ('ACCESORIOS-000312', 'Cnap Arm Strap Generation 2, Latex Free', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS26122', 'Dräger', ''),
  ('ACCESORIOS-000313', 'Cnap Cuff Control Cradle Gen2', 'accesorios', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS26123', 'Dräger', ''),
  ('ACCESORIOS-000314', 'Ecg Cbl Monolead 6 Aha/Us 5.7m', 'accesorios', 'producto', 'Presentación: PIEZA', 11, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS28560', 'Dräger', ''),
  ('ACCESORIOS-000315', 'TOF hand sensor, ped. SW1,7', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MS32289', 'Dräger', ''),
  ('ACCESORIOS-000316', 'Adapter Db9f-Rj45', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MS32958', 'Dräger', ''),
  ('ACCESORIOS-000317', 'Rommet_spcl_hood_access', 'accesorios', 'producto', 'Presentación: PIEZA', 14, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MU04366', 'Dräger', ''),
  ('ACCESORIOS-000318', 'O2 sensor, Bio-Med 10006', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MU04804', 'Dräger', ''),
  ('ACCESORIOS-000319', 'Filter,Repl,Isolette', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MU04991', 'Dräger', ''),
  ('ACCESORIOS-000320', 'Critter Covers, Box/100', 'accesorios', 'producto', 'Presentación: PAQUETE/100', 8, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MU06942', 'Dräger', '')
on conflict (sku) do update set
  name = excluded.name,
  category = excluded.category,
  item_kind = excluded.item_kind,
  description = excluded.description,
  min_stock = excluded.min_stock,
  unit = excluded.unit,
  location = excluded.location,
  brand = excluded.brand,
  model = excluded.model,
  serial_number = excluded.serial_number,
  unit_price = excluded.unit_price,
  supplier = excluded.supplier,
  expiry_date = excluded.expiry_date,
  manufactured_at = excluded.manufactured_at,
  notes = excluded.notes,
  asset_status = excluded.asset_status,
  last_maintenance_date = excluded.last_maintenance_date,
  next_maintenance_date = excluded.next_maintenance_date,
  is_active = excluded.is_active,
  tracks_lot = excluded.tracks_lot,
  tracks_serial = excluded.tracks_serial,
  tracks_expiry = excluded.tracks_expiry,
  max_stock = excluded.max_stock,
  reorder_point = excluded.reorder_point,
  part_number = excluded.part_number,
  manufacturer = excluded.manufacturer,
  subcategory = excluded.subcategory;

insert into public.inventory_items (
  sku,
  name,
  category,
  item_kind,
  description,
  quantity,
  min_stock,
  unit,
  location,
  brand,
  model,
  serial_number,
  unit_price,
  supplier,
  expiry_date,
  manufactured_at,
  notes,
  asset_status,
  last_maintenance_date,
  next_maintenance_date,
  is_active,
  tracks_lot,
  tracks_serial,
  tracks_expiry,
  max_stock,
  reorder_point,
  part_number,
  manufacturer,
  subcategory
) values
  ('ACCESORIOS-000321', 'Sonda de temperatura cutánea reutilizable', 'accesorios', 'producto', 'Presentación: PIEZA', 25, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MU06951', 'Dräger', ''),
  ('ACCESORIOS-000322', 'Sonda De Temperatura De Aire Sobre Infante', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MU06955-01', 'Dräger', ''),
  ('ACCESORIOS-000323', 'Sonda de temperatura cutánea', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MU06971', 'Dräger', ''),
  ('ACCESORIOS-000324', 'Probe3, Skintemp, Dual, Disp, Bx10', 'accesorios', 'producto', 'Presentación: CAJA/1O PZS', 4, 0, 'caja', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MU11228', 'Dräger', ''),
  ('ACCESORIOS-000325', 'Probe 5, Ig Skin Tmp,Ysi, Box/10', 'accesorios', 'producto', 'Presentación: PAQUETE/10 PIEZAS', 1, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MU12551', 'Dräger', ''),
  ('ACCESORIOS-000326', 'Grommet, Access', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MU12609', 'Dräger', ''),
  ('ACCESORIOS-000327', 'Cell-Oxygen', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MU13223-06', 'Dräger', ''),
  ('ACCESORIOS-000328', 'Kit, Head Shield Hinge Isolette', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MU13400', 'Dräger', ''),
  ('ACCESORIOS-000329', 'Kit Esquineros', 'accesorios', 'producto', 'Presentación: PIEZA', 11, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MU22416', 'Dräger', ''),
  ('ACCESORIOS-000330', 'Probe 1, Skin Temp, Disp, Box/10', 'accesorios', 'producto', 'Presentación: PAQUETE/10 PZS', 2, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MU8933', 'Dräger', ''),
  ('ACCESORIOS-000331', 'Canister Key', 'accesorios', 'producto', 'Presentación: PIEZA', 8, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MX10209', 'Dräger', ''),
  ('ACCESORIOS-000332', 'Sonda de temperatura cutánea', 'accesorios', 'producto', 'Presentación: PIEZA', 44, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MX11000', 'Dräger', ''),
  ('ACCESORIOS-000333', 'Thermopad', 'accesorios', 'producto', 'Presentación: KIT', 150, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MX11002', 'Dräger', ''),
  ('ACCESORIOS-000334', 'Filtro De Aire', 'accesorios', 'producto', 'Presentación: PAQUETE/ 20 PZS', 5, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MX17015', 'Dräger', ''),
  ('ACCESORIOS-000335', 'Soda Lime Dust Filter', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'MX50115', 'Dräger', ''),
  ('ACCESORIOS-000336', 'Disposable Neonatal Test Lung', 'accesorios', 'producto', 'Presentación: PIEZA', 10, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'NTL 10', 'Dräger', ''),
  ('ACCESORIOS-000337', 'Sensor de temperatura genérico', 'accesorios', 'producto', 'Presentación: PIEZA', 16, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'SENSTEMP1', 'Dräger', ''),
  ('ACCESORIOS-000338', 'Sensor de SpO2 genérico', 'accesorios', 'producto', 'Presentación: PIEZA', 21, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'SPOGEN-1', 'Dräger', ''),
  ('ACCESORIOS-000339', 'Cable troncal genérico', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'TRONCGEN1', 'Dräger', ''),
  ('ACCESORIOS-000340', 'Breathing Bag 2.3 L, Silicone', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'TS-G3', 'Dräger', ''),
  ('ACCESORIOS-000341', 'Reusable Adult Finger Clip Spo2 Sensor', 'accesorios', 'producto', 'Presentación: PIEZA', 10, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'U403-01P', 'Dräger', ''),
  ('ACCESORIOS-000342', 'Reusable Adult Soft Tip Spo2 Sensor Unimedic', 'accesorios', 'producto', 'Presentación: PIEZA', 12, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'U403S-01', 'Dräger', ''),
  ('ACCESORIOS-000343', 'Reusable Adult Finger Clip Spo2 Sensor', 'accesorios', 'producto', 'Presentación: PIEZA', 11, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'U710-70', 'Dräger', ''),
  ('ACCESORIOS-000344', 'Cable Paciente Red Lnc-10', 'accesorios', 'producto', 'Presentación: PIEZA', 14, 0, 'pieza', '', 'Masimo', '', '', 0.0, '', NULL, NULL, 'ACCESORIO
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '2026', 'Masimo', ''),
  ('ACCESORIOS-000345', 'Dci Mini Sc 400', 'accesorios', 'producto', 'Presentación: PIEZA', 101, 0, 'pieza', '', 'Masimo', '', '', 0.0, '', NULL, NULL, 'ACCESORIO
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '3798', 'Masimo', ''),
  ('ACCESORIOS-000346', 'Demo Tool', 'accesorios', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Masimo', '', '', 0.0, '', NULL, NULL, 'EQUIPO
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '4206', 'Masimo', ''),
  ('ACCESORIOS-000347', 'Patient Cable', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Masimo', '', '', 0.0, '', NULL, NULL, 'ACCESORIO
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '4253', 'Masimo', ''),
  ('ACCESORIOS-000348', 'Cable De Temperatura Rectal', 'accesorios', 'producto', 'Presentación: PIEZA', 41, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '21076A', 'Philips', ''),
  ('ACCESORIOS-000349', 'Kit Table Mount', 'accesorios', 'producto', 'Presentación: PIEZA', 25, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '453564255161', 'Philips', ''),
  ('ACCESORIOS-000350', 'Lpqgmx400-800 Rel. P.0 Spa', 'accesorios', 'producto', 'Presentación: PIEZA', 25, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '453665000791', 'Philips', ''),
  ('ACCESORIOS-000351', 'Lp Ifu Mx400-500 Rel. Spa', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '453665055001', 'Philips', ''),
  ('ACCESORIOS-000352', 'Lp Add Sg Mx400-850 Tympanic', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '453665087661', 'Philips', ''),
  ('ACCESORIOS-000353', 'Lp Add Mx450-850 Visual Ip', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '453665105801', 'Philips', ''),
  ('ACCESORIOS-000354', 'Add Cg Visual Pat', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '453665105861', 'Philips', ''),
  ('ACCESORIOS-000355', 'Lp Add Cg Visual', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '453665106311', 'Philips', ''),
  ('ACCESORIOS-000356', 'Lp Qg Mx450-850 Tympanic Temp', 'accesorios', 'producto', 'Presentación: PIEZA', 25, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '45366510931', 'Philips', ''),
  ('ACCESORIOS-000357', 'Lp Add Mx400-850 Tymp', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '453665114081', 'Philips', ''),
  ('ACCESORIOS-000358', 'Lp Add X3 Mx100-850 Stand Comp', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '453665125721', 'Philips', ''),
  ('ACCESORIOS-000359', 'Lp Is Service Doc. Incenter', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '453665133281', 'Philips', ''),
  ('ACCESORIOS-000360', 'Lp Is X3 Mxs Nbp Letter', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '453665145501', 'Philips', ''),
  ('ACCESORIOS-000361', 'Lp Add X3 Mxs Evol R0002 Spa', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '453665155461', 'Philips', ''),
  ('ACCESORIOS-000362', 'Intellivue Hemodynamic Extension', 'accesorios', 'producto', 'Presentación: PIEZA', 134, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, 'APROX
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '867039', 'Philips', ''),
  ('ACCESORIOS-000363', 'Cable Assembly', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '867043/002', 'Philips', ''),
  ('ACCESORIOS-000364', 'Comfort Care Cuff, Pediatric', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '989803104151', 'Philips', ''),
  ('ACCESORIOS-000365', '5 Lead Aami Leadset', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '989803143201', 'Philips', ''),
  ('ACCESORIOS-000366', 'IntelliVue NMT patient cable', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '989803174581', 'Philips', ''),
  ('ACCESORIOS-000367', 'Manguito NBP pediátrico', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '989803182621', 'Philips', ''),
  ('ACCESORIOS-000368', 'Manguito Nbp Adulto', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '989803182641', 'Philips', ''),
  ('ACCESORIOS-000369', 'Manguito Nbp Adulto Largo', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '989803182661', 'Philips', ''),
  ('ACCESORIOS-000370', 'Manguera interconexión de presión neonatal', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '989803183231', 'Philips', ''),
  ('ACCESORIOS-000371', 'Neonatal Nibp Air Hose 3.0m', 'accesorios', 'producto', 'Presentación: PIEZA', 12, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '989803209751', 'Philips', ''),
  ('ACCESORIOS-000372', 'Manguera Nibp Adulto 3.0m', 'accesorios', 'producto', 'Presentación: PIEZA', 10, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '989803209771', 'Philips', ''),
  ('ACCESORIOS-000373', 'Sensor Spo2 Adulto Reusable (3mts)', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'M1191BL', 'Philips', ''),
  ('ACCESORIOS-000374', 'Sensor SpO2 de dedo adulto, pediátrico reutilizable', 'accesorios', 'producto', 'Presentación: PIEZA', 6, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'M1192A', 'Philips', ''),
  ('ACCESORIOS-000375', 'Sensor Spo2 Pie, Mano Neonatal Reusable (1.5m)', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'M1193A', 'Philips', ''),
  ('ACCESORIOS-000376', 'Sensor SpO2 adulto pediátrico reutilizable', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'M1194A', 'Philips', ''),
  ('ACCESORIOS-000377', 'Sensor Reusable Cpo2 Adulto (3mts)', 'accesorios', 'producto', 'Presentación: PIEZA', 14, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'M1196A', 'Philips', ''),
  ('ACCESORIOS-000378', 'Manguito pediátrico Comfort Care', 'accesorios', 'producto', 'Presentación: PIEZA', 77, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'M1572A', 'Philips', ''),
  ('ACCESORIOS-000379', 'Brazalete Comfort Care Muslo', 'accesorios', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'M1576A', 'Philips', ''),
  ('ACCESORIOS-000380', 'Cable interconexión de presión neonatal', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'M1597B', 'Philips', ''),
  ('ACCESORIOS-000381', 'Neonatal Nibp Air Hose 3.0m', 'accesorios', 'producto', 'Presentación: PIEZA', 11, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'M1597C', 'Philips', ''),
  ('ACCESORIOS-000382', 'Manguera Nibp Adulta 1.5', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'M1598B', 'Philips', ''),
  ('ACCESORIOS-000383', '5 Leadset, Snap, Aami, Icu', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'M1644A', 'Philips', ''),
  ('ACCESORIOS-000384', 'Sensor De Co2 Principal', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'M2501A', 'Philips', ''),
  ('ACCESORIOS-000385', 'Tocógrafo', 'accesorios', 'producto', 'Presentación: PIEZA', 20, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'M2736A', 'Philips', ''),
  ('ACCESORIOS-000386', 'Rollo de cable sólido CMR azul', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'WIRC5ECMR', 'Philips', ''),
  ('ACCESORIOS-000387', 'Rigid Case F/3 V Sets Boxed', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '05259-MBX', 'Welch Allyn', ''),
  ('ACCESORIOS-000388', '2.5v Hal Hpx Lamp Larin Hol', 'accesorios', 'producto', 'Presentación: PIEZA', 16, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, 'PARTE DE ATRAS
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '06000-LED', 'Welch Allyn', ''),
  ('ACCESORIOS-000389', '2.5v Hal Hpx Lamp Larin', 'accesorios', 'producto', 'Presentación: PIEZA', 20, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, 'PARTE DE ATRAS
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '06000-U', 'Welch Allyn', ''),
  ('ACCESORIOS-000390', 'ESTUCHE', 'accesorios', 'producto', 'Presentación: PIEZA', 7, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '412924', 'Welch Allyn', ''),
  ('ACCESORIOS-000391', 'Esfigmomanómetro', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '5098-30', 'Welch Allyn', ''),
  ('ACCESORIOS-000392', 'Cuff, WA, soft, small adult', 'accesorios', 'producto', 'Presentación: PIEZA', 15, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '50H-10', 'Welch Allyn', ''),
  ('ACCESORIOS-000393', 'Espéculo pediátrico', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '52432-U', 'Welch Allyn', ''),
  ('ACCESORIOS-000394', 'Kleen Spec Adult', 'accesorios', 'producto', 'Presentación: PIEZA', 18, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '52434', 'Welch Allyn', ''),
  ('ACCESORIOS-000395', 'Kleen Spec Adult', 'accesorios', 'producto', 'Presentación: PIEZA', 8, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '52434-U', 'Welch Allyn', ''),
  ('ACCESORIOS-000396', 'Espejo Vaginal Grande', 'accesorios', 'producto', 'Presentación: CAJA/ 4 PZS', 10, 0, 'caja', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '59004', 'Welch Allyn', ''),
  ('ACCESORIOS-000397', 'Mango Laringoscopio Ligero F/O', 'accesorios', 'producto', 'Presentación: PIEZA', 10, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '60813', 'Welch Allyn', ''),
  ('ACCESORIOS-000398', 'Hoja de laringoscopio #0 recta', 'accesorios', 'producto', 'Presentación: PIEZA', 8, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, 'PARTE DE ATRAS
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '68060', 'Welch Allyn', ''),
  ('ACCESORIOS-000399', 'Hoja de laringoscopio #2 recta', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, 'PARTE DE ATRAS
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '68061', 'Welch Allyn', ''),
  ('ACCESORIOS-000400', 'Hoja de laringoscopio #2 recta', 'accesorios', 'producto', 'Presentación: PIEZA', 23, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, 'PARTE DE ATRAS
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '68062', 'Welch Allyn', '')
on conflict (sku) do update set
  name = excluded.name,
  category = excluded.category,
  item_kind = excluded.item_kind,
  description = excluded.description,
  min_stock = excluded.min_stock,
  unit = excluded.unit,
  location = excluded.location,
  brand = excluded.brand,
  model = excluded.model,
  serial_number = excluded.serial_number,
  unit_price = excluded.unit_price,
  supplier = excluded.supplier,
  expiry_date = excluded.expiry_date,
  manufactured_at = excluded.manufactured_at,
  notes = excluded.notes,
  asset_status = excluded.asset_status,
  last_maintenance_date = excluded.last_maintenance_date,
  next_maintenance_date = excluded.next_maintenance_date,
  is_active = excluded.is_active,
  tracks_lot = excluded.tracks_lot,
  tracks_serial = excluded.tracks_serial,
  tracks_expiry = excluded.tracks_expiry,
  max_stock = excluded.max_stock,
  reorder_point = excluded.reorder_point,
  part_number = excluded.part_number,
  manufacturer = excluded.manufacturer,
  subcategory = excluded.subcategory;

insert into public.inventory_items (
  sku,
  name,
  category,
  item_kind,
  description,
  quantity,
  min_stock,
  unit,
  location,
  brand,
  model,
  serial_number,
  unit_price,
  supplier,
  expiry_date,
  manufactured_at,
  notes,
  asset_status,
  last_maintenance_date,
  next_maintenance_date,
  is_active,
  tracks_lot,
  tracks_serial,
  tracks_expiry,
  max_stock,
  reorder_point,
  part_number,
  manufacturer,
  subcategory
) values
  ('ACCESORIOS-000401', 'Hoja de laringoscopio #3', 'accesorios', 'producto', 'Presentación: PIEZA', 24, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, 'PARTE DE ATRAS
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '68063', 'Welch Allyn', ''),
  ('ACCESORIOS-000402', 'Hoja de laringoscopio #4', 'accesorios', 'producto', 'Presentación: PIEZA', 12, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, 'PARTE DE ATRAS
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '68064', 'Welch Allyn', ''),
  ('ACCESORIOS-000403', 'Hoja de laringoscopio #00 recta', 'accesorios', 'producto', 'Presentación: PIEZA', 18, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, 'PARTE DE ATRAS
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '68065', 'Welch Allyn', ''),
  ('ACCESORIOS-000404', '#1 Mac F/O laryngoscope', 'accesorios', 'producto', 'Presentación: PIEZA', 7, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '69061', 'Welch Allyn', ''),
  ('ACCESORIOS-000405', 'Hoja de laringoscopio #2 recta', 'accesorios', 'producto', 'Presentación: PIEZA', 22, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, 'PARTE DE ATRAS
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '69062', 'Welch Allyn', ''),
  ('ACCESORIOS-000406', 'Hoja de laringoscopio #3 curvo', 'accesorios', 'producto', 'Presentación: PIEZA', 6, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, 'PARTE DE ATRAS
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '69063', 'Welch Allyn', ''),
  ('ACCESORIOS-000407', 'Hoja De Laringoscopio Mac #4 Curva F/O', 'accesorios', 'producto', 'Presentación: PIEZA', 20, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '69064', 'Welch Allyn', ''),
  ('ACCESORIOS-000408', 'BP fitting, M locking', 'accesorios', 'producto', 'Presentación: PIEZA', 5, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '90100', 'Welch Allyn', ''),
  ('ACCESORIOS-000409', 'Accessory/component', 'accesorios', 'producto', 'Presentación: PIEZA', 6, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '901000', 'Welch Allyn', ''),
  ('ACCESORIOS-000410', 'Estuche de diagnóstico Pocket LED (3.5V HAL coaxial ophth/oto)', 'accesorios', 'producto', 'Presentación: KIT', 128, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '901026', 'Welch Allyn', ''),
  ('ACCESORIOS-000411', 'Brazalete Reutilizable Niño Chico 2 Tubos', 'accesorios', 'producto', 'Presentación: PIEZA', 13, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '901043', 'Welch Allyn', ''),
  ('ACCESORIOS-000412', 'Mango Laringoscopio Ligero Recargable', 'accesorios', 'producto', 'Presentación: PIEZA', 78, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '901087', 'Welch Allyn', ''),
  ('ACCESORIOS-000413', 'Wall Transformer', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '901093', 'Welch Allyn', ''),
  ('ACCESORIOS-000414', 'Batería recargable 3 celdas', 'accesorios', 'producto', 'Presentación: PIEZA', 26, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, 'PARTE DE ATRAS
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '901122', 'Welch Allyn', ''),
  ('ACCESORIOS-000415', 'Estuche de diagnóstico', 'accesorios', 'producto', 'Presentación: PIEZA', 12, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, 'PARTE DE ATRAS
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, '97-200', 'Welch Allyn', ''),
  ('ACCESORIOS-000416', 'Otoscope-Ophthal Set', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '97150-C', 'Welch Allyn', ''),
  ('ACCESORIOS-000417', 'Durashock Ds44 Multi', 'accesorios', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'DS44-MC', 'Welch Allyn', ''),
  ('ACCESORIOS-000418', 'Cuff, Reus Sm Child 1', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'REUSE', 'Welch Allyn', ''),
  ('ACCESORIOS-000419', 'Cuff, Reuse Infant', 'accesorios', 'producto', 'Presentación: PIEZA', 51, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'REUSE-07-1 HP', 'Welch Allyn', ''),
  ('ACCESORIOS-000420', 'Cuff, Reus Sm Child 1', 'accesorios', 'producto', 'Presentación: PIEZA', 72, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'REUSE-08-1 HP', 'Welch Allyn', ''),
  ('ACCESORIOS-000421', 'Cuff, Wa, Reusable Adult', 'accesorios', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'REUSE-11 L', 'Welch Allyn', ''),
  ('ACCESORIOS-000422', 'Cuff, Reus Sm Child 1', 'accesorios', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, 'REUSE-13-1 HP', 'Welch Allyn', ''),
  ('EQUIPO-000001', 'IntelliVue Patient Monitor MX550', 'equipos', 'equipo', '', 33, 0, 'pieza', 'Sala de cámaras', 'Philips', 'MX550', '', 0.0, 'Philips', NULL, NULL, '', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '866066', 'Philips', ''),
  ('EQUIPO-000002', 'Monitor fetal Avalon FM20/FM30', 'equipos', 'equipo', '', 20, 0, 'pieza', 'Sala de cámaras', 'Philips', 'FM20/FM30', '', 0.0, 'Philips', NULL, NULL, '', 'operativo', NULL, NULL, true, false, true, false, 0, 0, 'M2702A', 'Philips', ''),
  ('EQUIPO-000003', 'D-Vapor', 'equipos', 'equipo', '', 1, 0, 'pieza', 'Sala de cámaras', 'Dräger', 'D-Vapor', '', 0.0, 'Drager', NULL, NULL, '', 'operativo', NULL, NULL, true, false, true, false, 0, 0, 'M35500', 'Drager', ''),
  ('EQUIPO-000004', 'Monitor de signos vitales Vista 120 C', 'equipos', 'equipo', '', 4, 0, 'pieza', 'Sala de cámaras', 'Dräger', 'Vista 120 C', '', 0.0, 'Drager', NULL, NULL, '', 'operativo', NULL, NULL, true, false, true, false, 0, 0, 'MS34009', 'Drager', ''),
  ('EQUIPO-000005', 'Mounting arm with basket', 'equipos', 'equipo', '', 1, 0, 'pieza', 'Sala de cámaras', 'Dräger', '', '', 0.0, 'Drager', NULL, NULL, '', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '2601148', 'Drager', ''),
  ('EQUIPO-000006', 'Desfibrilador EFFICIA DFM100', 'equipos', 'equipo', '', 28, 0, 'pieza', 'Sala de cámaras', 'Philips', 'EFFICIA DFM100', '', 0.0, 'Philips', '2022-10-21', NULL, '', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '866199', 'Philips', ''),
  ('EQUIPO-000007', 'Vista 120', 'equipos', 'equipo', '', 1, 0, 'pieza', 'Sala de Cámaras ', 'Dräger', '', 'VGSRF0051', 0.0, 'Drager', NULL, '2022-06-06', '', 'operativo', '2026-10-06', NULL, true, false, true, false, 0, 0, 'MS34009', 'Drager', ''),
  ('EQUIPO-000008', 'Rad-G Pulse Oximeter', 'equipos', 'equipo', '', 1, 0, 'pieza', '', 'Masimo', 'Rad-G Pulse Oximeter', '6000106190', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '9849', 'Masimo', ''),
  ('EQUIPO-000009', 'Rad Handheld signal extraction pulse oximeter', 'equipos', 'equipo', '', 0, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '9196', 'Masimo', ''),
  ('EQUIPO-000010', 'Root', 'equipos', 'equipo', '', 0, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '9515', 'Masimo', ''),
  ('EQUIPO-000011', 'SedLine Sedation Monitor', 'equipos', 'equipo', '', 2, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '9513', 'Masimo', ''),
  ('EQUIPO-000012', 'Radical-7', 'equipos', 'equipo', '', 0, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '9500', 'Masimo', ''),
  ('EQUIPO-000013', 'O3 Regional Oximeter', 'equipos', 'equipo', '', 0, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2025-12-01', '', 'operativo', NULL, NULL, true, true, true, false, 0, 0, '9637', 'Masimo', ''),
  ('EQUIPO-000014', 'EMMA Kit Capnograph mmHg', 'equipos', 'equipo', '', 1, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '3639', 'Masimo', ''),
  ('EQUIPO-000015', 'Bair Hugger Warming Unit (usado)', 'equipos', 'equipo', 'Presentación: EQUIPO', 1, 0, 'pieza', '', '3M', '', '', 0.0, '', NULL, NULL, 'BAIR HUGER WARMING UNIT (USADO)
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '77500', '3M', ''),
  ('EQUIPO-000016', 'Bair Hugger Rolling Cart (usado)', 'equipos', 'equipo', 'Presentación: EQUIPO', 1, 0, 'pieza', '', '3M', '', '', 0.0, '', NULL, NULL, 'BAIR HUGER ROLLING CAR (USADO)
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '90090', '3M', ''),
  ('EQUIPO-000017', 'Cable Adaptador Etco2 Vista 120', 'equipos', 'equipo', 'Presentación: PIEZA', 8, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '2607032', 'Dräger', ''),
  ('EQUIPO-000018', 'Infinity Dock Station Can/Mib', 'equipos', 'equipo', 'Presentación: EQUIPO', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', '2021-01-06', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, true, true, 0, 0, '7489375', 'Dräger', ''),
  ('EQUIPO-000019', 'Monitor Invivo', 'equipos', 'equipo', 'Presentación: EQUIPO', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '453564146991', 'Philips', ''),
  ('EQUIPO-000020', 'Instrucciones de uso para monitor de paciente IntelliVue MX100/X3', 'equipos', 'equipo', 'Presentación: PIEZA', 20, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '867030-002', 'Philips', ''),
  ('EQUIPO-000021', 'Paletas water resistant', 'equipos', 'equipo', 'Presentación: EQUIPO', 19, 0, 'pieza', '', 'Philips', '', '', 0.0, '', '2016-06-01', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, true, true, 0, 0, 'M3543A', 'Philips', ''),
  ('EQUIPO-000022', 'Pads Para Uso Para Desfibrilador', 'equipos', 'equipo', 'Presentación: PIEZA', 20, 0, 'pieza', '', 'Philips', '', '', 0.0, '', '2021-04-30', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, true, true, 0, 0, 'M5072A', 'Philips', ''),
  ('EQUIPO-000023', 'Vital Signs Device', 'equipos', 'equipo', 'Presentación: EQUIPO', 0, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '901056', 'Welch Allyn', ''),
  ('EQUIPO-000024', 'Monitor De Signos Vitales', 'equipos', 'equipo', 'Presentación: EQUIPO', 0, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '901058', 'Welch Allyn', ''),
  ('EQUIPO-000025', 'Affinity 4 Birthing Bed', 'equipos', 'equipo', '', 0, 0, 'pieza', '', 'Hill-Rom', 'P3700', '', 400000.0, 'BAXTER/Hill-Rom', NULL, NULL, '', 'operativo', NULL, NULL, true, false, true, false, 0, 0, 'P3700E100473', 'BAXTER/Hill-Rom', ''),
  ('EQUIPO-000026', 'Lámpara de quirófano dual Polaris 100/200', 'equipos', 'equipo', '', 0, 0, 'pieza', '', 'Dräger', 'Polaris 100/200', '', 430000.0, 'Dräger', NULL, NULL, '', 'operativo', NULL, NULL, true, false, true, false, 0, 0, 'G16981 / G16982', 'Dräger', ''),
  ('INSUMOS-000001', 'Mask silicone inf small 0 reusable', 'insumos', 'producto', '', 14, 0, 'pieza', 'A/2', 'Dräger', '', '', 0.0, 'Drager', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP01910', 'Drager', ''),
  ('INSUMOS-000002', 'Tyvek Roll with STERRAD Chemical Indicator', 'insumos', 'producto', '', 12, 0, 'caja', 'Insumos', 'ASP', '', '', 0.0, 'ASP', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '12435', 'ASP', ''),
  ('INSUMOS-000003', 'Biological Indicators/Process Challenge Devices', 'insumos', 'producto', '', 25, 0, 'caja', '', 'ASP', '', '', 0.0, 'ASP', '2025-01-29', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '43210-30', '', ''),
  ('INSUMOS-000004', 'Tyvek Heat Seal Pouch with STERRAD Chemical Indicator', 'insumos', 'producto', '', 5, 0, 'caja', 'Insumos', 'ASP', '', '', 0.0, 'ASP', '2026-09-17', '2024-09-17', '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '12532', 'ASP', ''),
  ('INSUMOS-000005', 'STERRAD 100NX Cassette', 'insumos', 'producto', '', 71, 0, 'pieza', '', 'ASP', '', '', 0.0, 'ASP', '2026-12-03', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '10144', '', ''),
  ('INSUMOS-000006', 'STERRAD Chemical Indicator Strip', 'insumos', 'producto', '', 4, 0, 'pieza', 'Insumos', 'ASP', '', '', 0.0, 'ASP', '2026-05-18', '2024-11-18', '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '14100', 'ASP', ''),
  ('INSUMOS-000007', 'STERRAD SEALSURE Chemical Indicator Tape', 'insumos', 'producto', '', 2, 0, 'pieza', '', 'ASP', '', '', 0.0, 'ASP', '2027-03-02', '2025-05-02', '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '14202NL', 'ASP', ''),
  ('INSUMOS-000008', 'Tyvek Heat Seal Pouch with STERRAD Chemical Indicator', 'insumos', 'producto', '', 8, 0, 'pieza', '', 'ASP', '', '', 0.0, 'ASP', '2025-03-01', '2026-12-19', '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '12541', 'Asp', ''),
  ('INSUMOS-000009', 'STERRAD 100NX Cassette Collector Box', 'insumos', 'producto', '', 5, 0, 'pieza', '', 'ASP', '', '', 0.0, 'ASP', '2057-10-05', '2023-03-01', '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '20227', 'ASP', ''),
  ('INSUMOS-000010', 'Sterilization Wrap', 'insumos', 'producto', '', 28, 0, 'pieza', '', 'Halyard', '', '', 0.0, 'ASP', '2051-10-05', '2025-05-02', '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '68040', 'Halyard', ''),
  ('INSUMOS-000011', 'Tyvek Roll with STERRAD Chemical Indicator', 'insumos', 'producto', '', 5, 0, 'pieza', '', 'ASP', '', '', 0.0, 'ASP', '2026-02-20', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '12415', 'ASP', ''),
  ('INSUMOS-000012', 'Tyvek Roll with STERRAD Chemical Indicator', 'insumos', 'producto', '', 4, 0, 'pieza', '', 'ASP', '', '', 0.0, 'ASP', '2026-11-04', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '12425', 'ASP', ''),
  ('INSUMOS-000013', 'Tyvek Roll with STERRAD Chemical Indicator', 'insumos', 'producto', '', 5, 0, 'pieza', '', 'ASP', '', '', 0.0, 'ASP', '2027-09-04', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '12420', 'ASP', ''),
  ('INSUMOS-000014', 'Tyvek Roll with STERRAD Chemical Indicator', 'insumos', 'producto', '', 4, 0, 'pieza', '', 'ASP', '', '', 0.0, 'ASP', '2026-07-24', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '12410', 'ASP', ''),
  ('INSUMOS-000015', 'VERISURE Bowie-Dick Test Pack', 'insumos', 'producto', '', 2, 0, 'caja', '', 'ASP', '', '', 0.0, 'ASP', '2028-09-01', '2023-09-01', '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '73180', 'ASP', ''),
  ('INSUMOS-000016', 'Process Challenge Device (PCD)', 'insumos', 'producto', '', 2, 0, 'caja', '', 'ASP', '', '', 0.0, 'ASP', '2028-09-01', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '73160', 'ASP', ''),
  ('INSUMOS-000017', 'RD rainbow SET-2 Adt – Sensor adhesivo adulto SpO2/SpHb/SpMet, 10/caja', 'insumos', 'producto', '', 5, 0, 'caja', '', 'Masimo', '', '', 0.0, 'Masimo', '2027-09-01', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '4026', 'Masimo', ''),
  ('INSUMOS-000018', 'RD SET YI – Sensor reutilizable multisitio', 'insumos', 'producto', '', 5, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', '2021-07-01', '2018-12-01', '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '4054', 'Masimo', ''),
  ('INSUMOS-000019', 'RD rainbow SET-2 Neo – Sensor adhesivo neonatal/adulto SpO2/SpHb/SpMet, 10/caja', 'insumos', 'producto', '', 327, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', '2028-10-01', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '4029', 'Masimo', ''),
  ('INSUMOS-000020', 'RD SedLine – Sensor EEG ADULTO, 25/caja', 'insumos', 'producto', '', 96, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', '2027-04-01', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '4248', 'Masimo', ''),
  ('INSUMOS-000021', 'RD SedLine – Sensor EEG pediátrico 25/caja', 'insumos', 'producto', '', 2, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', '2027-04-01', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '4329', 'Masimo', ''),
  ('INSUMOS-000022', 'O3 – Sensor adhesivo adulto rSO2 (oximetría regional), uso en un paciente 20/caja', 'insumos', 'producto', '', 27, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', '2027-07-01', '2028-09-01', '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '3756', 'Masimo', ''),
  ('INSUMOS-000023', 'Paper, Printer, Thermal', 'insumos', 'producto', '', 4, 0, 'pieza', '', 'ASP', '', '', 0.0, 'ASP', '2065-01-06', '2025-01-10', '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '10305', 'ASP', ''),
  ('INSUMOS-000024', 'RD SET Neo, SpO2, PR, Pi, PVi /Adulto 20/caja', 'insumos', 'producto', '', 23, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', '2022-05-01', '2022-05-01', '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '4003', 'Masimo', ''),
  ('INSUMOS-000025', 'O3 Sensor rSO2 infantil/neonatal 25/caja', 'insumos', 'producto', '', 0, 0, 'pieza', '', 'Masimo', 'Masimo', '', 0.0, 'Masimo', '2028-09-01', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '4384', 'Masimo', ''),
  ('INSUMOS-000026', 'O3 Sensor rSO2 pediatric adhesive 25/caja', 'insumos', 'producto', '', 16, 0, 'pieza', '', 'Masimo', 'Masimo', '', 0.0, 'Masimo', '2028-09-01', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '4235', 'Masimo ', ''),
  ('INSUMOS-000027', 'RD SedLine – Sensor EEG pediátrico Piezas', 'insumos', 'producto', '', 56, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', '2027-05-01', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '4329', 'Masimo', ''),
  ('INSUMOS-000028', 'O3 – Sensor adhesivo adulto rSO2 (oximetría regional), uso en un paciente PIEZAS', 'insumos', 'producto', '', 10, 0, 'pieza', 'Insumos', 'Masimo', '', '', 0.0, 'Masimo', '2027-07-01', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '3756', 'Masimo', ''),
  ('INSUMOS-000029', 'RD rainbow SET-2 Adt – Sensor adhesivo adulto SpO2/SpHb/SpMet, PIEZAS', 'insumos', 'producto', '', 5, 0, 'pieza', '', 'Masimo', ' ', '', 0.0, 'Masimo', '2027-01-09', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '4026', 'Masimo', ''),
  ('INSUMOS-000030', 'Mask LiteStar 1 w/o Hook 50/caja', 'insumos', 'producto', '', 52, 0, 'caja', '', 'Dräger', 'Talla 1', '', 0.0, 'Drager', '2028-01-15', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP11001', 'Drager', ''),
  ('INSUMOS-000031', 'Mask LiteStar 1 w/o Hook 50/caja', 'insumos', 'producto', '', 0, 0, 'caja', '', 'Dräger', 'Talla 1', '', 0.0, 'Drager', NULL, NULL, '', 'operativo', NULL, NULL, false, true, false, true, 0, 0, 'MP11001', 'Drager', ''),
  ('INSUMOS-000032', 'Mask LiteStar 3 w/o hook 50/caja', 'insumos', 'producto', '', 103, 0, 'pieza', '', 'Dräger', 'Talla 3', '', 0.0, 'Drager', '2027-01-07', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP11003', 'Drager', '')
on conflict (sku) do update set
  name = excluded.name,
  category = excluded.category,
  item_kind = excluded.item_kind,
  description = excluded.description,
  min_stock = excluded.min_stock,
  unit = excluded.unit,
  location = excluded.location,
  brand = excluded.brand,
  model = excluded.model,
  serial_number = excluded.serial_number,
  unit_price = excluded.unit_price,
  supplier = excluded.supplier,
  expiry_date = excluded.expiry_date,
  manufactured_at = excluded.manufactured_at,
  notes = excluded.notes,
  asset_status = excluded.asset_status,
  last_maintenance_date = excluded.last_maintenance_date,
  next_maintenance_date = excluded.next_maintenance_date,
  is_active = excluded.is_active,
  tracks_lot = excluded.tracks_lot,
  tracks_serial = excluded.tracks_serial,
  tracks_expiry = excluded.tracks_expiry,
  max_stock = excluded.max_stock,
  reorder_point = excluded.reorder_point,
  part_number = excluded.part_number,
  manufacturer = excluded.manufacturer,
  subcategory = excluded.subcategory;

insert into public.inventory_items (
  sku,
  name,
  category,
  item_kind,
  description,
  quantity,
  min_stock,
  unit,
  location,
  brand,
  model,
  serial_number,
  unit_price,
  supplier,
  expiry_date,
  manufactured_at,
  notes,
  asset_status,
  last_maintenance_date,
  next_maintenance_date,
  is_active,
  tracks_lot,
  tracks_serial,
  tracks_expiry,
  max_stock,
  reorder_point,
  part_number,
  manufacturer,
  subcategory
) values
  ('INSUMOS-000033', 'Mask LiteStar 3 w/o hook 30/caja', 'insumos', 'producto', '', 0, 0, 'caja', '', 'Dräger', 'Talla 3', '', 0.0, 'Drager', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP11003', 'Drager', ''),
  ('INSUMOS-000034', 'TruWave 3 cc/60 in (150cm) 10/caja', 'insumos', 'producto', '', 709, 0, 'caja', '', 'Edwards Lifesciences', '', '', 0.0, 'Edwards Lifesciences', '2027-02-05', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'PX260', 'Edwards Lifesciences', ''),
  ('INSUMOS-000035', 'Sample Line Set 10/bolsa', 'insumos', 'producto', '', 0, 0, 'paquete', '', 'Dräger', '', '', 0.0, 'Dragër ', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '8290266/', 'Dragër ', ''),
  ('INSUMOS-000036', 'WaterLock2 12/caja', 'insumos', 'producto', '', 0, 0, 'caja', '', 'Dräger', '', '', 0.0, 'Dragër ', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '6872', 'Dragër ', ''),
  ('INSUMOS-000037', 'Red Dot Monitoring Electrode with foam Tape', 'insumos', 'producto', '', 0, 0, 'paquete', '', '', '', '', 0.0, '', NULL, NULL, '', 'operativo', NULL, NULL, false, true, false, true, 0, 0, '', '', ''),
  ('INSUMOS-000038', 'Red Dot Monitoring Electrode with foam Tape pieza', 'insumos', 'producto', '', 37, 0, 'pieza', '', '3M', '', '', 0.0, '3M', '2027-03-07', NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '2228', '3M', ''),
  ('INSUMOS-000039', 'Red Dot Monitoring electrode with foam Tape 50pz/bolsa', 'insumos', 'producto', '', 0, 0, 'paquete', '', '3M', '', '', 0.0, '3M', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '2228', '', ''),
  ('INSUMOS-000040', 'Red Dot Monitoring electrode with foam Tape 20bolsa/Caja', 'insumos', 'producto', '', 0, 0, 'caja', '', '3M', '', '', 0.0, '3M', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '2228', '', ''),
  ('INSUMOS-000041', 'VentStar Anesthesia (N) 180. 25/caja', 'insumos', 'producto', '', 0, 0, 'pieza', '', 'Dräger', '', '', 0.0, 'Dragër ', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP00333', 'Dragër ', ''),
  ('INSUMOS-000042', 'Ventstar Anesthesia (N) 180. Pieza', 'insumos', 'producto', '', 0, 0, 'pieza', '', 'Dräger', '', '', 0.0, 'Dragër ', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP00333', 'Dragër ', ''),
  ('INSUMOS-000043', 'Electrodos desechables ECG', 'insumos', 'producto', '', 0, 0, 'paquete', '', '', '', '', 0.0, 'Neo Tecnia ', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '', 'Médico electrodes international LTD', ''),
  ('INSUMOS-000044', 'Maxi hisopo con 5.2 ml', 'insumos', 'producto', 'Presentación: CAJA/ 10 PIEZAS', 4, 0, 'caja', '', '3M', '', '', 0.0, '', '2024-05-01', NULL, 'MAXI HISOPOTO CON 5.2 ML
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '102.09', '3M', ''),
  ('INSUMOS-000045', 'Esterilización con gas', 'insumos', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', '3M', '', '', 0.0, '', '2025-06-21', NULL, 'ESTERILIZACION CON GAS
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '1231', '3M', ''),
  ('INSUMOS-000046', 'Paquete para la prueba tipo Bowie-Dick', 'insumos', 'producto', 'Presentación: CAJA/ 10 PIEZAS', 43, 0, 'caja', '', '3M', '', '', 0.0, '', NULL, NULL, 'PAQUETE PARA LA PRUEBA TIPO BROWIE-DICK
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '1233LF', '3M', ''),
  ('INSUMOS-000047', 'Integrador químico por vapor', 'insumos', 'producto', 'Presentación: 2 BOLSAS/ CAJA', 3, 0, 'caja', '', '3M', '', '', 0.0, '', '2027-06-12', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '1243A', '3M', ''),
  ('INSUMOS-000048', 'COMPLY', 'insumos', 'producto', 'Presentación: CAJA/ 240 PIEZAS', 6, 0, 'caja', '', '3M', '', '', 0.0, '', '2027-09-21', NULL, 'COMPLY
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '1250', '3M', ''),
  ('INSUMOS-000049', '3M ATTEST', 'insumos', 'producto', 'Presentación: CAJA/ 50 PIEZAS', 12, 0, 'caja', '', '3M', '', '', 0.0, '', '2027-09-01', NULL, '3M ATTEST
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '1292', '3M', ''),
  ('INSUMOS-000050', '3M ATTEST', 'insumos', 'producto', 'Presentación: CAJA/ 50 PIEZAS', 12, 0, 'caja', '', '3M', '', '', 0.0, '', '2026-06-03', NULL, '3M ATTEST
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '1294', '3M', ''),
  ('INSUMOS-000051', 'Lead Free Steam Indicador', 'insumos', 'producto', 'Presentación: CAJA/ 28 PIEZAS', 24, 0, 'caja', '', '3M', '', '', 0.0, '', '2026-11-27', NULL, 'LEAD FREE STEAM INDICADOR
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '1322-18MM', '3M', ''),
  ('INSUMOS-000052', 'Transpore', 'insumos', 'producto', 'Presentación: CAJA/ 12 PIEZAS', 1, 0, 'caja', '', '3M', '', '', 0.0, '', NULL, NULL, 'TRANSPORE
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '1527-1', '3M', ''),
  ('INSUMOS-000053', 'Durapore', 'insumos', 'producto', 'Presentación: PZA', 2, 0, 'pieza', '', '3M', '', '', 0.0, '', '2025-01-13', NULL, 'DURAPORE
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '1538-1', '3M', ''),
  ('INSUMOS-000054', 'Durapore', 'insumos', 'producto', 'Presentación: PZA', 10, 0, 'pieza', '', '3M', '', '', 0.0, '', '2028-09-19', NULL, 'DURAPORE
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '1538-2', '3M', ''),
  ('INSUMOS-000055', 'Venda elástica Coban', 'insumos', 'producto', 'Presentación: 30PIEZAS', 119, 0, 'pieza', '', '3M', '', '', 0.0, '', '2030-12-01', NULL, 'VENDA ELASTICA COBAN
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '1581', '3M', ''),
  ('INSUMOS-000056', 'COBAN', 'insumos', 'producto', 'Presentación: CAJA/ 36 PIEZAS', 1, 0, 'caja', '', '3M', '', '', 0.0, '', '2026-08-15', NULL, 'COBAN
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '1582', '3M', ''),
  ('INSUMOS-000057', 'Tegaderm', 'insumos', 'producto', 'Presentación: CAJA/ 100 PIEZAS', 13, 0, 'caja', '', '3M', '', '', 0.0, '', '2025-03-18', NULL, 'TEGADERM
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '1624W', '3M', ''),
  ('INSUMOS-000058', 'Tegaderm Film', 'insumos', 'producto', 'Presentación: CAJA/ 25 PIEZAS', 3, 0, 'caja', '', '3M', '', '', 0.0, '', '2026-04-01', NULL, 'TEGARDEM FILM
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '1627', '3M', ''),
  ('INSUMOS-000059', 'Tegaderm apósito de fijación', 'insumos', 'producto', 'Presentación: CAJA/ 100 PIEZAS', 8, 0, 'caja', '', '3M', '', '', 0.0, '', '2025-12-06', NULL, 'TEGADERM APOSITO DE FIJACION
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '1680', '3M', ''),
  ('INSUMOS-000060', 'Tegaderm', 'insumos', 'producto', 'Presentación: CAJA/ 100 PIEZAS', 48, 0, 'caja', '', '3M', '', '', 0.0, '', '2024-12-05', NULL, 'TEGADERM
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '1682', '3M', ''),
  ('INSUMOS-000061', 'Tegaderm', 'insumos', 'producto', 'Presentación: CAJA/ 100 PIEZAS', 11, 0, 'caja', '', '3M', '', '', 0.0, '', '2027-08-05', NULL, 'TEGADERM
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '1683', '3M', ''),
  ('INSUMOS-000062', 'Película protectora sin ardor 3M', 'insumos', 'producto', 'Presentación: CAJA DE 4 PIEZAS', 3, 0, 'caja', '', '3M', '', '', 0.0, '', '2025-02-15', NULL, 'PELICULA PROTECTORA SIN ARDOR 3M
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '3343E', '3M', ''),
  ('INSUMOS-000063', 'Tegaderm+pad', 'insumos', 'producto', 'Presentación: CAJA/ 68 PIEZAS', 4, 0, 'caja', '', '3M', '', '', 0.0, '', '2028-12-19', NULL, 'TEGADERM+PAD
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '3582', '3M', ''),
  ('INSUMOS-000064', 'Tegaderm', 'insumos', 'producto', 'Presentación: CAJA/ 50 PIEZAS', 6, 0, 'caja', '', '3M', '', '', 0.0, '', '2027-01-02', NULL, 'TEGADERM
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '3584', '3M', ''),
  ('INSUMOS-000065', 'Apósito transparente estéril con cojín absorbente', 'insumos', 'producto', 'Presentación: CAJA DE 4 PIEZAS', 1, 0, 'caja', '', '3M', '', '', 0.0, '', '2026-11-25', NULL, 'APOSITO TRANSPARENTE ESTERIL CON COJIN ABSORBENTE
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '3586', '3M', ''),
  ('INSUMOS-000066', 'Tegaderm+pad', 'insumos', 'producto', 'Presentación: CAJA/ 25 PIEZAS', 2, 0, 'caja', '', '3M', '', '', 0.0, '', '2027-01-15', NULL, 'TEGADERM+PAD
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '3590', '3M', ''),
  ('INSUMOS-000067', 'Steri-Gas', 'insumos', 'producto', 'Presentación: CAJA/ 12 PIEZAS', 52, 0, 'caja', '', '3M', '', '', 0.0, '', '2028-08-15', NULL, 'ESTERIGAS (CINTA INDICADORA GAS)
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '4-100', '3M', ''),
  ('INSUMOS-000068', 'Manta térmica pediátrica', 'insumos', 'producto', 'Presentación: CAJA/ 10 PIEZAS', 73, 0, 'caja', '', '3M', '', '', 0.0, '', '2028-05-16', NULL, 'MANTA TERMICA PEDIATRICA
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '55001', '3M', ''),
  ('INSUMOS-000069', 'Manta térmica', 'insumos', 'producto', 'Presentación: CAJA/ 5 PIEZAS', 199, 0, 'caja', '', '3M', '', '', 0.0, '', '2029-01-01', NULL, 'MANTA TERMICA
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '63500', '3M', ''),
  ('INSUMOS-000070', 'Loban 2 Antimicrobial', 'insumos', 'producto', 'Presentación: CAJA/ 10 PIEZAS', 4, 0, 'caja', '', '3M', '', '', 0.0, '', '2026-01-21', NULL, 'LOBAN 2 ANTIMICROBIAL
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '6650', '3M', ''),
  ('INSUMOS-000071', 'Steri-Gas', 'insumos', 'producto', 'Presentación: CAJA/ 12 PIEZAS', 17, 0, 'caja', '', '3M', '', '', 0.0, '', '2030-07-30', NULL, 'ESTERI GAS
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '8-170', '3M', ''),
  ('INSUMOS-000072', 'Cast Padding', 'insumos', 'producto', 'Presentación: 4 BOLSAS CON20 ROLLOS C/U', 5, 0, 'paquete', '', '3M', '', '', 0.0, '', '2025-04-02', NULL, 'CAST PADDING
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'EMW04', '3M', ''),
  ('INSUMOS-000073', 'Venda 82004 Color Blanco', 'insumos', 'producto', 'Presentación: CAJA/ 10 PIEZAS', 27, 0, 'caja', '', '3M', '', '', 0.0, '', '2028-10-12', NULL, 'VENDA 82004 COLOR BLANCO
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'YP206000272', '3M', ''),
  ('INSUMOS-000074', 'Guedel Airway, Size 000, Iso 3.5', 'insumos', 'producto', 'Presentación: PIEZA', 96, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', '2028-03-01', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '1000035', 'Dräger', ''),
  ('INSUMOS-000075', 'Printing Paper 4 Pcs', 'insumos', 'producto', 'Presentación: PIEZA', 22, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', '2024-05-08', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '2606231', 'Dräger', ''),
  ('INSUMOS-000076', 'O2 SENSOR', 'insumos', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', '2026-12-21', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '6850645', 'Dräger', ''),
  ('INSUMOS-000077', 'Water Trap (Trampa De Agua)', 'insumos', 'producto', 'Presentación: CAJA/ 12 PIEZAS', 179, 0, 'caja', '', 'Dräger', '', '', 0.0, '', '2030-01-14', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '6872130', 'Dräger', ''),
  ('INSUMOS-000078', 'Sample Line Set', 'insumos', 'producto', 'Presentación: PIEZA', 21, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', '2030-03-01', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '8290286', 'Dräger', ''),
  ('INSUMOS-000079', 'Papel De Recarga', 'insumos', 'producto', 'Presentación: PIEZA', 8, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '8411073', 'Dräger', ''),
  ('INSUMOS-000080', 'Neo Mask M', 'insumos', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', '2026-11-10', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '8418490', 'Dräger', ''),
  ('INSUMOS-000081', 'Set 4x Pneumatic Nozzle For Atlan', 'insumos', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', '2028-11-25', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '8621751', 'Dräger', ''),
  ('INSUMOS-000082', 'Adaptador Del Alambre Calentador Para Circuitos Respiratorios Calentados', 'insumos', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '900MR805', 'Dräger', ''),
  ('INSUMOS-000083', 'Ventstar Watertrap 180', 'insumos', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP00337', 'Dräger', ''),
  ('INSUMOS-000084', 'Ventstar Watertrap 180', 'insumos', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP003374', 'Dräger', ''),
  ('INSUMOS-000085', 'Ventstar Basic 180', 'insumos', 'producto', 'Presentación: CAJA/25 PIEZAS', 132, 0, 'caja', '', 'Dräger', '', '', 0.0, '', '2027-10-17', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP00349', 'Dräger', ''),
  ('INSUMOS-000086', 'Ventstar Basic (P) 180', 'insumos', 'producto', 'Presentación: PIEZA', 4, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', '2027-09-18', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP00351', 'Dräger', ''),
  ('INSUMOS-000087', 'General Purpose Temperature Adult 3 M', 'insumos', 'producto', 'Presentación: PAQUETE/20 PZS', 1, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', '2026-06-12', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP00992', 'Dräger', ''),
  ('INSUMOS-000088', 'Mask Litestar 1 W/O Hook', 'insumos', 'producto', 'Presentación: PIEZA', 2, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP01101', 'Dräger', ''),
  ('INSUMOS-000089', 'SoftBed Isolette', 'insumos', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', '2029-02-14', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP01401', 'Dräger', ''),
  ('INSUMOS-000090', 'Anillo Gancho Para Mascarilla Litestar Conector 22mm', 'insumos', 'producto', 'Presentación: PIEZA', 11, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP01552-00', 'Dräger', ''),
  ('INSUMOS-000091', 'Mascarilla Facial Niv', 'insumos', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', '2029-08-04', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP01575', 'Dräger', ''),
  ('INSUMOS-000092', 'Ergo Star 40cm', 'insumos', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', '2019-09-21', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP01840', 'Dräger', ''),
  ('INSUMOS-000093', 'Ergo Star 50cm', 'insumos', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', '2019-10-17', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP01850', 'Dräger', ''),
  ('INSUMOS-000094', 'Mascarilla De Silicona Neonatal T1 Reutilizable', 'insumos', 'producto', 'Presentación: PIEZA', 9, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP01911', 'Dräger', ''),
  ('INSUMOS-000095', 'Mascarilla De Silicona Niño Chico T2 Reutilizable', 'insumos', 'producto', 'Presentación: PIEZA', 17, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP01912', 'Dräger', ''),
  ('INSUMOS-000096', 'Mascarilla De Silicona Niño Grande T3 Reutilizable', 'insumos', 'producto', 'Presentación: PIEZA', 15, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP01913', 'Dräger', ''),
  ('INSUMOS-000097', 'Mascarilla de silicona tamaño 4, adulto pequeño reutilizable', 'insumos', 'producto', 'Presentación: PIEZA', 20, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP01914', 'Dräger', ''),
  ('INSUMOS-000098', 'Ventstar Breathing Bag 3l', 'insumos', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP02713', 'Dräger', ''),
  ('INSUMOS-000099', 'Filtro Filtercare Star 20 Plus', 'insumos', 'producto', 'Presentación: CAJA/100 PIEZAS', 133, 0, 'caja', '', 'Dräger', '', '', 0.0, '', '2028-06-12', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP05770', 'Dräger', ''),
  ('INSUMOS-000100', 'Filter/Hme Twinstar 55 Plus', 'insumos', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', '2027-05-29', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP05805', 'Dräger', ''),
  ('INSUMOS-000101', 'Mascarilla Litestar T2 Sin Gancho', 'insumos', 'producto', 'Presentación: CAJA/50 PZS', 46, 0, 'caja', '', 'Dräger', '', '', 0.0, '', '2028-02-20', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP11002', 'Dräger', ''),
  ('INSUMOS-000102', 'Mask Line 4 W/O Hook', 'insumos', 'producto', 'Presentación: CAJA/50 PZS', 84, 0, 'caja', '', 'Dräger', '', '', 0.0, '', '2027-01-07', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP11004', 'Dräger', ''),
  ('INSUMOS-000103', 'Mascarilla Litestar T5 Sin Gancho', 'insumos', 'producto', 'Presentación: PIEZA', 66, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', '2028-07-15', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP11005', 'Dräger', ''),
  ('INSUMOS-000104', 'Neonatal Test Lung, Reusable', 'insumos', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP20050', 'Dräger', ''),
  ('INSUMOS-000105', 'Shp Asy Cnap Gen2', 'insumos', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MS26125', 'Dräger', ''),
  ('INSUMOS-000106', 'Cover, Probe, Cfm,Std, Box/100', 'insumos', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', '2026-01-31', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MU06944', 'Dräger', ''),
  ('INSUMOS-000107', 'Cell-Oxygen', 'insumos', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MU13223-08', 'Dräger', ''),
  ('INSUMOS-000108', 'Oxygen sensor kit', 'insumos', 'producto', 'Presentación: KIT', 5, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', '2027-03-20', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MU24903', 'Dräger', ''),
  ('INSUMOS-000109', 'O2-Sensor Oxytrace Ve', 'insumos', 'producto', 'Presentación: PIEZA', 9, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', '2029-01-20', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MX01049', 'Dräger', ''),
  ('INSUMOS-000110', 'Sonda de temperatura cutánea', 'insumos', 'producto', 'Presentación: BOLSAS/5', 37, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', '2028-09-15', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MX11001', 'Dräger', ''),
  ('INSUMOS-000111', 'Juego De Transferencia', 'insumos', 'producto', 'Presentación: PAQUETE/ 20 PZS', 5, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', '2025-08-03', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MX17018', 'Dräger', ''),
  ('INSUMOS-000112', 'Ibp Adapter Cable Edward Transducer', 'insumos', 'producto', 'Presentación: PIEZA', 15, 0, 'pieza', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'SB0301', 'Dräger', '')
on conflict (sku) do update set
  name = excluded.name,
  category = excluded.category,
  item_kind = excluded.item_kind,
  description = excluded.description,
  min_stock = excluded.min_stock,
  unit = excluded.unit,
  location = excluded.location,
  brand = excluded.brand,
  model = excluded.model,
  serial_number = excluded.serial_number,
  unit_price = excluded.unit_price,
  supplier = excluded.supplier,
  expiry_date = excluded.expiry_date,
  manufactured_at = excluded.manufactured_at,
  notes = excluded.notes,
  asset_status = excluded.asset_status,
  last_maintenance_date = excluded.last_maintenance_date,
  next_maintenance_date = excluded.next_maintenance_date,
  is_active = excluded.is_active,
  tracks_lot = excluded.tracks_lot,
  tracks_serial = excluded.tracks_serial,
  tracks_expiry = excluded.tracks_expiry,
  max_stock = excluded.max_stock,
  reorder_point = excluded.reorder_point,
  part_number = excluded.part_number,
  manufacturer = excluded.manufacturer,
  subcategory = excluded.subcategory;

insert into public.inventory_items (
  sku,
  name,
  category,
  item_kind,
  description,
  quantity,
  min_stock,
  unit,
  location,
  brand,
  model,
  serial_number,
  unit_price,
  supplier,
  expiry_date,
  manufactured_at,
  notes,
  asset_status,
  last_maintenance_date,
  next_maintenance_date,
  is_active,
  tracks_lot,
  tracks_serial,
  tracks_expiry,
  max_stock,
  reorder_point,
  part_number,
  manufacturer,
  subcategory
) values
  ('INSUMOS-000113', 'Emma Airway Adapter', 'insumos', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Masimo', '', '', 0.0, '', '2020-06-28', NULL, 'insumo
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '100660', 'Masimo', ''),
  ('INSUMOS-000114', 'Multisite Reusable Sensor', 'insumos', 'producto', 'Presentación: CAJA/20 PIEZAS', 43, 0, 'caja', '', 'Masimo', '', '', 0.0, '', '2021-06-01', '2021-06-01', 'insumo
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '2258', 'Masimo', ''),
  ('INSUMOS-000115', 'Pulse Oximeter Adhesive Sensor', 'insumos', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Masimo', '', '', 0.0, '', '2026-07-01', NULL, 'INSUMO
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '4002', 'Masimo', ''),
  ('INSUMOS-000116', 'Root Battery Replacement Kit', 'insumos', 'producto', 'Presentación: PIEZA', 3, 0, 'pieza', '', 'Masimo', '', '', 0.0, '', NULL, '2024-01-01', 'INSUMO
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '4545', 'Masimo', ''),
  ('INSUMOS-000117', 'Papel térmico químico', 'insumos', 'producto', 'Presentación: PIEZA', 10, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '40457C', 'Philips', ''),
  ('INSUMOS-000118', '3 Lead Ecg Trunk, Aami/Iec 2.7m', 'insumos', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', '2022-07-11', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'M1669A', 'Philips', ''),
  ('INSUMOS-000119', '3 Leadset, Snap, Aami, Icu', 'insumos', 'producto', 'Presentación: PIEZA', 1, 0, 'pieza', '', 'Philips', '', '', 0.0, '', '2021-07-07', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'M1673A', 'Philips', ''),
  ('INSUMOS-000120', 'Papel De Registro Ecg Para Philips', 'insumos', 'producto', 'Presentación: PIEZA', 22, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'M2481A', 'Philips', ''),
  ('INSUMOS-000121', 'Papel De Registro Ecg Para Philips', 'insumos', 'producto', 'Presentación: PIEZA', 29, 0, 'pieza', '', 'Philips', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'M3708A', 'Philips', ''),
  ('INSUMOS-000122', 'Electrodos Stress Kit', 'insumos', 'producto', 'Presentación: CAJA/10', 51, 0, 'caja', '', 'Welch Allyn', '', '', 0.0, '', '2017-10-01', NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '45003-0000', 'Welch Allyn', ''),
  ('INSUMOS-000123', 'Papel Datox 53mm', 'insumos', 'producto', 'Presentación: PAQUETE/ 20 PIEZAS', 4, 0, 'paquete', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, 'PARTE DE ATRAS
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '74205', 'Welch Allyn', ''),
  ('INSUMOS-000124', 'Papel ECG CP1200 (cardiopulmonar) caja 1000 hjs', 'insumos', 'producto', 'Presentación: CAJA/ 1000 HJS', 12, 0, 'caja', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '901006', 'Welch Allyn', ''),
  ('INSUMOS-000125', 'Recording Papers', 'insumos', 'producto', 'Presentación: CAJA/ 1000 HJS', 10, 0, 'caja', '', 'Welch Allyn', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'E9001EZ', 'Welch Allyn', ''),
  ('INSUMOS-000126', 'Lámpara dual de quirófano Polaris 100/200', 'insumos', 'producto', '', 0, 0, 'pieza', '', 'Dräger', 'Polaris 100 /200', '', 0.0, 'Dräger', NULL, NULL, '', 'operativo', NULL, NULL, true, true, true, true, 0, 0, 'G16981 / G16982', 'Dräger', ''),
  ('INSUMOS-000127', 'Pieza Dräger 8412015', 'insumos', 'producto', 'Cedros DRAGER · ubicación E/26', 160, 0, 'pieza', '', 'Dräger', '', '', 0.0, 'Dräger', NULL, NULL, 'Cedros DRAGER · ubicación E/26', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '8412015', 'Dräger', ''),
  ('INSUMOS-000128', 'Insumo Dräger MP00352', 'insumos', 'producto', 'Cedros DRAGER · CAJA/25 PIEZAS · Bodega Palma', 40, 0, 'caja', '', 'Dräger', '', '', 0.0, 'Dräger', NULL, NULL, 'Cedros DRAGER · CAJA/25 PIEZAS · Bodega Palma', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MP00352', 'Dräger', ''),
  ('INSUMOS-000129', 'Pieza Welch Allyn 11470', 'insumos', 'producto', 'Cedros WA · ubicación A/3', 1, 0, 'pieza', '', 'Welch Allyn', '', '', 0.0, 'Welch Allyn', NULL, NULL, 'Cedros WA · ubicación A/3', 'operativo', NULL, NULL, true, true, false, true, 0, 0, '11470', 'Welch Allyn', ''),
  ('INSUMOS-000130', 'Electrodos descartables ECG / Electrodo neonatal (genérico)', 'insumos', 'producto', 'Cedros DRAGER+3M · MPGBW-78RT', 98, 0, 'pieza', '', 'Dräger', '', '', 0.0, 'Dräger', '2027-02-06', NULL, 'Cedros DRAGER+3M · MPGBW-78RT', 'operativo', NULL, NULL, true, true, false, true, 0, 0, 'MPGBW-78RT', 'Dräger', ''),
  ('REFACCIONES-000001', 'Superficie de prevención NP50', 'refacciones', 'producto', '', 0, 10, 'pieza', 'Palma ', 'Hill-Rom', 'NP50', '2540-N-0096-03', 5500.0, 'Hill-Rom', NULL, NULL, '', 'operativo', NULL, NULL, true, false, true, false, 0, 10, 'ASS028', 'Hill-Rom', ''),
  ('REFACCIONES-000002', 'Batería de reemplazo Radical-7 (Li-ion 3.7 V)', 'refacciones', 'producto', '', 5, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, '2019-10-01', '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '4676', 'Masimo', ''),
  ('REFACCIONES-000003', 'Eve – Modo de tamizaje neonatal CCHD (licencia, Radical-7)', 'refacciones', 'producto', '', 12, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '3645', 'Masimo', ''),
  ('REFACCIONES-000004', 'Kit de herramientas para reemplazo de batería para Root', 'refacciones', 'producto', '', 6, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '9913', 'Masimo', ''),
  ('REFACCIONES-000005', 'Masimo Trace', 'refacciones', 'producto', '', 2, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '9853', 'Masimo', ''),
  ('REFACCIONES-000006', 'Accessory handheld lock for use with Radical 7 Color Screen signal extraction pulse oximeter', 'refacciones', 'producto', '', 0, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, false, true, false, false, 0, 0, '2350', 'Masimo', ''),
  ('REFACCIONES-000007', 'Full Rainbow License Rainbow Parameter Installation tool Includes Measurements: SpCO, SpMet, SpHb, SpOC, Pi Delta 3D Alarm, Desat Index 3D alarm, Pleth Variability Index (PVi)', 'refacciones', 'producto', '', 6, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, true, true, false, 0, 0, '9081', 'Masimo', ''),
  ('REFACCIONES-000008', 'Field Upgrader Rainbow Parameter Installation Tool Pleth Variability Index (PVi)', 'refacciones', 'producto', '', 0, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '9081', 'Masimo', ''),
  ('REFACCIONES-000009', 'Field Upgrader Rainbow Parameter Installation Tool SpHb, SpOC', 'refacciones', 'producto', '', 0, 0, 'pieza', '', 'Masimo', '', '', 0.0, 'Masimo', NULL, NULL, '', 'operativo', NULL, NULL, true, false, true, false, 0, 0, '9081', 'Masimo', ''),
  ('REFACCIONES-000010', 'Juego De Piezas De Repuesto', 'refacciones', 'producto', 'Presentación: PAQUETE/30 PZS', 1, 0, 'paquete', '', 'Dräger', '', '', 0.0, '', NULL, NULL, '
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, false, false, false, 0, 0, 'MXDM100000975', 'Dräger', ''),
  ('REFACCIONES-000011', 'Upgrade Tool, Eve', 'refacciones', 'producto', 'Presentación: PIEZA', 7, 0, 'pieza', '', 'Masimo', '', '', 0.0, '', NULL, NULL, 'refaccion
<!--mas-color:rojo-->', 'operativo', NULL, NULL, true, true, false, false, 0, 0, '9848', 'Masimo', '')
on conflict (sku) do update set
  name = excluded.name,
  category = excluded.category,
  item_kind = excluded.item_kind,
  description = excluded.description,
  min_stock = excluded.min_stock,
  unit = excluded.unit,
  location = excluded.location,
  brand = excluded.brand,
  model = excluded.model,
  serial_number = excluded.serial_number,
  unit_price = excluded.unit_price,
  supplier = excluded.supplier,
  expiry_date = excluded.expiry_date,
  manufactured_at = excluded.manufactured_at,
  notes = excluded.notes,
  asset_status = excluded.asset_status,
  last_maintenance_date = excluded.last_maintenance_date,
  next_maintenance_date = excluded.next_maintenance_date,
  is_active = excluded.is_active,
  tracks_lot = excluded.tracks_lot,
  tracks_serial = excluded.tracks_serial,
  tracks_expiry = excluded.tracks_expiry,
  max_stock = excluded.max_stock,
  reorder_point = excluded.reorder_point,
  part_number = excluded.part_number,
  manufacturer = excluded.manufacturer,
  subcategory = excluded.subcategory;

alter table public.inventory_items enable trigger inventory_items_protect_quantity;
commit;
