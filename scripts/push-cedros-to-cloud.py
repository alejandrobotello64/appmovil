#!/usr/bin/env python3
"""Push new Cedros catalog rows to the live Supabase project.

Skips any n.º de parte that already exists. Does not change existing rows.
New items keep local UUIDs so /catalog/photos/{id}.* keep working after deploy.

Schema (color_tag, supply_kits) cannot be created with the anon key; this
script writes scripts/apply-cloud-cedros.sql for the SQL Editor and still
inserts the catalog rows that the current cloud schema accepts.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL_OUT = ROOT / "scripts" / "apply-cloud-cedros.sql"
ENV_FILE = ROOT / ".env.local"


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    if ENV_FILE.exists():
        for raw in ENV_FILE.read_text().splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key] = value
    env.update({k: v for k, v in os.environ.items() if v})
    return env


def part_key(value: str | None) -> str:
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())


def sql_str(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    text = str(value).replace("'", "''")
    return f"'{text}'"


def local_rojo_rows() -> list[dict]:
    raw = subprocess.check_output(
        [
            "sudo",
            "-u",
            "postgres",
            "psql",
            "-d",
            "mas",
            "-tAc",
            """
            copy (
              select json_agg(row_to_json(t) order by t.sku)
              from (
                select id, sku, name, category, item_kind, description, quantity,
                       min_stock, unit, location, brand, model, serial_number,
                       unit_price::float as unit_price, supplier, expiry_date, notes,
                       asset_status, last_maintenance_date, next_maintenance_date,
                       is_active, tracks_lot, tracks_serial, tracks_expiry,
                       max_stock, reorder_point, part_number, manufacturer,
                       subcategory, manufactured_at, image_path, image_url,
                       gallery_images, color_tag
                from inventory_items
                where color_tag = 'rojo'
              ) t
            ) to stdout
            """,
        ]
    )
    return json.loads(raw.decode().strip() or "[]")


def rest(url: str, anon: str, path: str, *, method: str = "GET", body: object | None = None, extra: dict | None = None):
    data = None if body is None else json.dumps(body).encode()
    headers = {
        "apikey": anon,
        "Authorization": f"Bearer {anon}",
        "Accept": "application/json",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    if extra:
        headers.update(extra)
    req = urllib.request.Request(url + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            payload = response.read()
            parsed = json.loads(payload) if payload else None
            return response.status, dict(response.headers), parsed
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(detail)
        except json.JSONDecodeError:
            parsed = {"raw": detail}
        return error.code, dict(error.headers), parsed


def fetch_cloud_items(url: str, anon: str) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        status, headers, chunk = rest(
            url,
            anon,
            f"/rest/v1/inventory_items?select=id,sku,part_number,name,is_active&order=sku&limit=1000&offset={offset}",
            extra={"Prefer": "count=exact"},
        )
        if status >= 400:
            raise SystemExit(f"No pude leer inventario en la nube ({status}): {chunk}")
        rows.extend(chunk or [])
        if not chunk or len(chunk) < 1000:
            break
        offset += 1000
    return rows


def rest_payload(row: dict, include_color: bool) -> dict:
    payload = dict(row)
    if not include_color:
        payload.pop("color_tag", None)
    for key in ("expiry_date", "last_maintenance_date", "next_maintenance_date", "manufactured_at"):
        if payload.get(key) is None:
            payload.pop(key, None)
    return payload


def write_sql(rows: list[dict]) -> None:
    color_ddl = (ROOT / "supabase/migrations/20261011083000_inventory_color_tag.sql").read_text()
    kits_ddl = (ROOT / "supabase/migrations/20261011080000_supply_kits.sql").read_text()
    values = []
    ids = []
    photo_updates = []
    for row in rows:
        ids.append(row["id"])
        values.append(
            "("
            + ", ".join(
                [
                    sql_str(row["id"]) + "::uuid",
                    sql_str(row["sku"]),
                    sql_str(row["name"]),
                    sql_str(row["category"]),
                    sql_str(row["item_kind"]),
                    sql_str(row["description"]),
                    str(int(row["quantity"] or 0)),
                    str(int(row["min_stock"] or 0)),
                    sql_str(row["unit"]),
                    sql_str(row["location"]),
                    sql_str(row["brand"]),
                    sql_str(row["model"]),
                    sql_str(row["serial_number"]),
                    str(row["unit_price"] or 0),
                    sql_str(row["supplier"]),
                    sql_str(row["notes"]),
                    sql_str(row["asset_status"]),
                    "true" if row["is_active"] else "false",
                    "true" if row["tracks_lot"] else "false",
                    "true" if row["tracks_serial"] else "false",
                    "true" if row["tracks_expiry"] else "false",
                    str(int(row["max_stock"] or 0)),
                    str(int(row["reorder_point"] or 0)),
                    sql_str(row["part_number"]),
                    sql_str(row["manufacturer"]),
                    sql_str(row["subcategory"]),
                    sql_str(row["image_path"]),
                    sql_str(row["image_url"]),
                    sql_str(json.dumps(row.get("gallery_images") or [])),
                    sql_str("rojo"),
                ]
            )
            + ")"
        )
        if (row.get("image_url") or "").startswith("/catalog/photos/"):
            photo_updates.append(
                "update public.inventory_items set "
                f"image_path = {sql_str(row['image_path'])}, "
                f"image_url = {sql_str(row['image_url'])} "
                f"where id = {sql_str(row['id'])}::uuid;"
            )

    id_list = ",\n  ".join(sql_str(i) + "::uuid" for i in ids)
    sql = f"""-- Cedros → proyecto iqfareiwiadqsauejaaf
