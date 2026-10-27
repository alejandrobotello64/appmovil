#!/usr/bin/env python3
"""Crea la presentación en piezas de cada producto en caja o paquete.

Es idempotente: si ya existe una pieza con el mismo número de parte y un
nombre que ya dice "pieza", la reutiliza y solo enlaza piece_product_id.
La existencia de la caja no se mueve. La pieza nueva nace en cero y sin
alerta de agotado, para no marcar cientos de códigos vacíos.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import uuid

PREFIX = {
    "insumos": "INSUMOS",
    "medicamentos": "MEDICAMENTOS",
    "refacciones": "REFACCIONES",
    "accesorios": "ACCESORIOS",
    "reactivos": "REACTIVOS",
    "equipos": "EQUIPO",
    "otros": "OTROS",
}


def psql(sql: str) -> str:
    result = subprocess.run(
        ["sudo", "-u", "postgres", "psql", "-d", "mas", "-v", "ON_ERROR_STOP=1", "-At"],
        input=sql,
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        sys.stderr.write(result.stderr)
        raise SystemExit(result.returncode)
    return result.stdout


def loose_name(name: str) -> str:
    text = _strip_accents(name.lower())
    text = re.sub(r"\d+\s*bolsas?\s*/\s*caja", " ", text)
    text = re.sub(r"\d+\s*pz(?:as?)?\s*/\s*caja", " ", text)
    text = re.sub(r"\d+\s*/\s*caja", " ", text)
    text = re.sub(r"\d+\s*pz(?:as?)?\s*/\s*bolsa", " ", text)
    text = re.sub(r"\d+\s*(?:uds?\.?|unidades|pzas?)\b", " ", text)
    text = re.sub(r"\bpiezas?\b", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return text.strip()


def _strip_accents(text: str) -> str:
    import unicodedata

    return "".join(
        ch for ch in unicodedata.normalize("NFD", text) if unicodedata.category(ch) != "Mn"
    )


def pieces_per_unit(name: str) -> int | None:
    match = (
        re.search(r"(\d+)\s*bolsas?\s*/\s*caja", name, re.I)
        or re.search(r"(\d+)\s*pz(?:as?)?\s*/\s*caja", name, re.I)
        or re.search(r"(\d+)\s*/\s*caja", name, re.I)
        or re.search(r"(\d+)\s*pz(?:as?)?\s*/\s*bolsa", name, re.I)
        or re.search(r"(\d+)\s*/\s*case", name, re.I)
        or re.search(r"(\d+)\s*(?:uds?\.?|unidades|piezas|pzas?)\b", name, re.I)
    )
    if not match:
        return None
    value = int(match.group(1))
    if value <= 0 or value > 100000:
        return None
    return value


def piece_name(name: str) -> str:
    trimmed = re.sub(r"\s+", " ", name.strip())
    replaced = trimmed
    replaced = re.sub(r"\s*\d+\s*bolsas?\s*/\s*caja\b", " pieza", replaced, flags=re.I)
    replaced = re.sub(r"\s*\d+\s*pz(?:as?)?\s*/\s*caja\b", " pieza", replaced, flags=re.I)
    replaced = re.sub(r"\s*\d+\s*/\s*caja\b", " pieza", replaced, flags=re.I)
    replaced = re.sub(r"\s*\d+\s*pz(?:as?)?\s*/\s*bolsa\b", " pieza", replaced, flags=re.I)
    replaced = re.sub(r"\s+", " ", replaced).strip()
    if replaced != trimmed:
        return replaced
    if re.search(r"\bpiezas?\s*$", trimmed, re.I):
        return trimmed
    return f"{trimmed} pieza"


def looks_like_piece(name: str) -> bool:
    return re.search(r"\bpiezas?\b", name, re.I) is not None


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def sql_num(value: float | int | None) -> str:
    if value is None:
        return "null"
    return str(value)


def main() -> None:
    dry = "--apply" not in sys.argv
    raw = psql(
        """
        select coalesce(json_agg(row_to_json(t)), '[]'::json)
        from (
          select id, sku, name, category, description, unit, location, brand, model,
                 unit_price, cost_price, supplier, notes, is_active, tracks_lot,
                 tracks_expiry, part_number, manufacturer, subcategory, image_path,
                 image_url, gallery_images, color_tag, pieces_per_unit, piece_product_id
          from inventory_items
          where unit in ('caja', 'paquete', 'pieza')
        ) t;
        """
    )
    rows = json.loads(raw)
    pieces = [row for row in rows if row["unit"] == "pieza"]
    sources = [row for row in rows if row["unit"] in ("caja", "paquete")]

    def find_existing(source: dict, desired: str) -> dict | None:
        part = (source["part_number"] or "").strip().lower()
        wanted = loose_name(desired)
        matches = []
        for piece in pieces:
            same_part = part and (piece["part_number"] or "").strip().lower() == part
            same_name = piece["name"].strip().lower() == desired.lower()
            if part:
                if not same_part or not looks_like_piece(piece["name"]):
                    continue
                if not same_name and loose_name(piece["name"]) not in (wanted, loose_name(source["name"])):
                    continue
            elif not (same_name and piece.get("category") == source["category"]):
                continue
            matches.append(piece)
        if not matches:
            return None
        matches.sort(
            key=lambda piece: (
                0 if piece["id"] == source.get("piece_product_id") else 1,
                0 if (piece["part_number"] or "").strip().lower() == part else 1,
                0 if piece["name"].strip().lower() == desired.lower() else 1,
                len(piece["name"]),
                piece["sku"],
            )
        )
        return matches[0]

    groups: dict[tuple, dict] = {}
    order: list[tuple] = []
    for source in sources:
        desired = piece_name(source["name"])
        part = (source["part_number"] or "").strip().lower()
        key = (source["category"], part, desired.lower()) if part else ("solo", source["id"])
        existing = find_existing(source, desired)
        if key not in groups:
            groups[key] = {
                "desired": desired,
                "existing": existing,
                "sources": [source],
                "category": source["category"],
            }
            order.append(key)
        else:
            groups[key]["sources"].append(source)
            if groups[key]["existing"] is None and existing is not None:
                groups[key]["existing"] = existing

    max_seq = {prefix: 0 for prefix in PREFIX.values()}
    sku_raw = psql(
        "select sku from inventory_items where sku ~ '^(INSUMOS|MEDICAMENTOS|REFACCIONES|ACCESORIOS|REACTIVOS|EQUIPO|OTROS)-[0-9]+$';"
    )
    for sku in sku_raw.splitlines():
        prefix, _, seq = sku.partition("-")
        if prefix in max_seq:
            max_seq[prefix] = max(max_seq[prefix], int(seq))

    created = 0
    reused = 0
    statements: list[str] = []
    samples: list[str] = []
    for key in order:
        group = groups[key]
        sources_of = group["sources"]
        desired = group["desired"]
        piece = group["existing"]
        if piece is None:
            # Another group in this same run may already have created it.
            piece = find_existing(sources_of[0], desired)
        if piece is None:
            template = sources_of[0]
            per = next(
                (pieces_per_unit(item["name"]) for item in sources_of if pieces_per_unit(item["name"])),
                None,
            )
            price = float(template["unit_price"] or 0)
            cost = float(template["cost_price"] or 0)
            if per and per > 1:
                unit_price = round(price / per, 2)
                cost_price = round(cost / per, 4)
            else:
                unit_price = 0
                cost_price = 0
            prefix = PREFIX.get(template["category"], "OTROS")
            max_seq[prefix] = max_seq.get(prefix, 0) + 1
            sku = f"{prefix}-{max_seq[prefix]:06d}"
            piece_id = str(uuid.uuid4())
            origin = ", ".join(item["sku"] for item in sources_of)
            note = f"Presentación en piezas de {origin}."
            parent_notes = (template["notes"] or "").strip()
            if parent_notes:
                note = f"{note}\n{parent_notes}"
            gallery = template["gallery_images"]
            if not isinstance(gallery, str):
                gallery = json.dumps(gallery or [])
            statements.append(
                "insert into inventory_items ("
                "id, sku, name, category, item_kind, description, quantity, min_stock, unit, "
                "location, brand, color_tag, model, serial_number, unit_price, cost_price, "
                "stock_alerts_enabled, supplier, notes, asset_status, is_active, tracks_lot, "
                "tracks_serial, tracks_expiry, max_stock, reorder_point, part_number, "
                "manufacturer, subcategory, image_path, image_url, gallery_images"
                ") values ("
                f"{sql_quote(piece_id)}, {sql_quote(sku)}, {sql_quote(desired)}, "
                f"{sql_quote(template['category'])}, 'producto', {sql_quote(template['description'] or '')}, "
                "0, 0, 'pieza', "
                f"{sql_quote(template['location'] or '')}, {sql_quote(template['brand'] or '')}, "
                f"{sql_quote(template['color_tag'] or '')}, {sql_quote(template['model'] or '')}, '', "
                f"{unit_price}, {cost_price}, false, {sql_quote(template['supplier'] or '')}, "
                f"{sql_quote(note)}, 'operativo', {str(bool(template['is_active'])).lower()}, "
                f"{str(bool(template['tracks_lot'])).lower()}, false, "
                f"{str(bool(template['tracks_expiry'])).lower()}, 0, 0, "
                f"{sql_quote(template['part_number'] or '')}, {sql_quote(template['manufacturer'] or '')}, "
                f"{sql_quote(template['subcategory'] or '')}, {sql_quote(template['image_path'] or '')}, "
                f"{sql_quote(template['image_url'] or '')}, {sql_quote(gallery)}::jsonb);"
            )
            piece = {
                "id": piece_id,
                "sku": sku,
                "name": desired,
                "unit": "pieza",
                "part_number": template["part_number"],
            }
            pieces.append(piece)
            created += 1
            if len(samples) < 8:
                samples.append(f"NUEVO {sku}  {sources_of[0]['unit']} {sources_of[0]['sku']}  →  {desired}")
        else:
            reused += 1

        for source in sources_of:
            per = pieces_per_unit(source["name"])
            sets = [f"piece_product_id = {sql_quote(piece['id'])}::uuid"]
            if per and not source.get("pieces_per_unit"):
                sets.append(f"pieces_per_unit = {per}")
            statements.append(
                f"update inventory_items set {', '.join(sets)} where id = {sql_quote(source['id'])}::uuid;"
            )

    print(f"cajas/paquetes: {len(sources)}")
    print(f"piezas nuevas: {created}")
    print(f"piezas reutilizadas: {reused}")
    print(f"grupos: {len(order)}")
    for line in samples:
        print(line)

    if dry:
        print("Dry-run. Pasa --apply para guardar.")
        return

    sql = "begin;\n" + "\n".join(statements) + "\ncommit;\n"
    psql(sql)
    print("Guardado.")


if __name__ == "__main__":
    main()
