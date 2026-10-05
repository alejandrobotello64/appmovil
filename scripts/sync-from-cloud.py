#!/usr/bin/env python3
"""Replace local Postgres business data with a live snapshot from cloud Supabase.

Keeps local app_users (seed logins). Skips tables the anon role cannot read.
Usage: npm run db:sync-cloud
"""

from __future__ import annotations

import json
import os
import ssl
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE_SIZE = 1000
SKIP_TABLES = {"app_users"}
CTX = ssl.create_default_context()


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip("'").strip('"')
    return values


def env_value(name: str, file_values: dict[str, str], default: str = "") -> str:
    return os.environ.get(name) or file_values.get(name) or default


def psql(sql: str) -> str:
    with tempfile.NamedTemporaryFile(
        "w", suffix=".sql", prefix="mas-sync-", delete=False, encoding="utf-8"
    ) as handle:
        handle.write(sql)
        sql_path = handle.name
    os.chmod(sql_path, 0o644)
    try:
        result = subprocess.run(
            [
                "sudo",
                "-u",
                "postgres",
                "psql",
                "-v",
                "ON_ERROR_STOP=1",
                "-d",
                "mas",
                "-f",
                sql_path,
            ],
            capture_output=True,
            text=True,
        )
    finally:
        os.unlink(sql_path)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "psql failed")
    return result.stdout


