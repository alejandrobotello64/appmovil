-- Documentación escaneada de la orden firmada y sellada por el hospital.

do $$
declare
  conname text;
begin
  select con.conname into conname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'service_order_documents'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%doc_type%'
  limit 1;
  if conname is not null then
    execute format('alter table public.service_order_documents drop constraint %I', conname);
  end if;
end $$;

alter table public.service_order_documents
  drop constraint if exists service_order_documents_doc_type_check;

alter table public.service_order_documents
  add constraint service_order_documents_doc_type_check
  check (doc_type in ('seguridad_electrica', 'orden_firmada', 'otro'));

notify pgrst, 'reload schema';
