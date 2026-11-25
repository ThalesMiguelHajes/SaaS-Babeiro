import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type EstablishmentStatus = Database["public"]["Enums"]["establishment_status"];

export const PAGE_SIZE = 20;

/** Escapa curingas para uso em ilike. */
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function listEstablishments(filters: {
  q?: string;
  status?: EstablishmentStatus;
  page?: number;
}) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  let query = supabase
    .from("establishments")
    .select(
      "id, slug, name, status, owner_name, owner_email, address_city, address_state, created_at",
      {
        count: "exact",
      },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.q) {
    const p = likePattern(filters.q);
    query = query.or(`name.ilike.${p},slug.ilike.${p},owner_email.ilike.${p}`);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return {
    rows: data ?? [],
    total: count ?? 0,
    page,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
  };
}

export async function getEstablishment(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("establishments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getEstablishmentTeam(establishmentId: string) {
  const supabase = await createClient();
  const [members, invitations] = await Promise.all([
    supabase
      .from("establishment_members")
      .select(
        "id, role, is_active, created_at, profiles!establishment_members_user_id_fkey(full_name, email)",
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
  if (invitations.error) throw invitations.error;

  return {
    members: (members.data ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      isActive: m.is_active,
      createdAt: m.created_at,
      name: m.profiles?.full_name ?? "—",
      email: m.profiles?.email ?? null,
    })),
    invitations: invitations.data ?? [],
  };
}

/** Contagens do painel em uma única chamada (RPC restrita ao Super Admin). */
export async function getPlatformStats() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_overview");
  if (error) throw error;
  const d = data as {
    total: number;
    active: number;
    suspended: number;
    deactivated: number;
    new_last_30: number;
  };
  return {
    total: d.total,
    active: d.active,
    suspended: d.suspended,
    deactivated: d.deactivated,
    newLast30: d.new_last_30,
  };
}

export async function listUsers(filters: { q?: string; page?: number }) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  let query = supabase
    .from("profiles")
    .select(
      "id, full_name, email, created_at, platform_admins!platform_admins_user_id_fkey(platform_role), establishment_members!establishment_members_user_id_fkey(role, is_active, establishments(name, slug))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (filters.q) {
    const p = likePattern(filters.q);
    query = query.or(`full_name.ilike.${p},email.ilike.${p}`);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return {
    rows: (data ?? []).map((u) => ({
      id: u.id,
      name: u.full_name,
      email: u.email,
      createdAt: u.created_at,
      platformRole: u.platform_admins?.platform_role ?? null,
      memberships: (u.establishment_members ?? [])
        .filter((m) => m.is_active && m.establishments)
        .map((m) => ({ role: m.role, name: m.establishments!.name, slug: m.establishments!.slug })),
    })),
    total: count ?? 0,
    page,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
  };
}