def psql_value(sql: str) -> str:
    result = subprocess.run(
        ["sudo", "-u", "postgres", "psql", "-d", "mas", "-tAc", sql],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def local_tables() -> list[str]:
    raw = psql_value(
        "select json_agg(tablename order by tablename) "
        "from pg_tables where schemaname = 'public'"
    )
    return json.loads(raw or "[]")


def local_columns(table: str) -> list[str]:
    raw = psql_value(
        """
        select coalesce(json_agg(a.attname order by a.attnum), '[]'::json)
        from pg_attribute a
        join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = %s
          and a.attnum > 0
          and not a.attisdropped
          and a.attgenerated = ''
        """
        % ("'" + table.replace("'", "''") + "'")
    )
    return json.loads(raw or "[]")


def quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def fetch_table(base_url: str, anon: str, table: str) -> tuple[str, list[dict] | None, str]:
    rows: list[dict] = []
    offset = 0
    total = None
    while True:
        query = urllib.parse.urlencode({"select": "*", "limit": PAGE_SIZE, "offset": offset})
        request = urllib.request.Request(
            f"{base_url}/rest/v1/{table}?{query}",
            headers={
                "apikey": anon,
                "Authorization": f"Bearer {anon}",
                "Prefer": "count=exact",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, context=CTX, timeout=120) as response:
                payload = json.loads(response.read().decode("utf-8") or "[]")
                content_range = response.headers.get("content-range") or ""
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            if error.code in {401, 403, 404, 406}:
                return "skip", None, f"HTTP {error.code}: {body[:180]}"
            raise RuntimeError(f"{table}: HTTP {error.code}: {body[:300]}") from error

        if not isinstance(payload, list):
            return "skip", None, f"unexpected payload type {type(payload).__name__}"

        rows.extend(payload)
        if "/" in content_range:
            try:
                total = int(content_range.split("/")[-1])
            except ValueError:
                total = None
        if total is not None and len(rows) >= total:
            break
        if len(payload) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(0.05)

    return "ok", rows, f"{len(rows)} rows"


def json_literal(value: object) -> str:
    dumped = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    dumped = dumped.replace("\u0000", "")
    tag = "mascloud"
    nonce = 0
    while f"${tag}$" in dumped:
        nonce += 1
        tag = f"mascloud{nonce}"
    return f"${tag}${dumped}${tag}$"


def insert_rows(table: str, columns: list[str], rows: list[dict]) -> None:
    if not rows:
        return
    cloud_keys: set[str] = set()
    for row in rows:
        cloud_keys.update(row.keys())
    usable = [column for column in columns if column in cloud_keys]
    if not usable:
        return
    filtered = [{column: row.get(column) for column in usable} for row in rows]
    col_sql = ", ".join(quote_ident(column) for column in usable)
    sql = f"""
set session_replication_role = replica;
insert into public.{quote_ident(table)} ({col_sql})
overriding system value
select {col_sql}
from json_populate_recordset(null::public.{quote_ident(table)}, {json_literal(filtered)}::json);
"""
    psql(sql)


def main() -> int:
    file_values = load_env_file(ROOT / ".env.local")
    file_values.update({k: v for k, v in load_env_file(ROOT / ".env").items() if k not in file_values})

    base_url = env_value("CLOUD_SUPABASE_URL", file_values).rstrip("/")
    anon = env_value("CLOUD_SUPABASE_ANON_KEY", file_values)
    if not base_url or not anon:
        print(
            "Faltan CLOUD_SUPABASE_URL y CLOUD_SUPABASE_ANON_KEY en .env.local.",
            file=sys.stderr,
        )
        return 1
    if "127.0.0.1" in base_url or "localhost" in base_url:
        print("CLOUD_SUPABASE_URL apunta a localhost; usa la URL del proyecto en la nube.", file=sys.stderr)
        return 1

    tables = [table for table in local_tables() if table not in SKIP_TABLES]
    snapshots: dict[str, list[dict]] = {}
    skipped: list[tuple[str, str]] = [("app_users", "se conservan los logins locales")]

    print(f"Leyendo {len(tables)} tablas desde {base_url} ...")
    for table in tables:
        status, rows, detail = fetch_table(base_url, anon, table)
        if status != "ok" or rows is None:
            skipped.append((table, detail))
            print(f"  skip {table}: {detail}")
            continue
        snapshots[table] = rows
        print(f"  ok   {table}: {detail}")

    replace_list = ", ".join(f"public.{quote_ident(table)}" for table in snapshots)
    print(f"\nReemplazando {len(snapshots)} tablas locales (TRUNCATE + INSERT)...")
    psql(
        f"""
set session_replication_role = replica;
truncate table {replace_list} restart identity cascade;
"""
    )

    failed: list[tuple[str, str]] = []
    loaded = 0
    for table, rows in snapshots.items():
        columns = local_columns(table)
        try:
            insert_rows(table, columns, rows)
            loaded += len(rows)
            print(f"  load {table}: {len(rows)}")
        except Exception as error:  # noqa: BLE001 — report per-table and continue
            failed.append((table, str(error)))
            print(f"  FAIL {table}: {error}")

    print("\nConteos locales tras la sincronización:")
    print(
        psql(
            """
select format('%-42s %s', relname, n_live_tup)
from pg_stat_user_tables
where schemaname = 'public' and n_live_tup > 0
order by n_live_tup desc, relname;
"""
        )
    )

    if skipped:
        print("Tablas no tocadas:")
        for table, reason in skipped:
            print(f"  - {table}: {reason}")

    if failed:
        print("\nFallos:", file=sys.stderr)
        for table, reason in failed:
            print(f"  - {table}: {reason}", file=sys.stderr)
        return 1

    snapshot_path = write_snapshot(snapshots)
    print(f"Snapshot escrito en {snapshot_path.relative_to(ROOT)} ({loaded} filas).")
    print(f"Listo. {loaded} filas copiadas desde la nube.")
    return 0


def write_snapshot(snapshots: dict[str, list[dict]]) -> Path:
    """Freeze the cloud rows into supabase/seed_cloud_snapshot.sql for db:local."""
    loaded_tables = [table for table, rows in snapshots.items() if rows]
    statements: list[str] = []
    total = 0
    for table in loaded_tables:
        columns = local_columns(table)
        rows = snapshots[table]
        cloud_keys: set[str] = set()
        for row in rows:
            cloud_keys.update(row.keys())
        usable = [column for column in columns if column in cloud_keys]
        if not usable:
            continue
        filtered = [{column: row.get(column) for column in usable} for row in rows]
        total += len(filtered)
        col_sql = ", ".join(quote_ident(column) for column in usable)
        statements.append(
            f"""insert into public.{quote_ident(table)} ({col_sql})
overriding system value
select {col_sql}
from json_populate_recordset(null::public.{quote_ident(table)}, {json_literal(filtered)}::json);
"""
        )

    truncate_list = ", ".join(f"public.{quote_ident(table)}" for table in snapshots)
    header = f"""-- Snapshot de las tablas de negocio leídas desde Supabase (proyecto iqfareiwiadqsauejaaf).
-- No incluye app_users ni la bóveda de contraseñas (el rol anon no puede leerlas).
-- Regenerar: npm run db:sync-cloud
-- Filas: {total}

begin;
set session_replication_role = replica;
truncate table {truncate_list} restart identity cascade;
"""
    path = ROOT / "supabase" / "seed_cloud_snapshot.sql"
    path.write_text(header + "\n".join(statements) + "\ncommit;\n", encoding="utf-8")
    return path


if __name__ == "__main__":
    raise SystemExit(main())
