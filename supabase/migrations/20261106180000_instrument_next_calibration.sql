-- Próxima calibración de simuladores y analizadores, ligada a un evento del calendario.

alter table public.biomedical_instruments
  add column if not exists next_calibration_at date,
  add column if not exists calibration_event_id uuid references public.calendar_events(id) on delete set null;

create index if not exists biomedical_instruments_calibration_idx
  on public.biomedical_instruments (next_calibration_at)
  where next_calibration_at is not null;

notify pgrst, 'reload schema';
