#!/usr/bin/env bash
set -euo pipefail
CONF="${MAS_DATA_DIR:-$HOME/.local/mas}/postgrest.conf"
POSTGREST_BIN="${POSTGREST_BIN:-$HOME/.local/bin/postgrest}"

if [[ ! -f "$CONF" ]]; then
  echo "Run npm run db:local first." >&2
  exit 1
fi

if ! curl -sf -o /dev/null "http://127.0.0.1:54331/" 2>/dev/null; then
  "$POSTGREST_BIN" "$CONF" &
  sleep 0.4
fi

exec node "$(dirname "$0")/supabase-gateway.mjs"
