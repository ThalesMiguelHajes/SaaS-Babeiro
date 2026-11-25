import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/authz";
import { formatCents } from "@/lib/money";
import { todayInTimeZone } from "@/modules/availability/rules";
import { InvoiceStatusBadge } from "@/modules/billing/components/invoice-status-badge";
import { BillingInsights } from "@/modules/billing/components/billing-insights";
import { CollectionsList } from "@/modules/billing/components/collections-list";
import { ProofReview } from "@/modules/billing/components/proof-review";
import { RunBillingButton } from "@/modules/billing/components/run-billing-button";
import { ResolveRequest } from "@/modules/billing/components/resolve-request";
import { publicEnv } from "@/lib/env";
import {
  getBillingDashboard,
  getBillingOverview,
  listCollectionsToday,
  listInvoices,
  listJobRuns,
  listOpenRequests,
  listPendingProofs,
} from "@/modules/billing/queries";
import {
  SUBSCRIPTION_STATUS_LABEL,
  effectiveInvoiceStatus,
  type SubscriptionStatus,
} from "@/modules/billing/rules";

export const metadata: Metadata = { title: "Financeiro" };

const REQUEST_KIND: Record<string, string> = {
  change_plan: "Mudar de plano",
  extra_professionals: "Mais vagas",
  add_on: "Serviço adicional",
  cancel: "Cancelamento",
  support: "Suporte",
};

function insightRange(period: string | undefined, today: string) {
  const d = new Date(`${today}T12:00:00Z`);
  if (period === "12m") d.setUTCMonth(d.getUTCMonth() - 11);
  else if (period === "3m") d.setUTCMonth(d.getUTCMonth() - 2);
  return {
    period: period === "12m" || period === "3m" ? period : "mes",
    from: `${d.toISOString().slice(0, 7)}-01`,
    to: today,
  };
}

export default async function BillingHomePage({ searchParams }: PageProps<"/admin/financeiro">) {
  await requirePlatformAdmin();
  const today = todayInTimeZone("America/Sao_Paulo");
  const { periodo } = await searchParams;
  const range = insightRange(typeof periodo === "string" ? periodo : undefined, today);
  const [overview, dashboard, proofs, requests, invoices, collections, runs] = await Promise.all([
    getBillingOverview(),
    getBillingDashboard(range.from, range.to),
    listPendingProofs(),
    listOpenRequests(),
    listInvoices({ openOnly: true }),
    listCollectionsToday(),
    listJobRuns(3),
  ]);
  const lastRun = runs[0];

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Assinaturas, faturas e pagamentos dos estabelecimentos. Cobrança manual por Pix."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/financeiro/listas">Assinaturas, faturas e pagamentos</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/financeiro/cupons">Cupons</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/financeiro/planos">Planos e preços</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/financeiro/configuracoes">Configurações de cobrança</Link>
            </Button>
          </>
        }
      />

      <BillingInsights data={dashboard} period={range.period} />

      <p className="text-sm text-muted-foreground">
        Assinaturas:{" "}
        {Object.entries(overview.subscriptions)
          .map(([s, n]) => `${SUBSCRIPTION_STATUS_LABEL[s as SubscriptionStatus]} ${n}`)
          .join(" · ") || "nenhuma"}
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Cobranças do dia</CardTitle>
          <CardDescription>
            Lembretes da régua prontos para enviar. Ao clicar em &quot;Enviar pelo WhatsApp&quot;, o
            envio fica registrado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CollectionsList items={collections} appUrl={publicEnv.NEXT_PUBLIC_APP_URL} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Rotina de cobrança</CardTitle>
            <CardDescription>
              Roda sozinha às 06:15 e às 18:15: gera as faturas 5 dias antes do vencimento, marca
              atrasos, prepara os lembretes e suspende só se a suspensão automática estiver ligada.
            </CardDescription>
          </div>
          <RunBillingButton />
        </CardHeader>
        <CardContent className="text-sm">
          {lastRun ? (
            <p data-testid="last-run">
              Última execução:{" "}
              {new Date(lastRun.started_at).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
              {" · "}
              {
                {
                  ok: "concluída",
                  partial: "com erros",
                  skipped: "ignorada (outra em andamento)",
                  running: "em andamento",
                  failed: "falhou",
                }[lastRun.status]
              }
              {" · "}
              {lastRun.invoices_created} fatura(s), {lastRun.notifications_created} lembrete(s),{" "}
              {lastRun.status_changes} mudança(s) de situação
              {Array.isArray(lastRun.errors) && lastRun.errors.length > 0 && (
                <span className="block text-destructive">
                  {lastRun.errors.length} erro(s) — confira as assinaturas afetadas.
                </span>
              )}
            </p>
          ) : (
            <p className="text-muted-foreground">Ainda não executada.</p>
          )}
        </CardContent>
      </Card>

      {proofs.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader>
            <CardTitle>Comprovantes para conferir</CardTitle>
            <CardDescription>
              O envio não confirma o pagamento: confira no extrato antes de aceitar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y text-sm">
              {proofs.map((p) => (
                <li key={p.id} className="flex flex-col gap-2 py-3">
                  <Link
                    href={`/admin/financeiro/faturas/${p.invoice_id}`}
                    className="font-medium hover:underline"
                  >
                    Fatura {p.invoices?.number} · {formatCents(p.invoices?.total_cents ?? 0)}
                  </Link>
                  <ProofReview
                    proofId={p.id}
                    balanceCents={Math.max(
                      (p.invoices?.total_cents ?? 0) - (p.invoices?.amount_paid_cents ?? 0),
                      0,
                    )}
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Solicitações dos estabelecimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y text-sm">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                  <span>
                    <Link
                      href={`/admin/estabelecimentos/${r.establishment_id}`}
                      className="font-medium hover:underline"
                    >
                      {r.establishments?.name}
                    </Link>{" "}
                    · {REQUEST_KIND[r.kind]}
                    <span className="block text-muted-foreground">{r.message}</span>
                  </span>
                  <ResolveRequest requestId={r.id} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Faturas em aberto</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma fatura em aberto.</p>
          ) : (
            <ul className="flex flex-col divide-y text-sm">
              {invoices.map((i) => (
                <li key={i.id}>
                  <Link
                    href={`/admin/financeiro/faturas/${i.id}`}
                    className="flex flex-wrap items-center gap-3 py-2 hover:underline"
                  >
                    <span className="w-36 font-medium">{i.number}</span>
                    <span className="flex-1">{i.establishments?.name}</span>
                    <span className="text-muted-foreground">
                      vence {i.due_date.split("-").reverse().join("/")}
                    </span>
                    <span className="tabular-nums">
                      {formatCents(i.total_cents - i.amount_paid_cents)}
                    </span>
                    <InvoiceStatusBadge
                      status={effectiveInvoiceStatus(i.status, i.due_date, today)}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
