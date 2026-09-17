#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/supabase/seed_catalog.sql"
python3 - "$OUT" <<'PY'
import json, subprocess, sys

out_path = sys.argv[1]
raw = subprocess.check_output(
    [
        "sudo",
        "-u",
        "postgres",
        "psql",
        "-d",
        "mas",
        "-tAc",
        "select coalesce(json_agg(t order by sku), '[]'::json) from public.inventory_items t",
    ],
    text=True,
)
rows = json.loads(raw)

columns = [
    "sku",
    "name",
    "category",
    "item_kind",
    "description",
    "quantity",
    "min_stock",
    "unit",
    "location",
    "brand",
    "model",
    "serial_number",
    "unit_price",
    "supplier",
    "expiry_date",
    "manufactured_at",
    "notes",
    "asset_status",
    "last_maintenance_date",
    "next_maintenance_date",
    "is_active",
    "tracks_lot",
    "tracks_serial",
    "tracks_expiry",
    "max_stock",
    "reorder_point",
    "part_number",
    "manufacturer",
    "subcategory",
]


def lit(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


update_set = ",\n  ".join(
    f"{column} = excluded.{column}"
    for column in columns
    if column != "sku"
)

chunks = []
batch_size = 80
for start in range(0, len(rows), batch_size):
    batch = rows[start : start + batch_size]
    values = []
    for row in batch:
        values.append(
            "(" + ", ".join(lit(row.get(column)) for column in columns) + ")"
        )
    chunks.append(
        "insert into public.inventory_items (\n  "
        + ",\n  ".join(columns)
        + "\n) values\n  "
        + ",\n  ".join(values)
        + "\non conflict (sku) do update set\n  "
        + update_set
        + ";\n"
    )

header = f"""-- Catálogo real de MAS. Generado desde la base local ({len(rows)} productos).
-- Idempotente: inserta o actualiza por sku. No borra filas extra.
-- Regenerar: bash scripts/export-catalog.sh

begin;
alter table public.inventory_items disable trigger inventory_items_protect_quantity;

"""

footer = """
alter table public.inventory_items enable trigger inventory_items_protect_quantity;
commit;
"""

with open(out_path, "w", encoding="utf-8") as handle:
    handle.write(header)
    handle.write("\n".join(chunks))
    handle.write(footer)

print(f"Wrote {len(rows)} products to {out_path}")
PY
