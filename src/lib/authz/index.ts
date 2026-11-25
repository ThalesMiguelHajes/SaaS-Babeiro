import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type MemberRole = Database["public"]["Enums"]["member_role"];
type EstablishmentStatus = Database["public"]["Enums"]["establishment_status"];
type PlatformRole = Database["public"]["Enums"]["platform_role"];

export type CurrentUser = { id: string; email: string | null; fullName: string };

export type Membership = {
  id: string;
  slug: string;
  name: string;
  status: EstablishmentStatus;
  role: MemberRole;
  accentColor: string;
  timezone: string;
  professionalId: string | null;
};

export type MembershipContext = {
  user: CurrentUser;
  role: MemberRole;
  professionalId: string | null;
  establishment: {
    id: string;
    slug: string;
    name: string;
    status: EstablishmentStatus;
    accentColor: string;
    timezone: string;
  };
};

type SessionContext = {
  user: CurrentUser;
  platformRole: PlatformRole | null;
  memberships: Membership[];
};

type RawContext = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  platform_role: PlatformRole | null;
  memberships: {
    establishment_id: string;
    slug: string;
    name: string;
    status: EstablishmentStatus;
    role: MemberRole;
    accent_color: string;
    timezone: string;
    professional_id: string | null;
  }[];
};

/**
 * Sessão da requisição: valida o token no servidor (getClaims — assinatura verificada, nunca só
 * o cookie) e carrega perfil, papel na plataforma e vínculos em UMA chamada ao banco.
 * Memoizado por requisição com React.cache: layouts e páginas reutilizam o mesmo resultado.
 */
const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  const { data: raw } = await supabase.rpc("get_session_context");
  const ctx = raw as RawContext | null;

  return {
    user: {
      id: claims.sub,
      email: ctx?.email ?? (typeof claims.email === "string" ? claims.email : null),
      fullName: ctx?.full_name ?? "Usuário",
    },
    platformRole: ctx?.platform_role ?? null,
    memberships: (ctx?.memberships ?? []).map((m) => ({
      id: m.establishment_id,
      slug: m.slug,
      name: m.name,
      status: m.status,
      role: m.role,
      accentColor: m.accent_color,
      timezone: m.timezone,
      professionalId: m.professional_id ?? null,
    })),
  };
});

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return (await getSessionContext())?.user ?? null;
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function isPlatformAdmin(): Promise<boolean> {
  return (await getSessionContext())?.platformRole === "super_admin";
}

/** Exige Super Admin. Qualquer outro usuário recebe 404 (não revela a existência da área). */
export async function requirePlatformAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!(await isPlatformAdmin())) notFound();
  return user;
}

/** Vínculos ativos do usuário (estabelecimentos desativados não aparecem). */
export async function listMyMemberships(): Promise<Membership[]> {
  return (await getSessionContext())?.memberships ?? [];
}

function toMembershipContext(user: CurrentUser, membership: Membership): MembershipContext {
  return {
    user,
    role: membership.role,
    professionalId: membership.professionalId,
    establishment: {
      id: membership.id,
      slug: membership.slug,
      name: membership.name,
      status: membership.status,
      accentColor: membership.accentColor,
      timezone: membership.timezone,
    },
  };
}

/**
 * Vínculo do usuário com o estabelecimento do slug, se tiver um dos papéis informados.
 * Para Server Actions (que devolvem Result em vez de redirecionar ou dar 404).
 */
export async function getMembership(
  slug: string,
  roles: readonly MemberRole[] = ["owner", "admin", "staff"],
): Promise<MembershipContext | null> {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const membership = ctx.memberships.find((m) => m.slug === slug.toLowerCase());
  if (!membership || !roles.includes(membership.role)) return null;
  return toMembershipContext(ctx.user, membership);
}

/**
 * Exige vínculo ativo com o estabelecimento do slug e um dos papéis informados.
 * O slug não é autorização: o vínculo vem do banco (RLS) e é conferido aqui;
 * as consultas e RPCs da página continuam protegidas pelo RLS.
 */
export async function requireMembership(
  slug: string,
  roles: readonly MemberRole[] = ["owner", "admin", "staff"],
): Promise<MembershipContext> {
  if (!(await getSessionContext())) redirect("/login");
  const membership = await getMembership(slug, roles);
  if (!membership) notFound();
  return membership;
}

/** Exige que o usuário tenha um perfil profissional ativo vinculado no estabelecimento. */
export async function requireProfessional(
  slug: string,
): Promise<MembershipContext & { professionalId: string }> {
  const membership = await requireMembership(slug);
  if (!membership.professionalId) notFound();
  return { ...membership, professionalId: membership.professionalId };
}
