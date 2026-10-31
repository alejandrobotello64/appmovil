-- Tipo de impuesto reconocido al subir el CFDI de un gasto.
alter table public.expense_items
  add column if not exists tax_type text not null default '';

comment on column public.expense_items.tax_type is
  'Tipo de impuesto leído del CFDI, por ejemplo IVA 16% o ISR retenido.';
