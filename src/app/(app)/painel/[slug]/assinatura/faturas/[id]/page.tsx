import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requireMembership } from "@/lib/authz";
import { todayInTimeZone } from "@/modules/availability/rules";
import { InvoiceDocument } from "@/modules/billing/components/invoice-document";
import { ProofUpload } from "@/modules/billing/components/proof-upload";
import { getInvoice } from "@/modules/billing/queries";
import { effectiveInvoiceStatus, isPayable } from "@/modules/billing/rules";

export const metadata: Metadata = { title: "Fatura" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROOF_STATUS: Record<string, string> = {
  submitted: "Em conferência",
  accepted: "Pagamento confirmado",
  rejected: "Recusado",
};

export default async function EstablishmentInvoicePage({
  params,
}: PageProps<"/painel/[slug]/assinatura/faturas/[id]">) {
  const { slug, id } = await params;
  const { establishment } = await requireMembership(slug, ["owner", "admin"]);
  if (!UUID.test(id)) notFound();
  const invoice = await getInvoice(id);
  // RLS já impede ver faturas de outro estabelecimento; conferimos o vínculo mesmo assim.
  if (!invoice || invoice.establishment_id !== establishment.id) notFound();
  const today = todayInTimeZone("America/Sao_Paulo");
  const status = effectiveInvoiceStatus(invoice.status, invoice.due_date, today);

  return (
    <>
      <PageHeader
        title={`Fatura ${invoice.number}`}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/painel/${establishment.slug}/assinatura`}>
              <ArrowLeftIcon aria-hidden />
              Assinatura
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,360px)]">
        <InvoiceDocument invoice={invoice} today={today} />
        <div className="flex flex-col gap-4">
          {isPayable(status) && <ProofUpload slug={establishment.slug} invoiceId={invoice.id} />}
          {invoice.proofs.length > 0 && (
            <ul className="flex flex-col divide-y rounded-lg border text-sm">
              {invoice.proofs.map((p) => (
                <li key={p.id} className="px-3 py-2">
                  Comprovante de {new Date(p.created_at).toLocaleDateString("pt-BR")}:{" "}
                  <strong>{PROOF_STATUS[p.status]}</strong>
                  {p.rejection_reason && (
                    <span className="block text-muted-foreground">
                      Motivo: {p.rejection_reason}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
