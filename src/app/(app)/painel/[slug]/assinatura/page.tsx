import { ReceiptIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMembership } from "@/lib/authz";
import { formatCents } from "@/lib/money";
import { todayInTimeZone } from "@/modules/availability/rules";
import { InvoiceStatusBadge } from "@/modules/billing/components/invoice-status-badge";
import { RequestForm } from "@/modules/billing/components/request-form";
import { getBillingStatus, getEstablishmentBilling } from "@/modules/billing/queries";
import {
  SUBSCRIPTION_STATUS_LABEL,
  effectiveInvoiceStatus,
  type SubscriptionStatus,
} from "@/modules/billing/rules";

export const metadata: Metadata = { title: "Assinatura" };

const REQUEST_STATUS: Record<string, string> = {
  open: "Em análise",
  done: "Concluída",
  dismissed: "Encerrada",
};

/** Área de assinatura do estabelecimento (somente owner/admin; BILLING §18.2). */
export default async function SubscriptionPage({ params }: PageProps<"/painel/[slug]/assinatura">) {
  const { slug } = await params;
  const { establishment } = await requireMembership(slug, ["owner", "admin"]);
  const today = todayInTimeZone("America/Sao_Paulo");
  const [billing, status] = await Promise.all([
    getEstablishmentBilling(establishment.id),
    getBillingStatus(establishment.id),
  ]);
  const base = `/painel/${establishment.slug}/assinatura`;
  const sub = billing.subscription;

  if (!sub) {
    return (
      <>
        <PageHeader title="Assinatura" />
        <EmptyState
          icon={ReceiptIcon}
          title="Nenhuma assinatura ativa"
          description="Fale com a nossa equipe para contratar um plano."
        />
      </>
    );
  }

  const version = sub.subscription_plan_versions;
  const monthly =
    (sub.price_override_cents ?? version?.monthly_price_cents ?? 0) +
    sub.extra_professionals * (version?.extra_professional_price_cents ?? 0);

  return (
    <>
      <PageHeader title="Assinatura" description="Plano, faturas e pagamentos." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Plano</CardDescription>
            <CardTitle className="text-xl">{version?.subscription_plans?.name}</CardTitle>
            <span className="text-xs text-muted-foreground">
              {SUBSCRIPTION_STATUS_LABEL[sub.status as SubscriptionStatus]}
            </span>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Mensalidade</CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatCents(monthly)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Profissionais</CardDescription>
            <CardTitle className="text-xl tabular-nums" data-testid="seat-usage">
              {status.active_professionals} de {status.professional_limit ?? "∞"} vagas
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Faturas</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y text-sm">
            {billing.invoices.length === 0 && (
              <li className="py-2 text-muted-foreground">Nenhuma fatura.</li>
            )}
            {billing.invoices.map((i) => (
              <li key={i.id}>
                <Link
                  href={`${base}/faturas/${i.id}`}
                  className="flex flex-wrap items-center gap-3 py-2 hover:underline"
                >
                  <span className="w-36 font-medium">{i.number}</span>
                  <span className="flex-1 text-muted-foreground">
                    vence {i.due_date.split("-").reverse().join("/")}
                  </span>
                  <span className="tabular-nums">{formatCents(i.total_cents)}</span>
                  <InvoiceStatusBadge
                    status={effectiveInvoiceStatus(i.status, i.due_date, today)}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Solicitar mudança</CardTitle>
            <CardDescription>
              Plano, vagas, serviços adicionais ou cancelamento. Nossa equipe responde por aqui e
              pelo WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RequestForm slug={establishment.slug} />
          </CardContent>
        </Card>
        {billing.requests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Suas solicitações</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col divide-y text-sm">
                {billing.requests.map((r) => (
                  <li key={r.id} className="py-2">
                    <span className="font-medium">{REQUEST_STATUS[r.status]}</span> · {r.message}
                    {r.response && (
                      <span className="block text-muted-foreground">Resposta: {r.response}</span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
