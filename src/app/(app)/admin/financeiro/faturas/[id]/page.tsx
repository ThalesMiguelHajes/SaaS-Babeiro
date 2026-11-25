import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requirePlatformAdmin } from "@/lib/authz";
import { publicEnv } from "@/lib/env";
import { formatCents } from "@/lib/money";
import { todayInTimeZone } from "@/modules/availability/rules";
import { InvoiceAdminActions } from "@/modules/billing/components/invoice-admin-actions";
import { InvoiceDocument } from "@/modules/billing/components/invoice-document";
import { ProofReview } from "@/modules/billing/components/proof-review";
import { getInvoice } from "@/modules/billing/queries";
import { effectiveInvoiceStatus, invoiceWhatsappMessage } from "@/modules/billing/rules";
import { getEstablishment } from "@/modules/platform/queries";

export const metadata: Metadata = { title: "Fatura" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminInvoicePage({
  params,
}: PageProps<"/admin/financeiro/faturas/[id]">) {
  await requirePlatformAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  const establishment = await getEstablishment(invoice.establishment_id);
  const today = todayInTimeZone("America/Sao_Paulo");
  const instr = (invoice.payment_instructions ?? {}) as {
    pix_key?: string;
    pix_receiver_name?: string;
  };
  const slug = invoice.establishments?.slug ?? "";

  return (
    <>
      <PageHeader
        title={`Fatura ${invoice.number ?? "(rascunho)"}`}
        description={invoice.establishments?.name}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/admin/estabelecimentos/${invoice.establishment_id}`}>
              <ArrowLeftIcon aria-hidden />
              Estabelecimento
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,420px)]">
        <InvoiceDocument invoice={invoice} today={today} />
        <div className="flex flex-col gap-6">
          {invoice.proofs
            .filter((p) => p.status === "submitted")
            .map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-2 rounded-lg border border-amber-500/50 p-3 text-sm"
              >
                <span className="font-medium">Comprovante enviado pelo estabelecimento</span>
                <ProofReview
                  proofId={p.id}
                  balanceCents={Math.max(invoice.total_cents - invoice.amount_paid_cents, 0)}
                />
              </div>
            ))}
          <InvoiceAdminActions
            invoice={{
              ...invoice,
              status: effectiveInvoiceStatus(invoice.status, invoice.due_date, today),
            }}
            allocations={invoice.allocations}
            ownerWhatsapp={establishment?.whatsapp_e164 ?? null}
            whatsappText={invoiceWhatsappMessage({
              establishmentName: invoice.establishments?.name ?? "",
              number: invoice.number,
              totalLabel: formatCents(Math.max(invoice.total_cents - invoice.amount_paid_cents, 0)),
              dueLabel: invoice.due_date.split("-").reverse().join("/"),
              pixKey: instr.pix_key ?? null,
              pixReceiver: instr.pix_receiver_name ?? null,
              url: `${publicEnv.NEXT_PUBLIC_APP_URL}/painel/${slug}/assinatura/faturas/${invoice.id}`,
            })}
            today={today}
          />
        </div>
      </div>
    </>
  );
}
