#!/usr/bin/env bash
# Falha se algum segredo de servidor aparecer no bundle enviado ao navegador (SECURITY.md R3).
set -euo pipefail
DIR=".next/static"
[ -d "$DIR" ] || { echo "Execute 'pnpm build' antes."; exit 1; }
PATTERNS='SUPABASE_SECRET_KEY|service_role|sb_secret_|TURNSTILE_SECRET_KEY|IP_HASH_SECRET|RESEND_API_KEY|PAYMENT_PROVIDER_'
if grep -rEl "$PATTERNS" "$DIR" >/dev/null 2>&1; then
  echo "✗ Possível segredo no bundle do cliente:"; grep -rEl "$PATTERNS" "$DIR"; exit 1
fi
echo "✓ Nenhum segredo de servidor no bundle do cliente."
