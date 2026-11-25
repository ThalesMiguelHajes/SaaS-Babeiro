import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { requirePlatformAdmin } from "@/lib/authz";
import { formatPhone } from "@/lib/phone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BillingSettingsForm } from "@/modules/billing/components/billing-settings-form";
import { DunningForm } from "@/modules/billing/components/dunning-form";
import { getBillingSettings } from "@/modules/billing/queries";

export const metadata: Metadata = { title: "Configurações de cobrança" };

export default async function BillingSettingsPage() {
  await requirePlatformAdmin();
  const s = await getBillingSettings();
  return (
    <>
      <PageHeader
        title="Configurações de cobrança"
        description="Chave Pix e instruções que aparecem nas faturas. Nenhum dado bancário completo ou de cartão é guardado."
      />
      <BillingSettingsForm
        defaults={{
          pixKeyType: s?.pix_key_type ?? "",
          pixKey: s?.pix_key ?? "",
          pixReceiverName: s?.pix_receiver_name ?? "",
          instructions: s?.payment_instructions ?? "",
          supportWhatsapp: s?.support_whatsapp_e164 ? formatPhone(s.support_whatsapp_e164) : "",
          setupFee: ((s?.default_setup_fee_cents ?? 14990) / 100).toFixed(2).replace(".", ","),
        }}
      />
      <Card>
        <CardHeader>
          <CardTitle>Régua de cobrança</CardTitle>
          <CardDescription>
            Quando emitir, quando lembrar e quando considerar em atraso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DunningForm
            defaults={{
              issueDays: s?.issue_days_before_due ?? 5,
              pastDueAfter: s?.past_due_after_days ?? 1,
              graceDays: s?.grace_days ?? 10,
              autoSuspend: s?.auto_suspend_enabled ?? false,
              offsets: s?.dunning_offsets ?? [-5, -1, 0, 1, 5],
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
