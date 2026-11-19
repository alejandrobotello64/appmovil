-- Entradas: rellenar related_serial desde serial_id (el PDF del vale lo usa).
-- Consolidar lámparas Polaris duplicadas (insumo → equipo canónico).

CREATE OR REPLACE FUNCTION public.tg_fill_movement_related_serial()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(NEW.related_serial, '') = '' AND NEW.serial_id IS NOT NULL THEN
    SELECT sn.serial_number
      INTO NEW.related_serial
    FROM public.serial_numbers sn
    WHERE sn.id = NEW.serial_id;
  END IF;
  NEW.related_serial := coalesce(NEW.related_serial, '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_movement_related_serial ON public.inventory_movements;
CREATE TRIGGER trg_fill_movement_related_serial
  BEFORE INSERT OR UPDATE OF serial_id, related_serial
  ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_fill_movement_related_serial();

UPDATE public.inventory_movements m
SET related_serial = sn.serial_number
FROM public.serial_numbers sn
WHERE m.serial_id = sn.id
  AND coalesce(nullif(trim(m.related_serial), ''), '') = '';

-- Polaris: INSUMOS-000126 → EQUIPO-000026
DO $$
DECLARE
  v_insumo uuid := '4910005c-da7d-4106-bd74-2c2043fe4b2e';
  v_equipo uuid := '9ccc01d3-9a7f-4dde-bcf6-32b522c628ea';
  r record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.inventory_items WHERE id = v_insumo) THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.inventory_items WHERE id = v_equipo) THEN
    RAISE EXCEPTION 'EQUIPO-000026 (Polaris) no existe';
  END IF;

  UPDATE public.serial_numbers
  SET product_id = v_equipo
  WHERE product_id = v_insumo;

  FOR r IN
    SELECT warehouse_id, location_id, sum(qty_on_hand)::integer AS qty
    FROM public.inventory_balances
    WHERE product_id = v_insumo
      AND qty_on_hand > 0
    GROUP BY warehouse_id, location_id
  LOOP
    INSERT INTO public.inventory_balances (
      product_id, warehouse_id, location_id, lot_id, qty_on_hand
    )
    VALUES (v_equipo, r.warehouse_id, r.location_id, NULL, 0)
    ON CONFLICT (product_id, warehouse_id, location_id, lot_id)
    DO NOTHING;

    UPDATE public.inventory_balances
    SET qty_on_hand = qty_on_hand + r.qty
    WHERE product_id = v_equipo
      AND warehouse_id = r.warehouse_id
      AND location_id IS NOT DISTINCT FROM r.location_id
      AND lot_id IS NULL;
  END LOOP;

  UPDATE public.inventory_balances
  SET qty_on_hand = 0
  WHERE product_id = v_insumo;

  UPDATE public.inventory_movements
  SET
    product_id = v_equipo,
    product_sku = 'EQUIPO-000026',
    product_name = 'Lámpara de quirófano dual Polaris 100/200',
    lot_id = NULL
  WHERE product_id = v_insumo;

  UPDATE public.inventory_items
  SET
    is_active = false,
    tracks_lot = false,
    tracks_serial = true
  WHERE id = v_insumo;

  UPDATE public.inventory_items
  SET
    item_kind = 'equipo',
    category = 'equipos',
    tracks_lot = false,
    tracks_serial = true,
    name = 'Lámpara de quirófano dual Polaris 100/200'
  WHERE id = v_equipo;

  PERFORM set_config('mas.allow_qty', '1', true);
  PERFORM public.sync_item_quantity(v_equipo);
  PERFORM public.sync_item_quantity(v_insumo);
END;
$$;
