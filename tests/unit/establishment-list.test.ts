import { describe, expect, it } from "vitest";

import { listFilters, listUrl } from "@/modules/platform/establishment-list";

describe("filtros da lista de estabelecimentos", () => {
  it("mantém busca e status ao navegar entre páginas", () => {
    const filters = listFilters.parse({ q: "  Corte & Cor  ", status: "suspended", pagina: "2" });
    expect(listUrl(filters)).toBe(
      "/admin/estabelecimentos?q=Corte+%26+Cor&status=suspended&pagina=2",
    );
  });

  it.each(["0", "-1", "1.5", "abc", "999999999999999999"])(
    "abre a primeira página com entrada inválida %s",
    (pagina) => {
      const filters = listFilters.parse({ pagina, status: "unknown" });
      expect(listUrl(filters)).toBe("/admin/estabelecimentos");
    },
  );
});
