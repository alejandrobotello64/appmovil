-- Códigos de barras / QR de cada producto (EAN, UPC, GTIN de GS1 o etiquetas propias).
alter table public.inventory_items
  add column if not exists barcodes text[] not null default '{}';

create index if not exists inventory_items_barcodes_idx
  on public.inventory_items using gin (barcodes);

comment on column public.inventory_items.barcodes is
  'Códigos que identifican el producto al escanear: del fabricante (EAN/UPC/GTIN) o etiquetas propias.';

notify pgrst, 'reload schema';
