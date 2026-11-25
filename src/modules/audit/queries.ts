import "server-only";

import { createClient } from "@/lib/supabase/server";

export const AUDIT_PAGE_SIZE = 30;

export async function listAuditLogs(filters: {
  establishmentId?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const size = filters.pageSize ?? AUDIT_PAGE_SIZE;

  let query = supabase
    .from("audit_logs")
    .select(
      "id, establishment_id, actor_user_id, actor_type, action, entity_type, metadata, created_at",
      {
        count: "exact",
      },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * size, page * size - 1);

  if (filters.establishmentId) query = query.eq("establishment_id", filters.establishmentId);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lt("created_at", filters.to);

  const { data, count, error } = await query;
  if (error) throw error;
  const rows = data ?? [];

  // Nomes de atores e estabelecimentos (sem FK na auditoria, de propósito).
  const actorIds = [
    ...new Set(rows.map((r) => r.actor_user_id).filter((v): v is string => Boolean(v))),
  ];
  const estIds = [
    ...new Set(rows.map((r) => r.establishment_id).filter((v): v is string => Boolean(v))),
  ];
  const [actors, establishments] = await Promise.all([
    actorIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    estIds.length
      ? supabase.from("establishments").select("id, name").in("id", estIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const actorName = new Map((actors.data ?? []).map((a) => [a.id, a.full_name]));
  const estName = new Map((establishments.data ?? []).map((e) => [e.id, e.name]));

  return {
    rows: rows.map((r) => ({
      ...r,
      actorName: r.actor_user_id
        ? (actorName.get(r.actor_user_id) ?? "Usuário removido")
        : "Sistema",
      establishmentName: r.establishment_id ? (estName.get(r.establishment_id) ?? "—") : null,
    })),
    total: count ?? 0,
    page,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / size)),
  };
}
