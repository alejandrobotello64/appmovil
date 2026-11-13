-- Desglose exacto de impuestos del comprobante, para separar lo deducible.
alter table public.expense_items
  add column if not exists iva numeric(12,2) not null default 0,
  add column if not exists ieps numeric(12,2) not null default 0,
  add column if not exists ish numeric(12,2) not null default 0,
  add column if not exists other_tax numeric(12,2) not null default 0,
  add column if not exists withheld numeric(12,2) not null default 0;

comment on column public.expense_items.iva is 'IVA trasladado leído del CFDI.';
comment on column public.expense_items.ieps is 'IEPS trasladado; no es deducible.';
comment on column public.expense_items.ish is 'Impuesto sobre hospedaje (local); es deducible.';
comment on column public.expense_items.other_tax is 'Otros impuestos trasladados; no son deducibles.';
comment on column public.expense_items.withheld is 'Retenciones (IVA, ISR, locales) que restan al total.';

notify pgrst, 'reload schema';
