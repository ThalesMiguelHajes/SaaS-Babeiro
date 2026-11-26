import "server-only";

import { timingSafeEqual, createHash } from "node:crypto";

import { z } from "zod";

import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const configSchema = z.object({
  apiKey: z.string().min(1),
  webhookToken: z.string().min(32),
  customerId: z.string().regex(/^cus_[a-zA-Z0-9]+$/),
  supabaseUrl: z.url(),
});

export function asaasSandboxConfig() {
  if (process.env.VERCEL_ENV === "production") return null;
  const parsed = configSchema.safeParse({
    apiKey: process.env.ASAAS_SANDBOX_API_KEY,
    webhookToken: process.env.ASAAS_SANDBOX_WEBHOOK_TOKEN,
    customerId: process.env.ASAAS_SANDBOX_CUSTOMER_ID,
    supabaseUrl: process.env.ASAAS_SANDBOX_SUPABASE_URL,
  });
  if (!parsed.success) return null;

  const database = new URL(publicEnv.NEXT_PUBLIC_SUPABASE_URL).origin;
  // Projeto hospedado usado pelo site em produção.
  if (database === "https://yzgmckzktgscnwmuwdkf.supabase.co") return null;

  return database === new URL(parsed.data.supabaseUrl).origin ? parsed.data : null;
}

type Config = NonNullable<ReturnType<typeof asaasSandboxConfig>>;

const chargeId = z.string().regex(/^pay_[a-zA-Z0-9]+$/);
const charge = z.object({
  id: chargeId,
  status: z.string(),
  billingType: z.literal("PIX"),
  customer: z.string(),
  externalReference: z.uuid(),
  value: z.number().positive(),
});

const pixQrCode = z.object({
  encodedImage: z.base64().max(250_000),
  payload: z.string().min(1).max(2048),
});

export const asaasPaymentEvent = z.object({
  event: z.string(),
  payment: z.object({ id: chargeId }),
});

export class AsaasRequestError extends Error {
  constructor(readonly status: number) {
    super(`Asaas Sandbox HTTP ${status}`);
  }
}

async function asaasRequest<T>(
  config: Config,
  path: string,
  schema: z.ZodType<T>,
  body?: object,
): Promise<T> {
  const response = await fetch(`https://api-sandbox.asaas.com/v3${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      access_token: config.apiKey,
      "Content-Type": "application/json",
      "User-Agent": "Saas-Babeiro-Sandbox",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) throw new AsaasRequestError(response.status);
  return schema.parse(await response.json());
}

export function verifyAsaasToken(config: Config, suppliedToken: string | null) {
  if (!suppliedToken) return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(config.webhookToken), hash(suppliedToken));
}

function toCents(value: number) {
  return Math.round(value * 100);
}

async function confirmPayment(config: Config, payment: z.infer<typeof charge>) {
  if (payment.status !== "RECEIVED" || payment.customer !== config.customerId) return;
  const { error } = await createAdminClient().rpc("billing_confirm_asaas_sandbox_payment", {
    p_invoice_id: payment.externalReference,
    p_charge_id: payment.id,
    p_amount_cents: toCents(payment.value),
  });
  if (error) throw error;
}

export async function confirmAsaasCharge(config: Config, id: string) {
  // A notificação inicia a conferência. Estado, referência e valor vêm da API do Asaas.
  const payment = await asaasRequest(config, `/payments/${id}`, charge);
  if (payment.id !== id || payment.customer !== config.customerId) return;
  if (payment.status === "PENDING" || payment.status === "OVERDUE") {
    throw new Error("A confirmação ainda não está disponível na API do Asaas.");
  }
  await confirmPayment(config, payment);
}

export async function getAsaasPix(
  config: Config,
  invoice: { id: string; establishmentId: string; amountCents: number; dueDate: string },
) {
  const { data: reserved, error } = await createAdminClient().rpc(
    "billing_reserve_asaas_sandbox_charge",
    {
      p_invoice_id: invoice.id,
      p_establishment_id: invoice.establishmentId,
      p_amount_cents: invoice.amountCents,
    },
  );
  if (error) throw error;

  const params = new URLSearchParams({
    customer: config.customerId,
    externalReference: invoice.id,
    billingType: "PIX",
  });
  const payment = reserved
    ? await asaasRequest(config, "/payments", charge, {
        customer: config.customerId,
        externalReference: invoice.id,
        billingType: "PIX",
        value: invoice.amountCents / 100,
        dueDate: invoice.dueDate,
        description: "Fatura de teste do Agenda",
      })
    : (await asaasRequest(config, `/payments?${params}`, z.object({ data: z.array(charge) })))
        .data[0];

  if (payment?.externalReference !== invoice.id || payment.customer !== config.customerId) {
    return { status: "unavailable" } as const;
  }
  if (payment.status === "RECEIVED") {
    await confirmPayment(config, payment);
    return { status: "received" } as const;
  }
  if (payment.status !== "PENDING" && payment.status !== "OVERDUE") {
    return { status: "unavailable" } as const;
  }
  if (toCents(payment.value) !== invoice.amountCents) {
    return { status: "unavailable" } as const;
  }
  const pix = await asaasRequest(config, `/payments/${payment.id}/pixQrCode`, pixQrCode);
  return { status: "ready", ...pix } as const;
}
