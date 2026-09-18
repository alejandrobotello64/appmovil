-- Licitaciones CompraMX (participación como proveedor)

create table if not exists public.tenders (
  id uuid primary key default gen_random_uuid(),
  folio_interno text not null unique,
  folio_comprasmx text not null default '',
  url_comprasmx text not null default '',
  title text not null,
  description text not null default '',
  convocante text not null default '',
  client_id uuid references public.clients(id) on delete set null,
  state text not null default '',
  city text not null default '',
  procedimiento text not null default 'LP'
    check (procedimiento in ('LP', 'ITP', 'AD', 'otro')),
  caracter text not null default 'federal'
    check (caracter in ('federal', 'estatal', 'municipal', 'otro')),
  status text not null default 'prospecto'
    check (status in (
      'prospecto', 'analisis', 'en_preparacion', 'presentada',
      'en_evaluacion', 'ganada', 'perdida', 'desierta', 'cancelada'
    )),
  published_at date,
  junta_aclaraciones date,
  limite_preguntas date,
  limite_propuestas date,
  fallo_at date,
  firma_at date,
  monto_estimado numeric(14,2) not null default 0,
  monto_ofertado numeric(14,2) not null default 0,
  moneda text not null default 'MXN',
  responsable_nombre text not null default '',
  probabilidad integer not null default 0 check (probabilidad between 0 and 100),
  notes text not null default '',
  hold_id uuid,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tender_lines (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders(id) on delete cascade,
  clave_partida text not null default '',
  descripcion text not null default '',
  product_id uuid references public.inventory_items(id) on delete set null,
  quantity numeric(14,2) not null default 1 check (quantity > 0),
  unit text not null default 'pza',
  unit_price numeric(14,2) not null default 0,
  cumple_espec text not null default 'si'
    check (cumple_espec in ('si', 'no', 'parcial')),
  nota_tecnica text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tender_events (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders(id) on delete cascade,
  event_type text not null default 'nota',
  message text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.tender_documents (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders(id) on delete cascade,
  doc_type text not null default 'otro'
    check (doc_type in (
      'bases', 'anexos', 'propuesta_tecnica', 'propuesta_economica',
      'fianzas', 'fallo', 'otro'
    )),
  name text not null,
  file_path text not null default '',
  file_url text not null default '',
  notes text not null default '',
  uploaded_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists tenders_status_idx on public.tenders (status, limite_propuestas);
create index if not exists tenders_folio_cmx_idx on public.tenders (folio_comprasmx);
create index if not exists tender_lines_tender_idx on public.tender_lines (tender_id);
create index if not exists tender_events_tender_idx on public.tender_events (tender_id, created_at desc);
create index if not exists tender_documents_tender_idx on public.tender_documents (tender_id);

drop trigger if exists tenders_set_updated_at on public.tenders;
create trigger tenders_set_updated_at
before update on public.tenders
for each row execute function public.set_updated_at();

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public)
  values ('tender-documents', 'tender-documents', true)
  on conflict (id) do nothing;
end $$;

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'tender_documents_select'
  ) then
    create policy tender_documents_select on storage.objects
      for select using (bucket_id = 'tender-documents');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'tender_documents_insert'
  ) then
    create policy tender_documents_insert on storage.objects
      for insert with check (bucket_id = 'tender-documents');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'tender_documents_update'
  ) then
    create policy tender_documents_update on storage.objects
      for update using (bucket_id = 'tender-documents');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'tender_documents_delete'
  ) then
    create policy tender_documents_delete on storage.objects
      for delete using (bucket_id = 'tender-documents');
  end if;
end $$;

grant select, insert, update, delete on public.tenders to anon, authenticated;
grant select, insert, update, delete on public.tender_lines to anon, authenticated;
grant select, insert, update, delete on public.tender_events to anon, authenticated;
grant select, insert, update, delete on public.tender_documents to anon, authenticated;

notify pgrst, 'reload schema';
