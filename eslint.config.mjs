import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      // A chave secreta só pode ser usada em actions, no fluxo público e em scripts (SECURITY.md §5).
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              message:
                "Cliente com chave secreta: permitido apenas em modules/**/actions.ts, modules/booking/** e scripts/.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/modules/**/actions.ts",
      "src/modules/booking/**",
      "scripts/**",
      "src/lib/supabase/admin.ts",
    ],
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/types/database.ts"]),
]);

export default eslintConfig;
