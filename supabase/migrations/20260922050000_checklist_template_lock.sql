-- Candado en plantillas de checklist / pruebas de funcionamiento.

alter table public.service_checklist_templates
  add column if not exists locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text not null default '';

create index if not exists service_checklist_templates_locked_idx
  on public.service_checklist_templates (locked)
  where locked = true;

notify pgrst, 'reload schema';
