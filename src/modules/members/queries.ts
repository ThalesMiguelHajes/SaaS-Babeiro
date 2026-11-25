import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Equipe e convites pendentes do estabelecimento (RLS: membros veem a equipe; convites só owner/admin). */
export async function getTeam(establishmentId: string) {
  const supabase = await createClient();
  const [members, invitations] = await Promise.all([
    supabase
      .from("establishment_members")
      .select(
        "id, user_id, role, is_active, created_at, profiles!establishment_members_user_id_fkey(full_name, email)",
      )
      .eq("establishment_id", establishmentId)
      .order("created_at"),
    supabase
      .from("establishment_invitations")
      .select("id, email, role, expires_at, created_at")
      .eq("establishment_id", establishmentId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);
  if (members.error) throw members.error;

  return {
    members: (members.data ?? []).map((m) => ({
      id: m.id,
      userId: m.user_id,
      role: m.role,
      isActive: m.is_active,
      createdAt: m.created_at,
      name: m.profiles?.full_name ?? "—",
      email: m.profiles?.email ?? null,
    })),
    invitations: invitations.data ?? [],
  };
}
