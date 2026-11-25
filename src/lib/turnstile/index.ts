import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** O Turnstile só é exigido quando as duas chaves estão configuradas (DEPLOY.md). */
export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

/** Valida o token do Cloudflare Turnstile no servidor. Sem chaves configuradas, não bloqueia. */
export async function verifyTurnstile(token: string | null | undefined): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (!token || token.length > 2048) return false;
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