-- Pegar en: https://supabase.com/dashboard/project/iqfareiwiadqsauejaaf/sql/new
-- Aditivo: no borra existencias ni modifica n.º de parte que ya estén en el catálogo.
-- Los 478 códigos nuevos conservan el UUID local (fotos en /catalog/photos/{{id}}).

begin;

{color_ddl}

{kits_ddl}

insert into public.inventory_items (
  id, sku, name, category, item_kind, description, quantity, min_stock, unit,
  location, brand, model, serial_number, unit_price, supplier, notes, asset_status,
  is_active, tracks_lot, tracks_serial, tracks_expiry, max_stock, reorder_point,
  part_number, manufacturer, subcategory, image_path, image_url, gallery_images, color_tag
)
select
  v.id, v.sku, v.name, v.category, v.item_kind, v.description, v.quantity, v.min_stock,
  v.unit, v.location, v.brand, v.model, v.serial_number, v.unit_price, v.supplier,
  v.notes, v.asset_status, v.is_active, v.tracks_lot, v.tracks_serial, v.tracks_expiry,
  v.max_stock, v.reorder_point, v.part_number, v.manufacturer, v.subcategory,
  v.image_path, v.image_url, v.gallery_images::jsonb, v.color_tag
from (
  values
    {",\n    ".join(values)}
) as v(
  id, sku, name, category, item_kind, description, quantity, min_stock, unit,
  location, brand, model, serial_number, unit_price, supplier, notes, asset_status,
  is_active, tracks_lot, tracks_serial, tracks_expiry, max_stock, reorder_point,
  part_number, manufacturer, subcategory, image_path, image_url, gallery_images, color_tag
)
where not exists (
  select 1 from public.inventory_items e
  where e.id = v.id
     or e.sku = v.sku
     or (
       regexp_replace(upper(trim(e.part_number)), '[^A-Z0-9]', '', 'g')
       = regexp_replace(upper(trim(v.part_number)), '[^A-Z0-9]', '', 'g')
       and regexp_replace(upper(trim(v.part_number)), '[^A-Z0-9]', '', 'g') <> ''
     )
);

update public.inventory_items
set color_tag = 'rojo'
where id in (
  {id_list}
);

{chr(10).join(photo_updates)}

commit;

notify pgrst, 'reload schema';
"""
    SQL_OUT.write_text(sql)
    print(f"SQL Editor: {SQL_OUT} ({SQL_OUT.stat().st_size} bytes)")


def main() -> int:
    env = load_env()
    url = (env.get("CLOUD_SUPABASE_URL") or "").rstrip("/")
    anon = env.get("CLOUD_SUPABASE_ANON_KEY") or ""
    if not url or not anon:
        raise SystemExit("Faltan CLOUD_SUPABASE_URL / CLOUD_SUPABASE_ANON_KEY en .env.local")

    local_rows = local_rojo_rows()
    print(f"local rojo: {len(local_rows)}")
    write_sql(local_rows)

    cloud = fetch_cloud_items(url, anon)
    cloud_parts = {part_key(row.get("part_number")) for row in cloud if part_key(row.get("part_number"))}
    cloud_skus = {row["sku"] for row in cloud}
    cloud_ids = {row["id"] for row in cloud}
    print(f"cloud items: {len(cloud)} parts={len(cloud_parts)}")

    pending = [
        row
        for row in local_rows
        if row["id"] not in cloud_ids
        and row["sku"] not in cloud_skus
        and part_key(row.get("part_number")) not in cloud_parts
    ]
    print(f"to insert: {len(pending)}")

    status, _, probe = rest(url, anon, "/rest/v1/inventory_items?select=color_tag&limit=1")
    has_color = status == 200
    print(f"color_tag column: {has_color} ({status} {probe if status != 200 else 'ok'})")

    inserted = 0
    errors: list[str] = []
    batch_size = 40
    for start in range(0, len(pending), batch_size):
        batch = [rest_payload(row, has_color) for row in pending[start : start + batch_size]]
        status, _, result = rest(
            url,
            anon,
            "/rest/v1/inventory_items",
            method="POST",
            body=batch,
            extra={"Prefer": "return=minimal,resolution=ignore-duplicates"},
        )
        if status in (200, 201, 204):
            inserted += len(batch)
            print(f"  posted {inserted}/{len(pending)}")
            continue
        # fall back to one-by-one so a single bad row does not block the rest
        for row in batch:
            status, _, result = rest(
                url,
                anon,
                "/rest/v1/inventory_items",
                method="POST",
                body=row,
                extra={"Prefer": "return=minimal"},
            )
            if status in (200, 201, 204):
                inserted += 1
            else:
                errors.append(f"{row.get('sku')} {status} {result}")
        print(f"  posted {inserted}/{len(pending)} (with {len(errors)} errors)")

    if has_color:
        for start in range(0, len(local_rows), batch_size):
            chunk = local_rows[start : start + batch_size]
            ids = ",".join(row["id"] for row in chunk)
            status, _, result = rest(
                url,
                anon,
                f"/rest/v1/inventory_items?id=in.({ids})",
                method="PATCH",
                body={"color_tag": "rojo"},
                extra={"Prefer": "return=minimal"},
            )
            if status not in (200, 204):
                errors.append(f"color patch {status} {result}")

    status, headers, _ = rest(
        url,
        anon,
        "/rest/v1/inventory_items?select=id&is_active=eq.true",
        extra={"Prefer": "count=exact","Range": "0-0"},
    )
    print("cloud content-range", headers.get("content-range") or headers.get("Content-Range"))
    print(f"inserted={inserted} skipped={len(local_rows) - len(pending)} errors={len(errors)}")
    for line in errors[:12]:
        print("ERR", line)
    if errors:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
