-- Encuestas de satisfacción de clientes (módulo Calidad).
-- Envío por WhatsApp con enlace público /encuesta/{token}.

create table if not exists public.quality_surveys (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  token text not null unique,
  status text not null default 'borrador'
    check (status in ('borrador', 'enviada', 'respondida', 'cancelada')),
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null default '',
  contact_name text not null default '',
  contact_phone text not null default '',
  service_order_id uuid references public.service_orders(id) on delete set null,
  service_order_folio text not null default '',
  sent_at timestamptz,
  responded_at timestamptz,
  score_overall integer check (score_overall is null or (score_overall between 1 and 5)),
  score_response_time integer check (score_response_time is null or (score_response_time between 1 and 5)),
  score_technician integer check (score_technician is null or (score_technician between 1 and 5)),
  score_work_quality integer check (score_work_quality is null or (score_work_quality between 1 and 5)),
  score_communication integer check (score_communication is null or (score_communication between 1 and 5)),
  would_recommend boolean,
  comments text not null default '',
  respondent_name text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quality_surveys_created_at_idx
  on public.quality_surveys (created_at desc);

create index if not exists quality_surveys_status_idx
  on public.quality_surveys (status);

create index if not exists quality_surveys_client_idx
  on public.quality_surveys (client_id);

create index if not exists quality_surveys_token_idx
  on public.quality_surveys (token);

drop trigger if exists quality_surveys_set_updated_at on public.quality_surveys;
create trigger quality_surveys_set_updated_at
before update on public.quality_surveys
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.quality_surveys to anon, authenticated;

notify pgrst, 'reload schema';
