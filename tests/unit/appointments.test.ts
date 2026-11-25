import { describe, expect, it } from "vitest";

import {
  availableActions,
  canTransition,
  gridRange,
  paymentBalance,
  paymentMethodLabel,
} from "@/modules/appointments/rules";
import { completeSchema } from "@/modules/appointments/schemas";
import { periodRange } from "@/modules/dashboards/rules";

const now = new Date("2026-12-01T13:00:00Z");

describe("máquina de status (espelho do banco)", () => {
  it("transições permitidas", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "completed")).toBe(false);
    expect(canTransition("in_progress", "completed")).toBe(true);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
  });

  it("ações conforme o horário", () => {
    expect(availableActions("confirmed", "2026-12-01T15:00:00Z", now)).toEqual([
      "reschedule",
      "cancel",
    ]);
    // 10 min antes: já pode iniciar/concluir, mas ainda não marcar falta
    expect(availableActions("confirmed", "2026-12-01T13:10:00Z", now)).toEqual([
      "complete",
      "start",
      "reschedule",
      "cancel",
    ]);
    expect(availableActions("confirmed", "2026-12-01T12:30:00Z", now)).toContain("no_show");
    expect(availableActions("pending", "2026-12-01T15:00:00Z", now)).toEqual([
      "confirm",
      "reschedule",
      "cancel",
    ]);
    expect(availableActions("completed", "2026-12-01T12:00:00Z", now)).toEqual(["record_payment"]);
    expect(availableActions("completed", "2026-12-01T12:00:00Z", now, false)).toEqual([]);
    expect(availableActions("cancelled", "2026-12-01T15:00:00Z", now)).toEqual([]);
  });
});

describe("recebimentos", () => {
  it("saldo pendente e excedente (gorjeta)", () => {
    expect(paymentBalance(5000, 3000)).toEqual({ paid: 3000, pending: 2000, extra: 0 });
    expect(paymentBalance(5000, 5500)).toEqual({ paid: 5500, pending: 0, extra: 500 });
    expect(paymentMethodLabel("debit_card")).toBe("Débito");
  });

  it("valores em reais viram centavos e pagamento zero é recusado", () => {
    const ok = completeSchema.safeParse({
      finalPrice: "40,00",
      payments: [{ amount: "25,50", method: "pix", notes: "" }],
    });
    expect(ok.success && ok.data.finalPrice).toBe(4000);
    expect(ok.success && ok.data.payments[0]?.amount).toBe(2550);
    expect(
      completeSchema.safeParse({
        finalPrice: "40",
        payments: [{ amount: "0", method: "pix", notes: "" }],
      }).success,
    ).toBe(false);
    expect(
      completeSchema.safeParse({
        finalPrice: "40",
        payments: [{ amount: "10", method: "cheque", notes: "" }],
      }).success,
    ).toBe(false);
  });
});

describe("grade da agenda e períodos", () => {
  it("faixa visível arredondada para horas cheias", () => {
    expect(gridRange([])).toEqual({ start: 480, end: 1200 });
    expect(gridRange([{ start: 9 * 60 + 15, end: 18 * 60 + 30 }])).toEqual({
      start: 540,
      end: 1140,
    });
  });

  it("períodos do painel", () => {
    expect(periodRange(undefined, "2026-12-15")).toEqual({
      period: "hoje",
      from: "2026-12-15",
      to: "2026-12-15",
    });
    expect(periodRange("7d", "2026-12-15")).toEqual({
      period: "7d",
      from: "2026-12-09",
      to: "2026-12-15",
    });
    expect(periodRange("mes", "2026-12-15")).toEqual({
      period: "mes",
      from: "2026-12-01",
      to: "2026-12-15",
    });
  });
});
