import { describe, expect, it } from "vitest";

import {
  ANY_PROFESSIONAL,
  bookingShareText,
  buildIcs,
  currentStep,
  formatAddress,
  formatDuration,
  maskBrazilPhone,
  parseSelection,
  readableTextColor,
  toProfessionalParam,
} from "@/modules/booking/rules";
import { createBookingSchema, customerFormSchema } from "@/modules/booking/schemas";

const SVC = "30000000-0000-4000-a000-00000000000a";

describe("estado do fluxo na URL", () => {
  it("lê a seleção e descarta valores inválidos", () => {
    const s = parseSelection(
      new URLSearchParams({
        servico: SVC,
        profissional: "x' or 1=1",
        data: "amanhã",
        horario: "2026-12-01T12:00:00.000Z",
      }),
    );
    expect(s).toEqual({
      serviceId: SVC,
      professionalId: null,
      date: null,
      startsAt: "2026-12-01T12:00:00.000Z",
    });
  });

  it("deriva a etapa atual", () => {
    expect(currentStep({ serviceId: null, professionalId: null, date: null, startsAt: null })).toBe(
      "service",
    );
    expect(currentStep({ serviceId: SVC, professionalId: null, date: null, startsAt: null })).toBe(
      "professional",
    );
    expect(
      currentStep({ serviceId: SVC, professionalId: ANY_PROFESSIONAL, date: null, startsAt: null }),
    ).toBe("datetime");
    expect(
      currentStep({
        serviceId: SVC,
        professionalId: ANY_PROFESSIONAL,
        date: null,
        startsAt: "2026-12-01T12:00:00Z",
      }),
    ).toBe("details");
    expect(toProfessionalParam(ANY_PROFESSIONAL)).toBeNull();
    expect(toProfessionalParam(SVC)).toBe(SVC);
  });
});

describe("formatação", () => {
  it("duração", () => {
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h30");
  });

  it("máscara de telefone brasileiro", () => {
    expect(maskBrazilPhone("11912345678")).toBe("(11) 91234-5678");
    expect(maskBrazilPhone("1134567890")).toBe("(11) 3456-7890");
    expect(maskBrazilPhone("+55 11 91234-5678")).toBe("(11) 91234-5678");
    expect(maskBrazilPhone("119")).toBe("(11) 9");
  });

  it("endereço", () => {
    expect(
      formatAddress({
        address_street: "Rua A",
        address_number: "10",
        address_city: "São Paulo",
        address_state: "SP",
      }),
    ).toBe("Rua A, 10 · São Paulo - SP");
    expect(formatAddress({})).toBeNull();
  });

  it("texto legível sobre a cor de destaque", () => {
    expect(readableTextColor("#18181B")).toBe("#ffffff");
    expect(readableTextColor("#F5D061")).toBe("#000000");
    expect(readableTextColor("inválida")).toBe("#ffffff");
  });
});

describe("compartilhamento", () => {
  it("gera .ics com horário em UTC e lembrete", () => {
    const ics = buildIcs({
      uid: "ABC@agenda",
      title: "Corte, barba; etc",
      description: "linha 1\nlinha 2",
      location: null,
      startsAt: "2026-12-01T12:00:00.000Z",
      endsAt: "2026-12-01T12:30:00.000Z",
      now: new Date("2026-11-25T00:00:00Z"),
    });
    expect(ics).toContain("DTSTART:20261201T120000Z");
    expect(ics).toContain("DTEND:20261201T123000Z");
    expect(ics).toContain(String.raw`SUMMARY:Corte\, barba\; etc`);
    expect(ics).toContain("DESCRIPTION:linha 1\\nlinha 2");
    expect(ics).toContain("TRIGGER:-PT2H");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("texto para o WhatsApp do cliente inclui código e link", () => {
    const text = bookingShareText({
      establishmentName: "Barbearia A",
      serviceName: "Corte",
      when: "terça, 1 de dezembro às 09:00",
      professionalName: "Rafa",
      referenceCode: "AB12CD34",
      url: "https://x/reserva/t",
    });
    expect(text).toContain("AB12CD34");
    expect(text).toContain("https://x/reserva/t");
  });
});

describe("formulário do cliente", () => {
  const ok = { name: "Ana", phone: "(11) 91234-5678", email: "", notes: "" };

  it("aceita dados válidos sem e-mail", () => {
    expect(customerFormSchema.safeParse(ok).success).toBe(true);
  });

  it("recusa telefone inválido e e-mail malformado", () => {
    expect(customerFormSchema.safeParse({ ...ok, phone: "123" }).success).toBe(false);
    expect(customerFormSchema.safeParse({ ...ok, email: "ana@" }).success).toBe(false);
  });

  it("honeypot preenchido é recusado", () => {
    const base = {
      ...ok,
      serviceId: SVC,
      professionalId: null,
      startsAt: "2026-12-01T12:00:00.000Z",
      website: "",
      startedAt: 1,
      turnstileToken: null,
    };
    expect(createBookingSchema.safeParse(base).success).toBe(true);
    expect(createBookingSchema.safeParse({ ...base, website: "http://spam" }).success).toBe(false);
  });
});
