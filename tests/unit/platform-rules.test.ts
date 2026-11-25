import { describe, expect, it } from "vitest";

import { invitationMessage, slugify } from "@/modules/platform/rules";
import { establishmentFormSchema, toEstablishmentPayload } from "@/modules/platform/schemas";

describe("slugify", () => {
  it.each([
    ["Barbearia São João", "barbearia-sao-joao"],
    ["  Studio  Beleza & Cia!! ", "studio-beleza-e-cia"],
    ["Corte--Fino", "corte-fino"],
    ["ÁÉÍÓÚ ç", "aeiou-c"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("limita a 60 caracteres sem terminar em hífen", () => {
    const slug = slugify("a".repeat(59) + " b c");
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });
});

const base = {
  name: "Barbearia Central",
  slug: "barbearia-central",
  business_type: "barbershop" as const,
  timezone: "America/Sao_Paulo",
  description: "",
  owner_name: "João",
  owner_email: "Joao@Exemplo.com",
  phone: "",
  whatsapp: "(11) 91234-5678",
  instagram_handle: "@barbearia.central",
  address_postal_code: "01310-100",
  address_street: "",
  address_number: "",
  address_complement: "",
  address_district: "",
  address_city: "São Paulo",
  address_state: "sp",
  accent_color: "#18181B",
};

describe("establishmentFormSchema", () => {
  it("normaliza telefone, e-mail, Instagram, CEP e UF", () => {
    const data = establishmentFormSchema.parse(base);
    expect(data.whatsapp).toBe("+5511912345678");
    expect(data.phone).toBeNull();
    expect(data.owner_email).toBe("joao@exemplo.com");
    expect(data.instagram_handle).toBe("barbearia.central");
    expect(data.address_postal_code).toBe("01310100");
    expect(data.address_state).toBe("SP");
    expect(data.description).toBeNull();
    expect(toEstablishmentPayload(data)).toMatchObject({
      whatsapp_e164: "+5511912345678",
      phone_e164: null,
    });
  });

  it.each([
    ["slug", "Com Espaço"],
    ["whatsapp", "123"],
    ["owner_email", "nao-e-email"],
    ["address_state", "XX"],
    ["address_postal_code", "123"],
  ])("rejeita %s inválido", (field, value) => {
    const result = establishmentFormSchema.safeParse({ ...base, [field]: value });
    expect(result.success).toBe(false);
  });
});

describe("invitationMessage", () => {
  it("monta a mensagem com nome, papel e link", () => {
    const msg = invitationMessage({
      establishmentName: "Barbearia A",
      roleLabel: "Responsável",
      url: "https://x/convite/abc",
    });
    expect(msg).toContain("Barbearia A");
    expect(msg).toContain("responsável");
    expect(msg).toContain("https://x/convite/abc");
  });
});
