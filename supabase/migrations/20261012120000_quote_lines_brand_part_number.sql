-- Snapshot de marca y n.º de parte (referencia) en cada partida de cotización.

alter table public.quote_lines
  add column if not exists brand text not null default '';

alter table public.quote_lines
  add column if not exists part_number text not null default '';

notify pgrst, 'reload schema';
