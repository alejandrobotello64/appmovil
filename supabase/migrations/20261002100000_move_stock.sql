-- Moves an exact quantity of one balance (product + warehouse + location + lot) to another
-- warehouse/location, keeping the lot. Serialized stock requires the serial numbers to move.
create or replace function public.move_stock(
  p_product_id uuid,
  p_from_warehouse_id uuid,
  p_from_location_id uuid,
  p_lot_id uuid,
  p_quantity integer,
  p_to_warehouse_id uuid,
  p_to_location_id uuid default null,
  p_to_location_name text default null,
  p_serial_numbers text[] default null,
  p_note text default '',
  p_created_by text default ''
)
returns table(folio text, moved_qty integer, target_location_id uuid, target_location_name text)
language plpgsql
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_item public.inventory_items%rowtype;
  v_from_wh public.warehouses%rowtype;
  v_to_wh public.warehouses%rowtype;
  v_from_loc_name text;
  v_to_loc_id uuid;
  v_to_loc_name text;
  v_name text := nullif(trim(coalesce(p_to_location_name, '')), '');
  v_code text;
  v_balance public.inventory_balances%rowtype;
  v_available integer;
  v_serial_count integer;
  v_serials text[] := coalesce(p_serial_numbers, '{}');
  v_updated integer;
  v_folio text;
  v_is_transfer boolean := p_from_warehouse_id is distinct from p_to_warehouse_id;
