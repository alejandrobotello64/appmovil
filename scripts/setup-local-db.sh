#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONF_DIR="${MAS_DATA_DIR:-$HOME/.local/mas}"
mkdir -p "$CONF_DIR"

if command -v pg_lsclusters >/dev/null 2>&1; then
  CLUSTER="$(pg_lsclusters --no-header | awk '{print $1, $2, $4}' | awk '$3 != "online" {print $1, $2; exit}')"
  if [[ -n "${CLUSTER:-}" ]]; then
    # shellcheck disable=SC2086
    sudo pg_ctlcluster $CLUSTER start
  fi
else
  echo "PostgreSQL no está instalado (falta pg_lsclusters)." >&2
  exit 1
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
select 'ok' as postgres_up;
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "select 1 from pg_database where datname = 'mas'" | grep -q 1 \
  || sudo -u postgres createdb mas

sudo -u postgres psql -v ON_ERROR_STOP=1 -d mas -f "$ROOT/scripts/setup-local-db.sql"
shopt -s nullglob
for migration in "$ROOT"/supabase/migrations/*.sql; do
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d mas -f "$migration"
done
sudo -u postgres psql -v ON_ERROR_STOP=1 -d mas -f "$ROOT/supabase/seed.sql"
if [ -f "$ROOT/supabase/seed_catalog.sql" ]; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d mas -f "$ROOT/supabase/seed_catalog.sql"
fi
# Reaplica reglas de categoría sobre el catálogo ya cargado.
sudo -u postgres psql -v ON_ERROR_STOP=1 -d mas <<'SQL'
update public.inventory_items
set
  tracks_expiry = true,
  tracks_lot = true
where item_kind = 'producto'
  and category in ('insumos', 'medicamentos', 'reactivos');
SQL
sudo -u postgres psql -v ON_ERROR_STOP=1 -d mas <<'SQL'
grant usage on schema public to anon, authenticated, authenticator;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
SQL

cat > "$CONF_DIR/postgrest.conf" <<'CONF'
db-uri = "postgres://authenticator:maslocaldev@127.0.0.1:5432/mas"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "super-secret-jwt-token-with-at-least-32-characters-long"
db-max-rows = 10000
server-host = "127.0.0.1"
server-port = 54331
CONF

echo "Local MAS database is ready (schema + users + catalog)."
