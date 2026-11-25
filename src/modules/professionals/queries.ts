import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function listProfessionals(establishmentId: string) {
  const supabase = await createClient();
  const [pros, links] = await Promise.all([
    supabase
      .from("professionals")
      .select(
        "id, display_name, specialties, photo_path, is_bookable, is_active, user_id, sort_order",
      )
      .eq("establishment_id", establishmentId)
      .order("is_active", { ascending: false })
      .order("sort_order")
      .order("display_name"),
    supabase
      .from("professional_services")
      .select("professional_id")
      .eq("establishment_id", establishmentId),
  ]);
  if (pros.error) throw pros.error;
  const count = new Map<string, number>();
  for (const l of links.data ?? [])
    count.set(l.professional_id, (count.get(l.professional_id) ?? 0) + 1);
  return (pros.data ?? []).map((p) => ({ ...p, serviceCount: count.get(p.id) ?? 0 }));
}

export async function getProfessional(establishmentId: string, professionalId: string) {
  const supabase = await createClient();
  const [pro, links] = await Promise.all([
    supabase
      .from("professionals")
      .select("*")
      .eq("establishment_id", establishmentId)
      .eq("id", professionalId)
      .maybeSingle(),
    supabase
      .from("professional_services")
      .select("service_id")
      .eq("establishment_id", establishmentId)
      .eq("professional_id", professionalId),
  ]);
  if (pro.error) throw pro.error;
  if (!pro.data) return null;
  return { ...pro.data, serviceIds: (links.data ?? []).map((l) => l.service_id) };
}

/** Membros ativos que ainda podem ser vinculados a um perfil profissional. */
export async function listLinkableMembers(establishmentId: string) {
  const supabase = await createClient();
  const [members, linked] = await Promise.all([
    supabase
      .from("establishment_members")
      .select("user_id, role, profiles!establishment_members_user_id_fkey(full_name, email)")
      .eq("establishment_id", establishmentId)
      .eq("is_active", true),
    supabase
      .from("professionals")
      .select("user_id")
      .eq("establishment_id", establishmentId)
      .not("user_id", "is", null),
  ]);
  const taken = new Set((linked.data ?? []).map((l) => l.user_id));
  return (members.data ?? [])
    .filter((m) => !taken.has(m.user_id))
    .map((m) => ({
      userId: m.user_id,
      role: m.role,
      name: m.profiles?.full_name ?? "—",
      email: m.profiles?.email ?? null,
    }));
}
