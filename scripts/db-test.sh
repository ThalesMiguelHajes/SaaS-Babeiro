#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Executa as migrations + testes pgTAP em um Postgres 17 descartável (Docker).
#
# Uso:  pnpm db:test:harness            (todos os testes)
#       pnpm db:test:harness 020        (apenas arquivos que contêm "020")
#
# Quando o stack completo do Supabase estiver disponível, prefira `pnpm db:test`
# (supabase test db). Este harness existe para CI e ambientes sem as imagens do Supabase.
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="saas-db-test:17"
CONTAINER="saas-db-test"
DB="app_test"
FILTER="${1:-}"

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "› Construindo imagem $IMAGE"
  docker build -q -t "$IMAGE" "$ROOT/supabase/harness" >/dev/null
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  echo "› Iniciando Postgres de teste"
  docker run -d --name "$CONTAINER" \
    -e POSTGRES_PASSWORD=postgres \
    -v "$ROOT/supabase:/workspace/supabase:ro" \
    "$IMAGE" -c fsync=off -c full_page_writes=off >/dev/null
fi

for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres -q && break
  sleep 0.5
done

psql_exec() { docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -q -U postgres "$@"; }

echo "› Recriando banco $DB"
psql_exec -d postgres -c "drop database if exists $DB with (force);" -c "create database $DB;"
psql_exec -d "$DB" -f /workspace/supabase/harness/supabase-shim.sql >/dev/null
# Igual ao Supabase: extensões no schema extensions, que está no search_path.
psql_exec -d "$DB" -c "create extension if not exists pgtap with schema extensions;" \
  -c "alter database $DB set search_path = \"\$user\", public, extensions;" >/dev/null

echo "› Aplicando migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  name="$(basename "$f")"
  if ! psql_exec -d "$DB" -f "/workspace/supabase/migrations/$name" >/dev/null; then
    echo "✗ Falha na migration $name" >&2
    exit 1
  fi
done

echo "› Executando testes pgTAP"
mapfile -t TESTS < <(cd "$ROOT/supabase/tests" && ls -1 *.sql 2>/dev/null | grep -- "$FILTER" || true)
if [ "${#TESTS[@]}" -eq 0 ]; then
  echo "Nenhum teste encontrado."; exit 0
fi
docker exec -w /workspace/supabase/tests "$CONTAINER" \
  pg_prove -U postgres -d "$DB" --failures "${TESTS[@]}"

if [ -z "$FILTER" ]; then
  echo "› Validando supabase/seed.sql (transação revertida)"
  psql_exec -d "$DB" -c "begin;" -f /workspace/supabase/seed.sql -c "rollback;" >/dev/null
  echo "✓ Seed aplicado sem erros"
fi
