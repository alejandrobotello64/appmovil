-- Accesorios: sin caducidad; con fecha de fabricación.

alter table public.inventory_items
  add column if not exists manufactured_at date;

comment on column public.inventory_items.manufactured_at is
  'Fecha de fabricación. Obligatoria en accesorios; no sustituye caducidad de insumos/medicamentos/reactivos.';

comment on view public.accesorios_items is
  'Accesorios: fecha de fabricación, sin caducidad.';

create or replace function public.inventory_items_enforce_category_rules()
returns trigger
language plpgsql
as $$
begin
  if new.item_kind = 'equipo' or new.category = 'equipos' then
    new.item_kind := 'equipo';
    new.category := 'equipos';
    new.tracks_serial := true;
    return new;
  end if;

  if new.category in ('insumos', 'medicamentos', 'reactivos') then
    new.tracks_expiry := true;
    new.tracks_lot := true;
  end if;

  if new.category = 'accesorios' then
    new.tracks_expiry := false;
    new.expiry_date := null;
  end if;

  return new;
end;
$$;

update public.inventory_items
set
  tracks_expiry = false,
  expiry_date = null
where category = 'accesorios';

notify pgrst, 'reload schema';
