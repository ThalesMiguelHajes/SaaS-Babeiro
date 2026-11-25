import type { NextConfig } from "next";

// Cabeçalhos de segurança estáticos (SECURITY.md §9). A CSP com nonce é aplicada em src/proxy.ts.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Decisão D22 (PROGRESS.md): Cache Components desligado — quase todas as páginas são
  // dinâmicas por usuário e a leitura de sessão exigiria <Suspense> em toda a árvore.
  cacheComponents: false,
  poweredByHeader: false,
  experimental: {
    // Upload de logo/capa (até 5 MB, validado na action) passa por Server Action.
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Links com token privado: não vazar a URL por Referer nem indexar.
      {
        source: "/convite/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/reserva/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
