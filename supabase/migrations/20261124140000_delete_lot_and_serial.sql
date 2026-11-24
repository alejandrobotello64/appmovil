-- Eliminar lote o serie desde la ficha de producto.
-- Si hay existencia, primero registra ajuste_faltante y luego borra la unidad.

CREATE OR REPLACE FUNCTION public.delete_inventory_lot(
  p_lot_id uuid,
  p_created_by text DEFAULT ''::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lot public.lots%ROWTYPE;
  v_bal RECORD;
BEGIN
  IF coalesce(trim(p_created_by), '') = '' THEN
    RAISE EXCEPTION 'Se requiere un usuario responsable';
  END IF;

  SELECT * INTO v_lot FROM public.lots WHERE id = p_lot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote no encontrado';
  END IF;

  FOR v_bal IN
    SELECT warehouse_id, location_id, qty_on_hand
    FROM public.inventory_balances
    WHERE lot_id = p_lot_id
      AND qty_on_hand > 0
  LOOP
    PERFORM public.apply_stock_movement(
      v_lot.product_id,
      'ajuste_faltante',
      v_bal.qty_on_hand::integer,
      'Eliminación de lote ' || v_lot.lot_number || ' desde ficha',
      p_created_by,
      'eliminacion_lote',
      v_bal.warehouse_id,
      v_bal.location_id,
      v_lot.lot_number,
      v_lot.expiry_date,
      NULL,
      '',
      NULL,
      NULL
    );
  END LOOP;

  DELETE FROM public.inventory_balances WHERE lot_id = p_lot_id;
  DELETE FROM public.lots WHERE id = p_lot_id;
  PERFORM public.sync_item_quantity(v_lot.product_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_inventory_serial(
  p_serial_id uuid,
  p_created_by text DEFAULT ''::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_serial public.serial_numbers%ROWTYPE;
  v_qty integer := 0;
BEGIN
  IF coalesce(trim(p_created_by), '') = '' THEN
    RAISE EXCEPTION 'Se requiere un usuario responsable';
  END IF;

  SELECT * INTO v_serial FROM public.serial_numbers WHERE id = p_serial_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serie no encontrada';
  END IF;

  IF v_serial.status IN ('reservado', 'en_transito', 'instalado') THEN
    RAISE EXCEPTION
      'No se puede eliminar una serie en estado "%". Ciérrala con un movimiento primero.',
      v_serial.status;
  END IF;

  IF v_serial.status = 'disponible'
    AND v_serial.warehouse_id IS NOT NULL
    AND v_serial.location_id IS NOT NULL
  THEN
    SELECT coalesce(sum(qty_on_hand), 0)::integer INTO v_qty
    FROM public.inventory_balances
    WHERE product_id = v_serial.product_id
      AND warehouse_id = v_serial.warehouse_id
      AND location_id = v_serial.location_id
      AND lot_id IS NULL;

    IF v_qty > 0 THEN
      PERFORM public.apply_stock_movement(
        v_serial.product_id,
        'ajuste_faltante',
        1,
        'Eliminación de serie ' || v_serial.serial_number || ' desde ficha',
        p_created_by,
        'eliminacion_serie',
        v_serial.warehouse_id,
        v_serial.location_id,
        NULL,
        NULL,
        v_serial.serial_number,
        '',
        NULL,
        NULL
      );
    END IF;
  END IF;

  DELETE FROM public.serial_numbers WHERE id = p_serial_id;
  PERFORM public.sync_item_quantity(v_serial.product_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_inventory_lot(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_inventory_lot(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.delete_inventory_serial(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_inventory_serial(uuid, text) TO anon;

NOTIFY pgrst, 'reload schema';
