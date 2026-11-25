import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type MemberRole = Database["public"]["Enums"]["member_role"];
type EstablishmentStatus = Database["public"]["Enums"]["establishment_status"];

export type CurrentUser = { id: string; email: string | null; fullName: string };

export type MembershipContext = {
  user: CurrentUser;
  role: MemberRole;
  establishment: {
    id: string;
    slug: string;
    name: string;
    status: EstablishmentStatus;
    accentColor: string;
    timezone: string;
  };
};

/**
 * Usuário autenticado da requisição (validado no servidor via getClaims, nunca só pelo cookie).
 * Memoizado por requisição com React.cache.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    fullName: profile?.full_name ?? "Usuário",
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_admins")
    .select("platform_role")
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.platform_role === "super_admin";
});

/** Exige Super Admin. Qualquer outro usuário recebe 404 (não revela a existência da área). */
export async function requirePlatformAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!(await isPlatformAdmin())) notFound();
  return user;
}

/**
 * Exige vínculo ativo com o estabelecimento do slug e um dos papéis informados.
 * O slug não é autorização: a consulta passa pelo RLS e o vínculo é conferido aqui.
 */
export const requireMembership = cache(
  async (
    slug: string,
    roles: readonly MemberRole[] = ["owner", "admin", "staff"],
  ): Promise<MembershipContext> => {
    const user = await requireUser();
    const supabase = await createClient();

    const { data: establishment } = await supabase
      .from("establishments")
      .select("id, slug, name, status, accent_color, timezone")
      .eq("slug", slug)
      .maybeSingle();
    if (!establishment) notFound();

    const { data: membership } = await supabase
      .from("establishment_members")
      .select("role")
      .eq("establishment_id", establishment.id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership || !roles.includes(membership.role)) notFound();

    return {
      user,
      role: membership.role,
      establishment: {
        id: establishment.id,
        slug: establishment.slug,
        name: establishment.name,
        status: establishment.status,
        accentColor: establishment.accent_color,
        timezone: establishment.timezone,
      },
    };
  },
);

/** Vínculos ativos do usuário (para o redirecionamento pós-login e o seletor). */
export const listMyMemberships = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("establishment_members")
    .select("role, establishments!inner(id, slug, name, status)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .neq("establishments.status", "deactivated")
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({
    role: row.role,
    id: row.establishments.id,
    slug: row.establishments.slug,
    name: row.establishments.name,
    status: row.establishments.status,
  }));
});
