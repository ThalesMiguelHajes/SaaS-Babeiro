import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";

import {
  getBillingSettings,
  getBillingStatus,
  getEntryOffer,
  getEstablishmentBilling,
  listAddOns,
  listPlans,
  listRecurringItems,
  listScheduledChanges,
} from "../queries";
import {
  SUBSCRIPTION_STATUS_LABEL,
  billingMethodLabel,
  effectiveInvoiceStatus,
  type SubscriptionStatus,
} from "../rules";
import { AssignPlanForm } from "./assign-plan-form";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { RecurringItems } from "./recurring-items";
import { SubscriptionActions } from "./subscription-actions";

const DISCOUNT_DURATION: Record<string, string> = {
  once: "uma fatura",
  repeating: "faturas",
  forever: "sempre",
};

/** Aba "Financeiro" do estabelecimento no painel do Super Admin (BILLING §18.1). */
export async function EstablishmentBillingTab({
  establishmentId,
  today,
}: {
  establishmentId: string;
  today: string;
}) {
  const [billing, plans, settings, status, addOns, entry] = await Promise.all([
    getEstablishmentBilling(establishmentId),
    listPlans(),
    getBillingSettings(),
    getBillingStatus(establishmentId),
    listAddOns(),
    getEntryOffer(establishmentId),
  ]);
  const planOptions = plans
    .filter((p) => p.current && p.is_active)
    .map((p) => ({
      versionId: p.current!.id,
      name: p.name,
      monthly: p.current!.monthly_price_cents,
      included: p.current!.included_professionals,
      extraPrice: p.current!.extra_professional_price_cents,
    }));
  const sub = billing.subscription;
  const version = sub?.subscription_plan_versions;

  if (!sub) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Atribuir plano</CardTitle>
          <CardDescription>
            Cria a assinatura e a 1ª fatura. Até o pagamento, o estabelecimento fica em implantação
            (painel liberado, página de agendamento desligada).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssignPlanForm
            establishmentId={establishmentId}
            plans={planOptions}
            offerPriceCents={
              entry.offer && !entry.alreadyUsed ? entry.offer.first_cycle_price_cents : null
            }
            defaultSetupCents={settings?.default_setup_fee_cents ?? 14990}
            activeProfessionals={status.active_professionals}
            today={today}
          />
        </CardContent>
      </Card>
    );
  }

  const [scheduled, recurringItems] = await Promise.all([
    listScheduledChanges(sub.id),
    listRecurringItems(sub.id),
  ]);
  const monthly = sub.price_override_cents ?? version?.monthly_price_cents ?? 0;
  const extras = sub.extra_professionals * (version?.extra_professional_price_cents ?? 0);
  const paid = billing.payments
    .filter((p) => p.status === "confirmed")
    .reduce((s, p) => s + p.amount_cents, 0);
  const open = billing.invoices
    .filter((i) => ["open", "partially_paid", "overdue"].includes(i.status))
    .reduce((s, i) => s + i.total_cents - i.amount_paid_cents, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Plano",
            value: version?.subscription_plans?.name ?? "—",
            hint: SUBSCRIPTION_STATUS_LABEL[sub.status as SubscriptionStatus],
          },
          {
            label: "Mensalidade",
            value: formatCents(monthly + extras),
            hint: sub.price_override_cents
              ? `negociado: ${sub.price_override_reason}`
              : "preço da versão contratada",
          },
          {
            label: "Vagas",
            value: `${status.active_professionals} de ${status.professional_limit ?? "∞"}`,
            hint: sub.extra_professionals
              ? `${sub.extra_professionals} adicionais`
              : "profissionais ativos",
          },
          {
            label: "Em aberto",
            value: formatCents(open),
            hint: `pago no total: ${formatCents(paid)}`,
          },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader>
              <CardDescription>{c.label}</CardDescription>
              <CardTitle className="text-xl tabular-nums" data-testid={`billing-${c.label}`}>
                {c.value}
              </CardTitle>
              <span className="text-xs text-muted-foreground">{c.hint}</span>
            </CardHeader>
          </Card>
        ))}
      </div>

      <SubscriptionActions
        establishmentId={establishmentId}
        subscription={{
          id: sub.id,
          status: sub.status as SubscriptionStatus,
          planVersionId: sub.plan_version_id,
          extraProfessionals: sub.extra_professionals,
          autoSuspendOverride: sub.auto_suspend_override,
          graceDaysOverride: sub.grace_days_override,
        }}
        plans={planOptions}
        addOns={addOns}
      />

      {scheduled.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {scheduled.map((c) => (
            <li
              key={c.id}
              className={c.status === "blocked" ? "text-destructive" : "text-muted-foreground"}
            >
              Mudança para {c.subscription_plan_versions?.subscription_plans?.name} em{" "}
              {c.effective_on.split("-").reverse().join("/")}:{" "}
              {
                {
                  pending: "agendada",
                  applied: "aplicada",
                  blocked: "bloqueada",
                  canceled: "substituída",
                }[c.status]
              }
              {c.result && ` — ${c.result}`}
            </li>
          ))}
        </ul>
      )}

      {sub.status !== "canceled" && (
        <Card>
          <CardHeader>
            <CardTitle>Adicionais recorrentes e cupom</CardTitle>
          </CardHeader>
          <CardContent>
            <RecurringItems
              establishmentId={establishmentId}
              subscriptionId={sub.id}
              items={recurringItems}
              addOns={addOns}
              today={today}
            />
          </CardContent>
        </Card>
      )}

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
                  href={`/admin/financeiro/faturas/${i.id}`}
                  className="flex flex-wrap items-center gap-3 py-2 hover:underline"
                >
                  <span className="w-36 font-medium">{i.number ?? "Rascunho"}</span>
                  <span className="flex-1 text-muted-foreground">
                    vence {i.due_date.split("-").reverse().join("/")}
                    {i.kind === "standalone" && " · avulsa"}
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
            <CardTitle>Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y text-sm">
              {billing.payments.length === 0 && (
                <li className="py-2 text-muted-foreground">Nenhum pagamento.</li>
              )}
              {billing.payments.map((p) => (
                <li
                  key={p.id}
                  className={
                    p.status === "reversed" ? "py-2 text-muted-foreground line-through" : "py-2"
                  }
                >
                  {formatCents(p.amount_cents)} · {billingMethodLabel(p.method)} ·{" "}
                  {p.received_on.split("-").reverse().join("/")}
                  {p.reference && ` · ${p.reference}`}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Descontos e cobranças</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {billing.discounts.map((d) => (
              <p
                key={d.id}
                className={d.revoked_at ? "text-muted-foreground line-through" : undefined}
              >
                {d.name} ·{" "}
                {d.kind === "percent"
                  ? `${d.value / 100}%`
                  : d.kind === "fixed"
                    ? formatCents(d.value)
                    : "gratuito"}{" "}
                ·{" "}
                {d.duration === "repeating"
                  ? `${d.cycles_applied}/${d.cycles_total} ${DISCOUNT_DURATION[d.duration]}`
                  : DISCOUNT_DURATION[d.duration]}{" "}
                <span className="text-muted-foreground">({d.reason})</span>
              </p>
            ))}
            {billing.charges.map((c) => (
              <p key={c.id}>
                {c.description} · {formatCents(c.quantity * c.unit_price_cents)} ·{" "}
                <span className="text-muted-foreground">
                  {
                    {
                      pending: "na próxima fatura",
                      invoiced: "faturada",
                      waived: "isenta",
                      covered_by_promotion: "coberta pela oferta",
                      canceled: "cancelada",
                    }[c.status]
                  }
                </span>
              </p>
            ))}
            {billing.discounts.length + billing.charges.length === 0 && (
              <p className="text-muted-foreground">Nada registrado.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {sub.activated_at && (
        <p className="text-xs text-muted-foreground">
          Contratado em {formatDate(sub.contracted_at)} · ativado em {formatDate(sub.activated_at)}{" "}
          · âncora dia {sub.anchor_day}
        </p>
      )}
    </div>
  );
}
