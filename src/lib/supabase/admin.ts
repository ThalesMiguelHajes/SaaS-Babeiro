import "server-only";

import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * Cliente com a chave SECRETA: ignora RLS. Uso restrito (SECURITY.md §5):
 * API administrativa do Auth, RPCs públicas chamadas pelo servidor e scripts.
 * Toda chamada deve ser precedida de autorização explícita no servidor.
 */
export function createAdminClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SECRET_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    },
  );
}
