import { describe, expect, it } from "vitest";

import {
  createEstablishmentSchema,
  type EstablishmentInput,
} from "@/modules/platform/establishment-schema";

const input: EstablishmentInput = {
  name: "Barbearia Central",
  slug: "barbearia-central",
  business_type: "barbershop",
  timezone: "America/Sao_Paulo",
  description: "",
  owner_name: "",
  owner_email: "",
  phone_e164: "",
  whatsapp_e164: "",
  instagram_handle: "",
  address_street: "",
  address_number: "",
  address_complement: "",
  address_district: "",
  address_city: "",
  address_state: "",
  address_postal_code: "",
};

describe("cadastro de estabelecimento", () => {
  it("aceita cadastro sem endereço e contatos opcionais", () => {
    expect(createEstablishmentSchema.parse(input)).toEqual(input);
  });

  it("normaliza os dados antes de gravar", () => {
    expect(
      createEstablishmentSchema.parse({
        ...input,
        name: " Central ",
        phone_e164: "(11) 91234-5678",
        address_state: "sp",
        address_postal_code: "01001-000",
        instagram_handle: "@central",
      }),
    ).toMatchObject({
      name: "Central",
      phone_e164: "+5511912345678",
      address_state: "SP",
      address_postal_code: "01001000",
      instagram_handle: "central",
    });
  });

  it.each([
    ["slug", "dois--hifens"],
    ["slug", "b"],
    ["timezone", "Fuso/Inexistente"],
    ["owner_email", "sem-arroba"],
    ["phone_e164", "123"],
    ["address_postal_code", "0100-00"],
  ])("rejeita %s inválido (%s)", (field, value) => {
    expect(createEstablishmentSchema.safeParse({ ...input, [field]: value }).success).toBe(false);
  });
});
