import { describe, expect, it } from "vitest";

import { resolveHomePath, safeNextPath } from "@/modules/auth/rules";

describe("resolveHomePath", () => {
  it("leva o Super Admin para /admin", () => {
    expect(
      resolveHomePath({ isPlatformAdmin: true, memberships: [{ slug: "a", role: "owner" }] }),
    ).toBe("/admin");
  });

  it("leva owner/admin com um vínculo para o painel", () => {
    expect(
      resolveHomePath({
        isPlatformAdmin: false,
        memberships: [{ slug: "barbearia-a", role: "admin" }],
      }),
    ).toBe("/painel/barbearia-a");
  });

  it("leva staff com um vínculo para a área do profissional", () => {
    expect(
      resolveHomePath({ isPlatformAdmin: false, memberships: [{ slug: "studio", role: "staff" }] }),
    ).toBe("/profissional/studio");
  });

  it("leva quem tem vários vínculos ou nenhum para o seletor", () => {
    expect(
      resolveHomePath({
        isPlatformAdmin: false,
        memberships: [
          { slug: "a", role: "owner" },
          { slug: "b", role: "staff" },
        ],
      }),
    ).toBe("/inicio");
    expect(resolveHomePath({ isPlatformAdmin: false, memberships: [] })).toBe("/inicio");
  });
});

describe("safeNextPath", () => {
  it.each(["/painel/a", "/painel/a/agenda?data=2026-11-25", "/"])(
    "aceita caminho interno %s",
    (path) => {
      expect(safeNextPath(path)).toBe(path);
    },
  );

  it.each([
    "https://malicioso.com",
    "//malicioso.com",
    "/\\malicioso.com",
    "javascript:alert(1)",
    "painel",
    "",
    "/a\nb",
    undefined,
    42,
  ])("rejeita %s", (value) => {
    expect(safeNextPath(value)).toBeNull();
  });
});