begin
  if coalesce(p_created_by, '') = '' then
    raise exception 'El movimiento requiere un usuario responsable';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;

  select * into v_item from public.inventory_items where id = p_product_id;
  if not found then
    raise exception 'Producto no encontrado';
  end if;

  select * into v_from_wh from public.warehouses where id = p_from_warehouse_id;
  if not found then
    raise exception 'Almacén de origen no válido';
  end if;
  select * into v_to_wh from public.warehouses where id = p_to_warehouse_id and is_active;
  if not found then
    raise exception 'Almacén destino no válido o inactivo';
  end if;

  if p_to_location_id is not null then
    select l.id, l.name into v_to_loc_id, v_to_loc_name
    from public.locations l
    where l.id = p_to_location_id and l.warehouse_id = p_to_warehouse_id;
    if v_to_loc_id is null then
      raise exception 'La ubicación destino no pertenece al almacén destino';
    end if;
  elsif v_name is not null then
    v_code := trim(both '-' from left(
      regexp_replace(upper(translate(v_name, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^A-Z0-9]+', '-', 'g'),
      24
    ));
    if v_code = '' then
      raise exception 'Nombre de ubicación no válido';
    end if;
    select l.id, l.name into v_to_loc_id, v_to_loc_name
    from public.locations l
    where l.warehouse_id = p_to_warehouse_id
      and (lower(l.name) = lower(v_name) or l.code = v_code)
    limit 1;
    if v_to_loc_id is null then
      insert into public.locations (warehouse_id, code, name)
      values (p_to_warehouse_id, v_code, v_name)
      returning id, name into v_to_loc_id, v_to_loc_name;
    end if;
  else
    raise exception 'Indica la ubicación destino';
  end if;

  update public.locations set is_active = true where id = v_to_loc_id and is_active is false;

  if p_from_warehouse_id = p_to_warehouse_id and p_from_location_id is not distinct from v_to_loc_id then
    raise exception 'El destino es igual al origen';
  end if;

  select * into v_balance
  from public.inventory_balances b
  where b.product_id = p_product_id
    and b.warehouse_id = p_from_warehouse_id
    and b.location_id is not distinct from p_from_location_id
    and b.lot_id is not distinct from p_lot_id
  for update;
  if not found then
    raise exception 'No hay existencia en el origen seleccionado';
  end if;

  v_available := v_balance.qty_on_hand - coalesce(v_balance.qty_reserved, 0);
  if p_quantity > v_available then
    raise exception 'Solo hay % disponible(s) en el origen', greatest(v_available, 0);
  end if;

  select count(*) into v_serial_count
  from public.serial_numbers s
  where s.product_id = p_product_id
    and s.warehouse_id = p_from_warehouse_id
    and (s.location_id is not distinct from p_from_location_id or s.location_id is null)
    and s.status = 'disponible';

  if v_serial_count > 0 then
    if coalesce(array_length(v_serials, 1), 0) <> p_quantity then
      raise exception 'Selecciona % número(s) de serie a mover', p_quantity;
    end if;
    update public.serial_numbers s
    set warehouse_id = p_to_warehouse_id, location_id = v_to_loc_id
    where s.product_id = p_product_id
      and s.serial_number = any(v_serials)
      and s.warehouse_id = p_from_warehouse_id
      and (s.location_id is not distinct from p_from_location_id or s.location_id is null)
      and s.status = 'disponible';
    get diagnostics v_updated = row_count;
    if v_updated <> p_quantity then
      raise exception 'Algún número de serie no está disponible en el origen';
    end if;
  end if;

  update public.inventory_balances
  set qty_on_hand = qty_on_hand - p_quantity, updated_at = now()
  where id = v_balance.id;

  insert into public.inventory_balances (product_id, warehouse_id, location_id, lot_id, qty_on_hand)
  values (p_product_id, p_to_warehouse_id, v_to_loc_id, p_lot_id, p_quantity)
  on conflict (product_id, warehouse_id, location_id, lot_id)
  do update set qty_on_hand = public.inventory_balances.qty_on_hand + excluded.qty_on_hand,
                updated_at = now();

  perform public.sync_item_quantity(p_product_id);

  update public.inventory_items i
  set location = coalesce((
    select l.name
    from public.inventory_balances b
    join public.locations l on l.id = b.location_id
    where b.product_id = p_product_id and b.qty_on_hand > 0
    order by b.qty_on_hand desc
    limit 1
  ), i.location)
  where i.id = p_product_id;

  select name into v_from_loc_name from public.locations where id = p_from_location_id;
  v_folio := public.next_document_folio('TR');

  if v_is_transfer then
    insert into public.stock_transfers (
      folio, status, from_warehouse_id, to_warehouse_id, from_location_id, to_location_id, notes, created_by
    ) values (
      v_folio, 'recibido', p_from_warehouse_id, p_to_warehouse_id, p_from_location_id, v_to_loc_id,
      coalesce(p_note, ''), p_created_by
    );
  end if;

  insert into public.inventory_movements (
    folio, movement_type, document_type, product_id, product_sku, product_name,
    warehouse_id, location_id, from_warehouse_id, to_warehouse_id, from_location_id, to_location_id,
    lot_id, qty_in, qty_out, resulting_qty, unit_cost, reason, note, created_by, related_serial
  ) values (
    v_folio, case when v_is_transfer then 'traspaso' else 'cambio_ubicacion' end, 'TR',
    p_product_id, v_item.sku, v_item.name,
    p_to_warehouse_id, v_to_loc_id, p_from_warehouse_id, p_to_warehouse_id, p_from_location_id, v_to_loc_id,
    p_lot_id, p_quantity, p_quantity, v_item.quantity, v_item.unit_price,
    case when v_is_transfer then 'Traspaso entre almacenes' else 'Cambio de ubicación' end,
    coalesce(p_note, ''), p_created_by, array_to_string(v_serials, ', ')
  );

  insert into public.warehouse_movements (
    item_id, item_sku, item_name, movement_type, quantity,
    previous_quantity, new_quantity, note, created_by, from_location, to_location
  ) values (
    p_product_id, v_item.sku, v_item.name, 'cambio_ubicacion', p_quantity,
    v_item.quantity, v_item.quantity, coalesce(p_note, ''), p_created_by,
    concat_ws(' — ', v_from_wh.code, v_from_loc_name), concat_ws(' — ', v_to_wh.code, v_to_loc_name)
  );

  insert into public.audit_logs (username, action, module, document_folio, record_id, previous_value, new_value)
  values (
    p_created_by, case when v_is_transfer then 'traspaso' else 'ubicacion' end, 'almacen', v_folio,
    p_product_id::text,
    concat_ws(' — ', v_from_wh.code, v_from_loc_name),
    concat_ws(' — ', v_to_wh.code, v_to_loc_name) || ' (' || p_quantity || ')'
  );

  folio := v_folio;
  moved_qty := p_quantity;
  target_location_id := v_to_loc_id;
  target_location_name := v_to_loc_name;
  return next;
end;
$function$;

grant execute on function public.move_stock(uuid, uuid, uuid, uuid, integer, uuid, uuid, text, text[], text, text)
  to anon, authenticated;
