-- Surtir/salida descuenta de la ubicación y lote donde sí hay existencia.
-- Antes, si no se pedía almacén, se usaba la ubicación genérica de categoría
-- (p. ej. ACCESORIOS) aunque el stock estuviera en E/22, E/23, etc.

CREATE OR REPLACE FUNCTION public.apply_stock_movement(p_product_id uuid, p_movement_type text, p_quantity integer, p_note text DEFAULT ''::text, p_created_by text DEFAULT ''::text, p_reason text DEFAULT ''::text, p_warehouse_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_lot_number text DEFAULT NULL::text, p_expiry_date date DEFAULT NULL::date, p_serial_number text DEFAULT NULL::text, p_supplier_name text DEFAULT ''::text, p_purchase_order_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(folio text, movement_id uuid, new_quantity integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_item public.inventory_items%rowtype;
  v_warehouse_id uuid;
  v_location_id uuid;
  v_lot_id uuid;
  v_serial_id uuid;
  v_folio text;
  v_prefix text;
  v_balance integer := 0;
  v_qty_in integer := 0;
  v_qty_out integer := 0;
  v_new_qty integer := 0;
  v_movement_id uuid;
  v_from_loc text := '';
  v_to_loc text := '';
  v_compat_type text;
  v_bin_picked boolean := false;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;
  if coalesce(p_created_by, '') = '' then
    raise exception 'El movimiento requiere un usuario responsable';
  end if;

  select * into v_item from public.inventory_items where id = p_product_id;
  if not found then
    raise exception 'Producto no encontrado';
  end if;
  if v_item.is_active is false then
    raise exception 'El producto está inactivo';
  end if;

  v_warehouse_id := p_warehouse_id;
  if v_warehouse_id is null then
    select default_warehouse_id into v_warehouse_id from public.inventory_settings where id = 1;
  end if;
  if v_warehouse_id is null then
    select id into v_warehouse_id from public.warehouses where is_default limit 1;
  end if;

  v_location_id := p_location_id;
  if v_location_id is null then
    select id into v_location_id
    from public.locations
    where warehouse_id = v_warehouse_id
      and code = case
        when v_item.category = 'medicamentos' then 'MEDICAMENTOS'
        when v_item.category = 'insumos' then 'INSUMOS'
        when v_item.category = 'refacciones' then 'REFACCIONES'
        when v_item.category = 'accesorios' then 'ACCESORIOS'
        when v_item.item_kind = 'equipo' then 'EQUIPOS'
        else 'GENERAL'
      end
    limit 1;
  end if;
  if v_location_id is null then
    select id into v_location_id
    from public.locations
    where warehouse_id = v_warehouse_id and code = 'GENERAL'
    limit 1;
  end if;

  if p_movement_type in ('entrada', 'devolucion', 'ajuste_sobrante') then
    v_qty_in := p_quantity;
    v_prefix := case p_movement_type
      when 'devolucion' then 'DEV'
      else 'EM'
    end;
  elsif p_movement_type = 'canje_caducado' then
    v_qty_in := p_quantity;
    v_qty_out := p_quantity;
    v_prefix := 'CNJ';
  elsif p_movement_type in ('salida', 'ajuste_faltante') then
    v_qty_out := p_quantity;
    v_prefix := case p_movement_type when 'salida' then 'SAL' else 'AJ' end;
  else
    raise exception 'Tipo de movimiento no válido: %', p_movement_type;
  end if;

  if p_movement_type = 'salida'
    and v_item.category = 'medicamentos'
    and v_item.expiry_date is not null
    and v_item.expiry_date < current_date
    and coalesce(p_lot_number, '') = ''
  then
    raise exception 'No se puede dar salida normal a un medicamento caducado. Usa un canje o baja.';
  end if;

  -- Salidas sin ubicación/lote: descontar de un bin que sí tenga existencia,
  -- no de la ubicación genérica de categoría (ACCESORIOS, INSUMOS, etc.).
  if v_qty_out > 0
     and p_warehouse_id is null
     and p_location_id is null
     and coalesce(p_lot_number, '') = ''
  then
    select b.warehouse_id, b.location_id, b.lot_id
      into v_warehouse_id, v_location_id, v_lot_id
    from public.inventory_balances b
    left join public.lots l on l.id = b.lot_id
    left join public.warehouses w on w.id = b.warehouse_id
    where b.product_id = v_item.id
      and b.qty_on_hand >= v_qty_out
      and (
        v_item.category <> 'medicamentos'
        or l.expiry_date is null
        or l.expiry_date >= current_date
      )
    order by
      case when coalesce(w.is_default, false) then 0 else 1 end,
      l.expiry_date nulls last,
      b.qty_on_hand desc
    limit 1;
    if found then
      v_bin_picked := true;
    end if;
  end if;

  if coalesce(p_lot_number, '') <> '' or p_expiry_date is not null then
    insert into public.lots (product_id, lot_number, expiry_date)
    values (
      v_item.id,
      coalesce(nullif(trim(p_lot_number), ''), 'LOTE-' || to_char(now(), 'YYYYMMDD')),
      p_expiry_date
    )
    on conflict (product_id, lot_number)
    do update set expiry_date = coalesce(excluded.expiry_date, public.lots.expiry_date)
    returning id into v_lot_id;
  elsif v_qty_out > 0
    and v_item.tracks_lot
    and not v_bin_picked
    and p_warehouse_id is null
    and p_location_id is null then
    select l.id into v_lot_id
    from public.lots l
    join public.inventory_balances b on b.lot_id = l.id
    where l.product_id = v_item.id
      and b.qty_on_hand > 0
      and (l.expiry_date is null or l.expiry_date >= current_date)
    order by l.expiry_date nulls last, l.created_at
    limit 1;
  end if;

  if p_movement_type = 'salida'
    and v_item.category = 'medicamentos'
    and v_lot_id is not null
  then
    if exists (
      select 1 from public.lots
      where id = v_lot_id and expiry_date is not null and expiry_date < current_date
    ) then
      raise exception 'No se puede dar salida normal a un lote caducado.';
    end if;
  end if;

  if coalesce(p_serial_number, '') <> '' then
    insert into public.serial_numbers (product_id, serial_number, warehouse_id, location_id, status)
    values (
      v_item.id,
      trim(p_serial_number),
      v_warehouse_id,
      v_location_id,
      case when v_qty_out > 0 then 'en_servicio' else 'disponible' end
    )
    on conflict (serial_number) do update
      set warehouse_id = excluded.warehouse_id,
          location_id = excluded.location_id
    returning id into v_serial_id;
  end if;

  insert into public.inventory_balances (
    product_id, warehouse_id, location_id, lot_id, qty_on_hand
  )
  values (v_item.id, v_warehouse_id, v_location_id, v_lot_id, 0)
  on conflict (product_id, warehouse_id, location_id, lot_id)
  do nothing;

  select qty_on_hand into v_balance
  from public.inventory_balances
  where product_id = v_item.id
    and warehouse_id = v_warehouse_id
    and location_id = v_location_id
    and lot_id is not distinct from v_lot_id
  for update;

  if v_qty_out > v_balance then
    raise exception 'No hay existencia disponible (%). Solicitado: %', v_balance, v_qty_out;
  end if;

  update public.inventory_balances
  set qty_on_hand = qty_on_hand + v_qty_in - v_qty_out
  where product_id = v_item.id
    and warehouse_id = v_warehouse_id
    and location_id = v_location_id
    and lot_id is not distinct from v_lot_id;

  v_new_qty := public.sync_item_quantity(v_item.id);

  if p_expiry_date is not null then
    perform set_config('mas.allow_qty', '1', true);
    update public.inventory_items
    set expiry_date = p_expiry_date,
        supplier = case when coalesce(p_supplier_name, '') <> '' then p_supplier_name else supplier end
    where id = v_item.id;
  elsif coalesce(p_supplier_name, '') <> '' then
    update public.inventory_items
    set supplier = p_supplier_name
    where id = v_item.id;
  end if;

  select name into v_to_loc from public.locations where id = v_location_id;
  v_from_loc := coalesce(v_item.location, '');

  v_folio := public.next_document_folio(v_prefix);
  v_compat_type := case
    when p_movement_type in ('entrada', 'devolucion') then 'entrada'
    when p_movement_type = 'canje_caducado' then 'canje_caducado'
    when p_movement_type like 'ajuste%' then 'entrada'
    else 'salida'
  end;
  if p_movement_type = 'ajuste_faltante' then
    v_compat_type := 'salida';
  end if;

  insert into public.inventory_movements (
    folio, movement_type, document_type, product_id, product_sku, product_name,
    warehouse_id, location_id, lot_id, serial_id, qty_in, qty_out, resulting_qty,
    unit_cost, reason, note, created_by, purchase_order_id
  ) values (
    v_folio,
    case
      when p_movement_type in ('ajuste_sobrante', 'ajuste_faltante') then 'ajuste'
      else p_movement_type
    end,
    v_prefix,
    v_item.id, v_item.sku, v_item.name,
    v_warehouse_id, v_location_id, v_lot_id, v_serial_id,
    v_qty_in, v_qty_out, v_new_qty,
    v_item.unit_price, coalesce(p_reason, ''), coalesce(p_note, ''),
    p_created_by, p_purchase_order_id
  )
  returning id into v_movement_id;

  insert into public.warehouse_movements (
    item_id, item_sku, item_name, movement_type, quantity,
    previous_quantity, new_quantity, note, created_by,
    from_location, to_location, supplier_name, previous_expiry, new_expiry
  ) values (
    v_item.id, v_item.sku, v_item.name, v_compat_type, p_quantity,
    v_new_qty - v_qty_in + v_qty_out, v_new_qty, coalesce(p_note, ''),
    p_created_by, v_from_loc, coalesce(v_to_loc, ''), p_supplier_name,
    v_item.expiry_date, coalesce(p_expiry_date, v_item.expiry_date)
  );

  insert into public.audit_logs (
    username, action, module, document_folio, record_id, previous_value, new_value
  ) values (
    p_created_by, p_movement_type, 'almacen', v_folio, v_item.id::text,
    (v_new_qty - v_qty_in + v_qty_out)::text, v_new_qty::text
  );

  folio := v_folio;
  movement_id := v_movement_id;
  new_quantity := v_new_qty;
  return next;
end;
$function$;

grant execute on function public.apply_stock_movement(uuid, text, integer, text, text, text, uuid, uuid, text, date, text, text, uuid) to anon, authenticated;
notify pgrst, 'reload schema';

