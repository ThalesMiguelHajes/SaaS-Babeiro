import {
  asaasPaymentEvent,
  asaasSandboxConfig,
  confirmAsaasCharge,
  verifyAsaasToken,
} from "@/modules/billing/providers/asaas";

export async function POST(request: Request) {
  const config = asaasSandboxConfig();
  if (!config) return new Response(null, { status: 404 });
  if (!verifyAsaasToken(config, request.headers.get("asaas-access-token"))) {
    return new Response(null, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = asaasPaymentEvent.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });
  if (parsed.data.event !== "PAYMENT_RECEIVED") return new Response(null, { status: 204 });

  try {
    await confirmAsaasCharge(config, parsed.data.payment.id);
  } catch {
    // Uma resposta não-2xx permite nova entrega pelo Asaas.
    console.error("Falha na confirmação da cobrança no Asaas Sandbox", parsed.data.payment.id);
    return new Response(null, { status: 503 });
  }
  return new Response(null, { status: 204 });
}
