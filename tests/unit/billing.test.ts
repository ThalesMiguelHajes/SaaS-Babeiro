import { describe, expect, it } from "vitest";

import {
  billingCycleStart,
  effectiveInvoiceStatus,
  invoiceWhatsappMessage,
  modeBanner,
} from "@/modules/billing/rules";
import { assignSchema, discountSchema } from "@/modules/billing/schemas";

describe("ciclo de cobrança (espelho de private.billing_cycle_start, F21)", () => {
  it.each([
    ["2027-01-10", 10, 1, "2027-02-10"],
    ["2027-01-31", 31, 1, "2027-02-28"],
    ["2027-01-31", 31, 2, "2027-03-31"],
    ["2027-01-31", 31, 3, "2027-04-30"],
    ["2028-01-31", 31, 1, "2028-02-29"],
    ["2028-02-29", 29, 12, "2029-02-28"],
    ["2028-02-29", 29, 13, "2029-03-29"],
    ["2027-01-30", 30, 2, "2027-03-30"],
    ["2027-11-15", 15, 2, "2028-01-15"],
  ])("âncora %s (dia %i), ciclo %i → %s", (anchor, day, k, expected) => {
    expect(billingCycleStart(anchor, day, "month", k)).toBe(expected);
  });

  it("anual soma 12 meses", () => {
    expect(billingCycleStart("2028-02-29", 29, "year", 1)).toBe("2029-02-28");
  });
});

describe("regras de exibição", () => {
  it("fatura em aberto vencida aparece como vencida antes da rotina diária", () => {
    expect(effectiveInvoiceStatus("open", "2026-12-01", "2026-12-02")).toBe("overdue");
    expect(effectiveInvoiceStatus("open", "2026-12-02", "2026-12-02")).toBe("open");
    expect(effectiveInvoiceStatus("paid", "2026-12-01", "2026-12-10")).toBe("paid");
  });

  it("aviso do painel conforme o modo", () => {
    expect(modeBanner("setup", "pending_activation")?.tone).toBe("info");
    expect(modeBanner("restricted", "suspended")?.tone).toBe("danger");
    expect(modeBanner("operational", "past_due")?.tone).toBe("warning");
    expect(modeBanner("operational", "active")).toBeNull();
    expect(modeBanner("operational", null)).toBeNull();
  });

  it("mensagem de cobrança traz valor, vencimento, Pix e link", () => {
    const text = invoiceWhatsappMessage({
      establishmentName: "Barbearia",
      number: "FAT-2026-000001",
      totalLabel: "R$ 100,00",
      dueLabel: "01/12/2026",
      pixKey: "12.345.678/0001-90",
      pixReceiver: "Agenda Ltda",
      url: "https://x/fatura",
    });
    expect(text).toContain("FAT-2026-000001");
    expect(text).toContain("Pix: 12.345.678/0001-90 (Agenda Ltda)");
    expect(text).toContain("https://x/fatura");
  });
});

describe("schemas do financeiro", () => {
  const base = {
    planVersionId: "30000000-0000-4000-a000-00000000000a",
    anchorDate: "2026-12-01",
    useOffer: false,
    setupMode: "first_invoice" as const,
    setupFee: "149,90",
    priceOverride: "",
    overrideReason: "",
    extraProfessionals: 0,
    notes: "",
  };

  it("preço negociado exige motivo e vira centavos", () => {
    expect(assignSchema.safeParse({ ...base, priceOverride: "89,90" }).success).toBe(false);
    const ok = assignSchema.safeParse({
      ...base,
      priceOverride: "89,90",
      overrideReason: "Parceria",
    });
    expect(ok.success && ok.data.priceOverride).toBe(8990);
    expect(ok.success && ok.data.setupFee).toBe(14990);
  });

  it("desconto percentual em pontos-base e ciclos só quando repete", () => {
    const pct = discountSchema.parse({
      name: "Boas-vindas",
      kind: "percent",
      percent: 10,
      amount: "",
      duration: "repeating",
      cycles: 3,
      reason: "Indicação",
    });
    expect(pct.value).toBe(1000);
    expect(pct.cycles).toBe(3);
    const once = discountSchema.parse({
      ...pct,
      kind: "fixed",
      amount: "15,00",
      duration: "once",
      cycles: null,
      percent: 0,
    });
    expect(once.value).toBe(1500);
    expect(once.cycles).toBeNull();
  });
});

describe("régua de cobrança", () => {
  it("rótulo da etapa", async () => {
    const { dunningStageLabel } = await import("@/modules/billing/rules");
    expect(dunningStageLabel(-5)).toBe("Vence em 5 dias");
    expect(dunningStageLabel(-1)).toBe("Vence em 1 dia");
    expect(dunningStageLabel(0)).toBe("Vence hoje");
    expect(dunningStageLabel(3)).toBe("Vencida há 3 dias");
  });

  it("aviso de vencimento no painel do estabelecimento", async () => {
    const { invoiceDueBanner } = await import("@/modules/billing/rules");
    const inv = (due: string) => ({ due_date: due, status: "open" });
    expect(invoiceDueBanner(null, "2026-12-01")).toBeNull();
    expect(invoiceDueBanner(inv("2026-12-20"), "2026-12-01")).toBeNull();
    expect(invoiceDueBanner(inv("2026-12-04"), "2026-12-01")?.text).toBe(
      "Sua fatura vence em 3 dias.",
    );
    expect(invoiceDueBanner(inv("2026-12-01"), "2026-12-01")?.text).toBe("Sua fatura vence hoje.");
    expect(invoiceDueBanner(inv("2026-11-29"), "2026-12-01")).toEqual({
      tone: "warning",
      text: "Sua fatura venceu há 2 dias.",
    });
  });
});
