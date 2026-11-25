import "server-only";

import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, type ListFilters } from "@/modules/platform/establishment-list";

export async function listEstablishments({ q, status, pagina }: ListFilters) {
  const supabase = await createClient();
  let query = supabase
    .from("establishments")
    .select("id, name, slug, status, address_city, address_state", { count: "exact" })
    .order("name")
    .order("id");

  if (status) query = query.eq("status", status);
  // O prefixo ***= do PostgreSQL trata toda a busca como texto literal.
  if (q) query = query.regexIMatch("name", "***=" + q);

  const offset = (pagina - 1) * PAGE_SIZE;
  return query.range(offset, offset + PAGE_SIZE - 1);
}
