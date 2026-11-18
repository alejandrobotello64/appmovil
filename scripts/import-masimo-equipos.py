#!/usr/bin/env python3
"""Carga las series del inventario Masimo (18-02-2026) al almacén VSA.

Cada serie queda en el producto de equipo con ese número de parte. Si el
catálogo no tiene el modelo, se crea como equipo. No borra series que ya
estaban y no duplica una serie que ya pertenece al mismo producto.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env.local"
VSA = "015244fb-4bd5-49b1-bb74-ce63aafa6a74"
REASON = "Inventario Masimo 18-02-2026"
ACTOR = "sistema"
BINS = ("1B", "2B", "3B", "4B")

# Número de parte del Excel → producto que ya está en el catálogo.
EXISTING_SKU = {
    "9515": "EQUIPO-000010",
    "9196": "EQUIPO-000009",
    "9500": "EQUIPO-000012",
    "9513": "EQUIPO-000011",
    "9637": "EQUIPO-000013",
    "9849": "EQUIPO-000008",
    "3639": "EQUIPO-000014",
    "9023": "ACCESORIOS-000024",
    "9167": "ACCESORIOS-001758",
    "9757": "ACCESORIOS-002364",
    "9081-field": "REFACCIONES-000008",
    "9081-license": "REFACCIONES-000007",
}

NEW_EQUIPMENT = {
    "9738": "Rad-97",
    "2005": "Rad-8",
    "9501": "Radical-7",
    "9502": "Radical-7",
    "9794": "Rad-67",
    "9172": "Radical Docking Station",
    "9171": "Radical Docking Station RDS-3",
    "3915": "Módulo IntelliVue",
}


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for raw in ENV_FILE.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key] = value
    env.update({k: v for k, v in os.environ.items() if v})
    return env


def rest(url: str, key: str, path: str, *, method: str = "GET", body: object | None = None):
    data = None if body is None else json.dumps(body).encode()
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
        headers["Prefer"] = "return=representation"
    request = urllib.request.Request(url + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = response.read()
            return response.status, json.loads(payload) if payload else None
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(detail)
        except json.JSONDecodeError:
            parsed = {"message": detail[:500]}
        return error.code, parsed


def product_key(part: str, description: str) -> str:
    folded = " ".join(description.upper().split())
    if part == "9081" and "FIELD" in folded:
        return "9081-field"
    if part == "9081":
        return "9081-license"
    return part


def parse_sheet(path: Path) -> list[dict]:
    book = openpyxl.load_workbook(path, data_only=True)
    sheet = book[book.sheetnames[0]]
    rows: list[dict] = []
    for index, row in enumerate(sheet.iter_rows(values_only=True), 1):
        if index < 4:
            continue
        part = str(row[1]).strip() if row[1] is not None else ""
        description = " ".join(str(row[2]).split()) if row[2] else ""
        location = str(row[6]).strip() if row[6] else ""
        if location not in BINS or not part or part == "None":
            continue
        raw_serial = str(row[3]).strip() if row[3] is not None else ""
        serials = [piece.strip() for piece in raw_serial.replace(";", ",").split(",") if piece.strip()]
        if not serials or serials == ["|"]:
            continue
        made = row[4]
        if isinstance(made, datetime):
            made_on: str | None = made.date().isoformat()
        elif isinstance(made, date):
            made_on = made.isoformat()
        else:
            made_on = None
        note = " ".join(str(row[7]).split()) if row[7] else ""
        if part == "9172":
            note = description if not note else f"{description}. {note}"
        for serial in serials:
            rows.append(
                {
                    "key": product_key(part, description),
                    "part": part,
                    "description": description,
                    "serial": serial,
                    "made_on": made_on,
                    "location": location,
                    "note": note,
                }
            )
    return rows


def main() -> int:
    if len(sys.argv) < 2:
        raise SystemExit("Uso: import-masimo-equipos.py <archivo.xlsx> [--apply]")
    sheet_path = Path(sys.argv[1])
    apply = "--apply" in sys.argv[2:]
    env = load_env()
    url = (env.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("CLOUD_SUPABASE_URL") or "").rstrip("/")
    key = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or env.get("CLOUD_SUPABASE_ANON_KEY") or ""
    if not url or not key:
        raise SystemExit("Faltan las credenciales públicas de Supabase en .env.local")

    units = parse_sheet(sheet_path)
    counts = Counter(unit["key"] for unit in units)
    print(f"series en el archivo: {len(units)}")
    for name, count in counts.most_common():
        print(f"  {name}: {count}")

    status, locations = rest(
        url,
        key,
        f"/rest/v1/locations?select=id,code&warehouse_id=eq.{VSA}&code=in.({','.join(BINS)})",
    )
    if status != 200:
        raise SystemExit(f"No se pudieron leer las ubicaciones ({status})")
    location_ids = {row["code"]: row["id"] for row in locations}

    skus = ",".join(EXISTING_SKU.values())
    status, items = rest(
        url,
        key,
        f"/rest/v1/inventory_items?select=id,sku,part_number,name,quantity,item_kind&sku=in.({skus})",
    )
    if status != 200:
        raise SystemExit(f"No se pudo leer el catálogo ({status})")
    by_sku = {row["sku"]: row for row in items}
    missing = [sku for sku in EXISTING_SKU.values() if sku not in by_sku]
    if missing:
        raise SystemExit(f"Faltan productos del catálogo: {', '.join(missing)}")

    serials = [unit["serial"] for unit in units]
    existing: dict[str, dict] = {}
    for start in range(0, len(serials), 40):
        chunk = ",".join(urllib.parse.quote(serial) for serial in serials[start : start + 40])
        status, found = rest(
            url,
            key,
            f"/rest/v1/serial_numbers?select=id,product_id,serial_number,location_id,warehouse_id&serial_number=in.({chunk})",
        )
        if status != 200:
            raise SystemExit(f"No se pudieron leer las series existentes ({status})")
        for row in found:
            existing[row["serial_number"]] = row
    print(f"series que ya estaban: {len(existing)}")

    if not apply:
        print("Sin --apply no se escribe nada.")
        return 0

    for code in BINS:
        if code in location_ids:
            continue
        status, created = rest(
            url,
            key,
            "/rest/v1/locations",
            method="POST",
            body={"warehouse_id": VSA, "code": code, "name": code, "is_active": True},
        )
        if status not in (200, 201) or not created:
            raise SystemExit(f"No se pudo crear la ubicación {code}: {status} {created}")
        location_ids[code] = created[0]["id"]
        print(f"ubicación nueva: {code}")

    status, last_sku = rest(
        url,
        key,
        "/rest/v1/inventory_items?select=sku&sku=like.EQUIPO-*&order=sku.desc&limit=1",
    )
    if status != 200 or not last_sku:
        raise SystemExit(f"No se pudo leer el último SKU de equipo ({status})")
    next_number = int(last_sku[0]["sku"].split("-")[1]) + 1

    products: dict[str, dict] = {}
    for part_key, sku in EXISTING_SKU.items():
        products[part_key] = by_sku[sku]
        status, updated = rest(
            url,
            key,
            f"/rest/v1/inventory_items?id=eq.{by_sku[sku]['id']}",
            method="PATCH",
            body={"item_kind": "equipo", "category": "equipos", "tracks_serial": True, "brand": "Masimo"},
        )
        if status not in (200, 204):
            raise SystemExit(f"No se pudo marcar {sku} como equipo: {status} {updated}")

    for part_key, name in NEW_EQUIPMENT.items():
        status, found = rest(
            url,
            key,
            f"/rest/v1/inventory_items?select=id,sku,part_number,name,quantity,item_kind&part_number=eq.{part_key}&item_kind=eq.equipo&order=sku&limit=1",
        )
        if status == 200 and found:
            products[part_key] = found[0]
            print(f"equipo ya existente: {found[0]['sku']} {name}")
            continue
        sku = f"EQUIPO-{next_number:06d}"
        next_number += 1
        status, created = rest(
            url,
            key,
            "/rest/v1/inventory_items",
            method="POST",
            body={
                "sku": sku,
                "name": name,
                "category": "equipos",
                "item_kind": "equipo",
                "description": "",
                "quantity": 0,
                "min_stock": 0,
                "unit": "pieza",
                "location": "",
                "brand": "Masimo",
                "model": part_key,
                "serial_number": "",
                "unit_price": 0,
                "supplier": "",
                "notes": REASON,
                "asset_status": "operativo",
                "is_active": True,
                "tracks_lot": False,
                "tracks_serial": True,
                "tracks_expiry": False,
                "max_stock": 0,
                "reorder_point": 0,
                "part_number": part_key,
                "manufacturer": "Masimo",
                "subcategory": "",
            },
        )
        if status not in (200, 201) or not created:
            raise SystemExit(f"No se pudo crear {name}: {status} {created}")
        products[part_key] = created[0]
        print(f"equipo nuevo: {sku} {name} parte {part_key}")

    added = 0
    kept = 0
    moved = 0
    for index, unit in enumerate(units, 1):
        product = products[unit["key"]]
        location_id = location_ids[unit["location"]]
        current = existing.get(unit["serial"])
        if current and current["product_id"] != product["id"]:
            raise SystemExit(
                f"La serie {unit['serial']} ya pertenece a otro producto ({current['product_id']})"
            )
        if current is None:
            status, result = rest(
                url,
                key,
                "/rest/v1/rpc/apply_stock_movement",
                method="POST",
                body={
                    "p_product_id": product["id"],
                    "p_movement_type": "entrada",
                    "p_quantity": 1,
                    "p_note": unit["note"],
                    "p_created_by": ACTOR,
                    "p_reason": REASON,
                    "p_warehouse_id": VSA,
                    "p_location_id": location_id,
                    "p_serial_number": unit["serial"],
                },
            )
            if status not in (200, 201):
                raise SystemExit(f"Entrada {unit['serial']} falló: {status} {result}")
            added += 1
        else:
            kept += 1
            if current.get("location_id") != location_id and int(product.get("quantity") or 0) <= 1:
                status, result = rest(
                    url,
                    key,
                    "/rest/v1/rpc/relocate_stock",
                    method="POST",
                    body={
                        "p_product_id": product["id"],
                        "p_warehouse_id": VSA,
                        "p_location_id": location_id,
                        "p_note": REASON,
                        "p_created_by": ACTOR,
                    },
                )
                if status not in (200, 201):
                    raise SystemExit(f"Reubicación {unit['serial']} falló: {status} {result}")
                moved += 1
                product["quantity"] = 1

        status, result = rest(
            url,
            key,
            f"/rest/v1/serial_numbers?serial_number=eq.{urllib.parse.quote(unit['serial'])}",
            method="PATCH",
            body={
                "notes": unit["note"],
                "manufactured_at": unit["made_on"],
            },
        )
        if status not in (200, 204):
            raise SystemExit(f"No se pudo anotar la serie {unit['serial']}: {status} {result}")
        if index % 40 == 0:
            print(f"  {index}/{len(units)}")

    bins_by_product: dict[str, set[str]] = defaultdict(set)
    for unit in units:
        bins_by_product[unit["key"]].add(unit["location"])
    for part_key, bins in bins_by_product.items():
        product = products[part_key]
        status, result = rest(
            url,
            key,
            f"/rest/v1/inventory_items?id=eq.{product['id']}",
            method="PATCH",
            body={"location": ", ".join(sorted(bins))},
        )
        if status not in (200, 204):
            raise SystemExit(f"No se pudo anotar la ubicación de {product['sku']}: {status} {result}")

    print(f"entradas nuevas: {added}")
    print(f"series que ya estaban: {kept}")
    print(f"reubicadas: {moved}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
