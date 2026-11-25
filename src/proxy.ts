import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env";
import { updateSession } from "@/lib/supabase/proxy";

const PRIVATE_PREFIXES = ["/admin", "/painel", "/profissional", "/inicio", "/redefinir-senha"];

function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  const supabase = new URL(publicEnv.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseWs = `${supabase.protocol === "https:" ? "wss:" : "ws:"}//${supabase.host}`;

  return [
    "default-src 'self'",
    // 'strict-dynamic': o script do Turnstile é inserido por um script já autorizado (nonce).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Componentes Radix posicionam popovers com atributos style inline.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${supabase.origin}`,
    "font-src 'self'",
    `connect-src 'self' ${supabase.origin} ${supabaseWs} https://challenges.cloudflare.com`,
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const { response, isAuthenticated } = await updateSession(request, requestHeaders);

  const { pathname, search } = request.nextUrl;
  const isPrivate = PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isPrivate && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(loginUrl);
    // Preserva cookies eventualmente limpos/renovados.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
