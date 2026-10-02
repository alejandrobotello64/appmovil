-- Ubica la existencia de un producto dentro de un almacén: mueve todos sus saldos (conservando
-- lote) y sus números de serie a una ubicación existente o nueva del mismo almacén.
create or replace function public.relocate_stock(
  p_product_id uuid,
  p_warehouse_id uuid,
  p_location_id uuid default null,
  p_location_name text default null,
  p_note text default '',
  p_created_by text default ''
)
returns table (folio text, moved_qty integer, target_location_id uuid, target_location_name text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_item public.inventory_items%rowtype;
  v_loc_id uuid;
  v_loc_name text;
  v_name text := nullif(trim(coalesce(p_location_name, '')), '');
  v_code text;
  v_row record;
  v_moved integer := 0;
  v_from_loc uuid;
  v_from_name text := '';
  v_folio text := '';
begin
  if coalesce(p_created_by, '') = '' then
    raise exception 'La reubicación requiere un usuario responsable';
  end if;

  select * into v_item from public.inventory_items where id = p_product_id;
  if not found then
    raise exception 'Producto no encontrado';
  end if;

  if not exists (select 1 from public.warehouses w where w.id = p_warehouse_id and w.is_active) then
    raise exception 'Almacén no válido';
  end if;

  if p_location_id is not null then
    select l.id, l.name into v_loc_id, v_loc_name
    from public.locations l
    where l.id = p_location_id and l.warehouse_id = p_warehouse_id;
    if v_loc_id is null then
      raise exception 'La ubicación no pertenece al almacén seleccionado';
    end if;
  elsif v_name is not null then
    v_code := trim(both '-' from left(
      regexp_replace(upper(translate(v_name, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^A-Z0-9]+', '-', 'g'),
      24
    ));
    if v_code = '' then
      raise exception 'Nombre de ubicación no válido';
    end if;

    select l.id, l.name into v_loc_id, v_loc_name
    from public.locations l
    where l.warehouse_id = p_warehouse_id
      and (lower(l.name) = lower(v_name) or l.code = v_code)
    limit 1;

    if v_loc_id is null then
      insert into public.locations (warehouse_id, code, name)
      values (p_warehouse_id, v_code, v_name)
      returning id, name into v_loc_id, v_loc_name;
    end if;
  else
    raise exception 'Indica la ubicación destino';
  end if;

  update public.locations set is_active = true where id = v_loc_id and is_active is false;

  for v_row in
    select b.id, b.location_id, b.lot_id, b.qty_on_hand
    from public.inventory_balances b
    where b.product_id = p_product_id
      and b.warehouse_id = p_warehouse_id
      and b.location_id is distinct from v_loc_id
      and b.qty_on_hand > 0
    for update
  loop
    update public.inventory_balances set qty_on_hand = 0, updated_at = now() where id = v_row.id;

    insert into public.inventory_balances (product_id, warehouse_id, location_id, lot_id, qty_on_hand)
    values (p_product_id, p_warehouse_id, v_loc_id, v_row.lot_id, v_row.qty_on_hand)
    on conflict (product_id, warehouse_id, location_id, lot_id)
    do update set qty_on_hand = public.inventory_balances.qty_on_hand + excluded.qty_on_hand,
                  updated_at = now();

    v_moved := v_moved + v_row.qty_on_hand;
    v_from_loc := coalesce(v_from_loc, v_row.location_id);
  end loop;

  update public.serial_numbers
  set location_id = v_loc_id
  where product_id = p_product_id
    and warehouse_id = p_warehouse_id
    and status <> 'baja';

  update public.inventory_items set location = v_loc_name where id = p_product_id;

  if v_moved > 0 then
    select coalesce(string_agg(distinct l.name, ', '), '') into v_from_name
    from public.locations l where l.id = v_from_loc;

    v_folio := public.next_document_folio('TR');

    insert into public.inventory_movements (
      folio, movement_type, document_type, product_id, product_sku, product_name,
      warehouse_id, location_id, from_warehouse_id, to_warehouse_id, from_location_id, to_location_id,
      qty_in, qty_out, resulting_qty, unit_cost, note, created_by
    ) values (
      v_folio, 'cambio_ubicacion', 'TR', p_product_id, v_item.sku, v_item.name,
      p_warehouse_id, v_loc_id, p_warehouse_id, p_warehouse_id, v_from_loc, v_loc_id,
      v_moved, v_moved, v_item.quantity, v_item.unit_price, coalesce(p_note, ''), p_created_by
    );

    insert into public.warehouse_movements (
      item_id, item_sku, item_name, movement_type, quantity,
      previous_quantity, new_quantity, note, created_by, from_location, to_location
    ) values (
      p_product_id, v_item.sku, v_item.name, 'cambio_ubicacion', v_moved,
      v_item.quantity, v_item.quantity, coalesce(p_note, ''), p_created_by,
      coalesce(v_from_name, ''), v_loc_name
    );
  end if;

  insert into public.audit_logs (username, action, module, document_folio, record_id, previous_value, new_value)
  values (
    p_created_by, 'ubicacion', 'almacen', v_folio, p_product_id::text,
    coalesce(v_item.location, ''), v_loc_name
  );

  folio := v_folio;
  moved_qty := v_moved;
  target_location_id := v_loc_id;
  target_location_name := v_loc_name;
  return next;
end;
$$;

grant execute on function public.relocate_stock(uuid, uuid, uuid, text, text, text) to anon, authenticated;
