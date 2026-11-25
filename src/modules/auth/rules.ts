import type { Database } from "@/types/database";

type MemberRole = Database["public"]["Enums"]["member_role"];

export type MembershipSummary = {
  slug: string;
  role: MemberRole;
};

/**
 * Para onde o usuário vai após o login (MASTER_PLAN §2.4).
 * Super Admin → /admin; um vínculo → painel ou área do profissional; vários → seletor.
 */
export function resolveHomePath(input: {
  isPlatformAdmin: boolean;
  memberships: readonly MembershipSummary[];
}): string {
  if (input.isPlatformAdmin) return "/admin";
  const [only, ...rest] = input.memberships;
  if (!only || rest.length > 0) return "/inicio";
  return only.role === "staff" ? `/profissional/${only.slug}` : `/painel/${only.slug}`;
}

/**
 * Aceita apenas caminhos relativos internos para o parâmetro `next`
 * (impede open redirect para outro domínio).
 */
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (/[\u0000-\u001f]/.test(next)) return null;
  try {
    const url = new URL(next, "http://internal.invalid");
    if (url.origin !== "http://internal.invalid") return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
