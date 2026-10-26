-- Apertura de caja: descuenta cajas y da entrada a la presentación en piezas.

alter table public.inventory_items
  add column if not exists pieces_per_unit integer,
  add column if not exists piece_product_id uuid references public.inventory_items (id);

comment on column public.inventory_items.pieces_per_unit is
  'Piezas que salen de una unidad cuando el artículo está en caja.';
comment on column public.inventory_items.piece_product_id is
  'Artículo en piezas que recibe la existencia al abrir la caja.';

create or replace function public.open_box_to_pieces(
  p_box_product_id uuid,
  p_piece_product_id uuid,
  p_boxes integer,
  p_pieces_per_box integer,
  p_warehouse_id uuid,
  p_location_id uuid,
  p_lot_number text default null,
  p_expiry_date date default null,
  p_created_by text default '',
  p_note text default ''
)
returns table (
  box_folio text,
  piece_folio text,
  pieces_added integer,
  boxes_left integer,
  piece_quantity integer
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_box public.inventory_items%rowtype;
  v_piece public.inventory_items%rowtype;
  v_pieces integer;
  v_note text;
  v_box_move record;
  v_piece_move record;
begin
  if coalesce(p_created_by, '') = '' then
    raise exception 'La apertura requiere un usuario responsable';
  end if;
  if p_boxes is null or p_boxes <= 0 then
    raise exception 'Indica cuántas cajas vas a abrir';
  end if;
  if p_pieces_per_box is null or p_pieces_per_box <= 0 then
    raise exception 'Indica cuántas piezas trae cada caja';
  end if;
  if p_boxes > 100000 or p_pieces_per_box > 100000 then
    raise exception 'La cantidad es demasiado grande';
  end if;
  if p_box_product_id is null or p_piece_product_id is null then
    raise exception 'Elige el artículo en caja y su presentación en piezas';
  end if;
  if p_box_product_id = p_piece_product_id then
    raise exception 'La presentación en piezas debe ser otro código';
  end if;
  if p_warehouse_id is null or p_location_id is null then
    raise exception 'Elige la existencia de la caja que vas a abrir';
  end if;

  select * into v_box from public.inventory_items where id = p_box_product_id;
  if not found then
    raise exception 'No se encontró el artículo en caja';
  end if;
  if v_box.is_active is false then
    raise exception 'El artículo en caja está inactivo';
  end if;
  if v_box.unit is distinct from 'caja' then
    raise exception 'El artículo de origen debe estar en unidad caja';
  end if;

  select * into v_piece from public.inventory_items where id = p_piece_product_id;
  if not found then
    raise exception 'No se encontró la presentación en piezas';
  end if;
  if v_piece.is_active is false then
    raise exception 'La presentación en piezas está inactiva';
  end if;
  if v_piece.unit is distinct from 'pieza' then
    raise exception 'El destino debe ser un artículo en piezas';
  end if;

  v_pieces := p_boxes * p_pieces_per_box;
  v_note := concat_ws(
    ' ',
    format(
      'Apertura de %s caja(s) × %s = %s piezas. %s → %s.',
      p_boxes,
      p_pieces_per_box,
      v_pieces,
      v_box.sku,
      v_piece.sku
    ),
    nullif(btrim(coalesce(p_note, '')), '')
  );

  select *
    into v_box_move
  from public.apply_stock_movement(
    p_box_product_id,
    'salida',
    p_boxes,
    v_note,
    p_created_by,
    'apertura_caja',
    p_warehouse_id,
    p_location_id,
    nullif(btrim(coalesce(p_lot_number, '')), ''),
    p_expiry_date,
    null,
    '',
    null
  );

  select *
    into v_piece_move
  from public.apply_stock_movement(
    p_piece_product_id,
    'entrada',
    v_pieces,
    v_note,
    p_created_by,
    'apertura_caja',
    p_warehouse_id,
    p_location_id,
    nullif(btrim(coalesce(p_lot_number, '')), ''),
    p_expiry_date,
    null,
    '',
    null
  );

  update public.inventory_items
  set
    pieces_per_unit = p_pieces_per_box,
    piece_product_id = p_piece_product_id
  where id = p_box_product_id;

  box_folio := v_box_move.folio;
  piece_folio := v_piece_move.folio;
  pieces_added := v_pieces;
  boxes_left := v_box_move.new_quantity;
  piece_quantity := v_piece_move.new_quantity;
  return next;
end;
$$;

revoke all on function public.open_box_to_pieces(
  uuid, uuid, integer, integer, uuid, uuid, text, date, text, text
) from public;
grant execute on function public.open_box_to_pieces(
  uuid, uuid, integer, integer, uuid, uuid, text, date, text, text
) to anon, authenticated;

notify pgrst, 'reload schema';
