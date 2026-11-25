import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import type { BillingDashboard } from "../queries";
import { MonthlyChart } from "./monthly-chart";

export const INSIGHT_PERIODS = [
  { value: "mes", label: "Este mês" },
  { value: "3m", label: "3 meses" },
  { value: "12m", label: "12 meses" },
] as const;

const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Indicadores do financeiro (BILLING §17): sempre separa recorrente × avulso e faturado × recebido. */
export function BillingInsights({ data, period }: { data: BillingDashboard; period: string }) {
  const kinds = data.invoiced_by_kind;
  return (
    <section className="flex flex-col gap-4" aria-label="Indicadores financeiros">
      <nav
        className="flex w-fit rounded-lg border p-0.5 text-sm"
        aria-label="Período dos indicadores"
      >
        {INSIGHT_PERIODS.map((p) => (
          <Link
            key={p.value}
            href={`/admin/financeiro?periodo=${p.value}`}
            aria-current={period === p.value ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1",
              period === p.value
                ? "bg-muted font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Receita recorrente (MRR)",
            value: formatCents(data.mrr_cents),
            hint: `ARR ${formatCents(data.arr_cents)}`,
          },
          {
            label: "Ticket médio",
            value: formatCents(data.average_ticket_cents),
            hint: `${data.counted_subscriptions} assinaturas pagantes`,
          },
          {
            label: "Faturado no período",
            value: formatCents(data.invoiced_cents),
            hint: `recorrente ${formatCents(kinds.recurring ?? 0)} · avulso ${formatCents(kinds.one_time ?? 0)}`,
          },
          {
            label: "Recebido no período",
            value: formatCents(data.received_cents),
            hint: `a receber ${formatCents(data.receivable_cents)}`,
          },
          {
            label: "Em atraso",
            value: formatCents(data.overdue_cents),
            hint: `inadimplência ${pct(data.delinquency_rate)}`,
          },
          {
            label: "Novos clientes",
            value: String(data.new_subscriptions),
            hint: "assinaturas ativadas no período",
          },
          { label: "Churn", value: pct(data.churn_rate), hint: `${data.canceled} cancelamento(s)` },
          {
            label: "Oferta de entrada",
            value: formatCents(kinds.entry_offer ?? 0),
            hint: "faturado no período",
          },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader>
              <CardDescription>{c.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums" data-testid={`insight-${c.label}`}>
                {c.value}
              </CardTitle>
              <span className="text-xs text-muted-foreground">{c.hint}</span>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Faturado × recebido (12 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyChart data={data.monthly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Por plano</CardTitle>
            <CardDescription>Assinaturas pagantes e receita recorrente.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.by_plan.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma assinatura ativa.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {data.by_plan.map((p) => (
                    <tr key={p.plan} className="border-t first:border-t-0">
                      <td className="py-1.5">{p.plan}</td>
                      <td className="py-1.5 text-right tabular-nums">{p.subscriptions}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatCents(p.mrr_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
