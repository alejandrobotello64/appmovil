#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONF_DIR="${MAS_DATA_DIR:-$HOME/.local/mas}"
mkdir -p "$CONF_DIR"

if ! pg_lsclusters --no-header | awk '{print $1,$2,$4}' | grep -q '16 main online'; then
  sudo pg_ctlcluster 16 main start
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
select 'ok' as postgres_up;
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "select 1 from pg_database where datname = 'mas'" | grep -q 1 \
  || sudo -u postgres createdb mas

sudo -u postgres psql -v ON_ERROR_STOP=1 -d mas -f "$ROOT/scripts/setup-local-db.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d mas -f "$ROOT/supabase/migrations/20260915000000_initial_schema.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d mas -f "$ROOT/supabase/seed.sql"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d mas -f "$ROOT/supabase/migrations/20260916000000_inventory_core_structure.sql"
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
server-host = "127.0.0.1"
server-port = 54331
CONF

echo "Local MAS database is ready (schema + seed)."
