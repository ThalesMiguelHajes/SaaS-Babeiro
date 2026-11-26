import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/webhooks/asaas/route";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
vi.mock("@/lib/env", () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" },
}));

const token = "sandbox-token-long-enough-for-test";
const invoiceId = "0b69fd32-ee6e-4130-95f8-169eb6eda7b7";

function notification(authToken = token, event = "PAYMENT_RECEIVED") {
  return new Request("http://localhost/api/webhooks/asaas", {
    method: "POST",
    headers: { "asaas-access-token": authToken },
    body: JSON.stringify({ event, payment: { id: "pay_test", value: 1 } }),
  });
}

describe("webhook do Asaas Sandbox", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ error: null });
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("ASAAS_SANDBOX_API_KEY", "fake-test-key");
    vi.stubEnv("ASAAS_SANDBOX_WEBHOOK_TOKEN", token);
    vi.stubEnv("ASAAS_SANDBOX_CUSTOMER_ID", "cus_test");
    vi.stubEnv("ASAAS_SANDBOX_SUPABASE_URL", "http://127.0.0.1:54321");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("bloqueia a integração na Vercel de produção", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect((await POST(notification())).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("recusa um token diferente", async () => {
    expect((await POST(notification("wrong"))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("ignora eventos de atualização sem recebimento", async () => {
    expect((await POST(notification(token, "PAYMENT_UPDATED"))).status).toBe(204);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("usa o valor confirmado pela API e a referência da fatura para dar baixa", async () => {
    const fetchCharge = vi.fn().mockResolvedValue(
      Response.json({
        id: "pay_test",
        status: "RECEIVED",
        billingType: "PIX",
        customer: "cus_test",
        externalReference: invoiceId,
        value: 99.9,
      }),
    );
    vi.stubGlobal("fetch", fetchCharge);
    expect((await POST(notification())).status).toBe(204);
    expect(fetchCharge).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/payments/pay_test",
      expect.objectContaining({ method: "GET" }),
    );
    expect(rpc).toHaveBeenCalledWith("billing_confirm_asaas_sandbox_payment", {
      p_invoice_id: invoiceId,
      p_charge_id: "pay_test",
      p_amount_cents: 9990,
    });
  });
});
