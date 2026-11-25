import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/authz";
import { formatCents } from "@/lib/money";
import { PlanVersionForm } from "@/modules/billing/components/plan-version-form";
import { listPlans } from "@/modules/billing/queries";

export const metadata: Metadata = { title: "Planos e preços" };

export default async function PlansPage() {
  await requirePlatformAdmin();
  const plans = await listPlans();
  return (
    <>
      <PageHeader
        title="Planos e preços"
        description="Mudar um preço cria uma nova versão. Quem já assinou continua com o preço contratado."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <CardDescription>
                {p.current
                  ? `${formatCents(p.current.monthly_price_cents)}/mês · ${p.current.included_professionals} profissional(is)` +
                    (p.current.extra_professional_price_cents !== null
                      ? ` · vaga extra ${formatCents(p.current.extra_professional_price_cents)}`
                      : "")
                  : "Sem versão vigente"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {p.current && (
                <PlanVersionForm
                  planId={p.id}
                  current={{
                    monthly: p.current.monthly_price_cents,
                    annual: p.current.annual_price_cents,
                    included: p.current.included_professionals,
                    extra: p.current.extra_professional_price_cents,
                  }}
                />
              )}
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">
                  Histórico de versões ({p.versions.length})
                </summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {p.versions.map((v) => (
                    <li key={v.id}>
                      v{v.version}: {formatCents(v.monthly_price_cents)} ·{" "}
                      {v.included_professionals} prof.
                      {v.is_current && " (vigente)"}
                    </li>
                  ))}
                </ul>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
