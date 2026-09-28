-- La biblioteca de documentos se divide por área:
-- ventas (brochures, folletos, presentaciones), biomedica (manuales y documentos
-- técnicos y de servicio) y almacen (registros sanitarios y certificados).
alter table public.sales_catalog_documents
  add column if not exists area text not null default 'ventas'
    check (area in ('ventas', 'biomedica', 'almacen'));

update public.sales_catalog_documents
set area = 'biomedica'
where doc_type in ('ficha_tecnica', 'manual', 'manual_servicio', 'boletin_servicio', 'procedimiento', 'diagrama');

update public.sales_catalog_documents
set area = 'almacen'
where doc_type in ('registro_sanitario', 'prorroga_registro', 'certificado');

create index if not exists sales_catalog_documents_area_idx
  on public.sales_catalog_documents (area, created_at desc);
