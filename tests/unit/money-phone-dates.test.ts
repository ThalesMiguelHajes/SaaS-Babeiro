import { describe, expect, it } from "vitest";

import { formatDateTime, formatTime } from "@/lib/dates";
import { formatCents, parseBrlToCents } from "@/lib/money";
import { formatPhone, toE164, whatsappLink } from "@/lib/phone";

// Intl usa espaço não separável entre "R$" e o número.
const nbsp = (s: string) => s.replace(/ /g, " ");

describe("money", () => {
  it("formata centavos em BRL", () => {
    expect(nbsp(formatCents(4000))).toBe("R$ 40,00");
    expect(nbsp(formatCents(15990))).toBe("R$ 159,90");
    expect(nbsp(formatCents(123456))).toBe("R$ 1.234,56");
  });

  it("rejeita valores que não são centavos inteiros", () => {
    expect(() => formatCents(10.5)).toThrow();
  });

  it.each([
    ["40", 4000],
    ["40,5", 4050],
    ["R$ 99,90", 9990],
    ["1.234,56", 123456],
    ["0,01", 1],
  ])("converte %s em %i centavos", (input, cents) => {
    expect(parseBrlToCents(input)).toBe(cents);
  });

  it.each(["abc", "10,999", "1,2,3", "-5", ""])("rejeita %s", (input) => {
    expect(parseBrlToCents(input)).toBeNull();
  });
});

describe("phone", () => {
  it("normaliza celular brasileiro para E.164", () => {
    expect(toE164("(11) 91234-5678")).toBe("+5511912345678");
    expect(toE164("11912345678")).toBe("+5511912345678");
    expect(toE164("+55 11 91234-5678")).toBe("+5511912345678");
  });

  it("rejeita números inválidos", () => {
    expect(toE164("123")).toBeNull();
  });

  it("formata no padrão nacional", () => {
    expect(formatPhone("+5511912345678")).toBe("(11) 91234-5678");
  });

  it("gera link wa.me com texto codificado", () => {
    expect(whatsappLink("+5511912345678", "Olá, tudo bem?")).toBe(
      "https://wa.me/5511912345678?text=Ol%C3%A1%2C%20tudo%20bem%3F",
    );
  });
});

describe("dates", () => {
  it("exibe o instante no fuso do estabelecimento", () => {
    // 12:00 UTC = 09:00 em São Paulo (UTC-3, sem horário de verão)
    expect(formatTime("2026-11-25T12:00:00Z")).toBe("09:00");
    expect(formatTime("2026-11-25T12:00:00Z", "Europe/Lisbon")).toBe("12:00");
    expect(formatDateTime("2026-11-25T02:30:00Z")).toBe("24/11/2026 às 23:30");
  });
});
