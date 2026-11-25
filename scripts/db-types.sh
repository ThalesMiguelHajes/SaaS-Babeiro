#!/usr/bin/env bash
# Gera src/types/database.ts a partir do schema.
#   pnpm db:types            → Supabase local (supabase start)
#   pnpm db:types --harness  → banco de teste do harness (scripts/db-test.sh)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/src/types/database.ts"
mkdir -p "$(dirname "$OUT")"

if [ "${1:-}" = "--harness" ]; then
  IP="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' saas-db-test)"
  # O Postgres descartável do harness não oferece TLS.
  SOURCE=(--db-url "postgresql://postgres:postgres@${IP}:5432/app_test?sslmode=disable")
else
  SOURCE=(--local)
fi

TMP="$(mktemp)"
pnpm exec supabase gen types typescript "${SOURCE[@]}" --schema public > "$TMP" 2>/dev/null
{
  echo "// ARQUIVO GERADO por scripts/db-types.sh — não editar manualmente."
  cat "$TMP"
} > "$OUT"
rm -f "$TMP"
pnpm exec prettier --log-level warn --write "$OUT"
echo "Tipos gerados em src/types/database.ts"
