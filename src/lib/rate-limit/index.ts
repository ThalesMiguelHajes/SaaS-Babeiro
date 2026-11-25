import "server-only";

import { createHmac } from "node:crypto";

import { headers } from "next/headers";

/**
 * Hash do IP do visitante (SECURITY §8): HMAC-SHA256 com segredo, nunca o IP em claro.
 * Na Vercel o IP real vem em x-forwarded-for / x-real-ip. Sem IP conhecido → null
 * (o banco não aplica o limite por IP, mas os demais limites continuam valendo).
 */
export async function clientIpHash(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  if (!ip) return null;
  return hashIp(ip, ipHashSecret());
}

export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

/** Usa IP_HASH_SECRET; na falta dela, deriva da chave secreta do Supabase (também só do servidor). */
function ipHashSecret(): string {
  return process.env.IP_HASH_SECRET || `ip:${process.env.SUPABASE_SECRET_KEY ?? "local"}`;
}
