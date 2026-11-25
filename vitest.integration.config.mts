import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Testes de integração contra o Supabase local (INTEGRATION_DB=1). Mesma resolução dos unitários.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(new URL("./tests/unit/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
