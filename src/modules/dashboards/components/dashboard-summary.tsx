import { TriangleAlertIcon } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { paymentMethodLabel } from "@/modules/appointments/rules";

import type { Dashboard } from "../queries";
import { PERIODS, type Period } from "../rules";

/** Indicadores: Previsto, Realizado e Recebido + caixa por forma de pagamento e por profissional. */
export function DashboardSummary({
  data,
  period,
  basePath,
  showProfessionals,
}: {
  data: Dashboard;
  period: Period;
  basePath: string;
  showProfessionals: boolean;
}) {
  const methods = Object.entries(data.by_method).sort((a, b) => b[1] - a[1]);
  return (
    <section className="flex flex-col gap-4" aria-label="Indicadores">
      <nav className="flex w-fit rounded-lg border p-0.5 text-sm" aria-label="Período">
        {PERIODS.map((p) => (
          <Link
            key={p.value}
            href={`${basePath}?periodo=${p.value}`}
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
            label: "Previsto",
            value: formatCents(data.expected_cents),
            hint: "agendamentos não cancelados",
          },
          {
            label: "Realizado",
            value: formatCents(data.realized_cents),
            hint: "valor cobrado dos concluídos",
          },
          {
            label: "Recebido",
            value: formatCents(data.received_cents),
            hint: "pagamentos registrados",
          },
          {
            label: "Atendimentos",
            value: String(data.appointments),
            hint: `${data.by_status.completed ?? 0} concluídos`,
          },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader>
              <CardDescription>{c.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums" data-testid={`kpi-${c.label}`}>
                {c.value}
              </CardTitle>
              <span className="text-xs text-muted-foreground">{c.hint}</span>
            </CardHeader>
          </Card>
        ))}
      </div>

      {data.completed_without_payment > 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">
          <TriangleAlertIcon className="size-4 text-amber-600" aria-hidden />
          {data.completed_without_payment === 1
            ? "1 atendimento concluído sem pagamento registrado."
            : `${data.completed_without_payment} atendimentos concluídos sem pagamento registrado.`}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Caixa por forma de pagamento</CardTitle>
            <CardDescription>Recebimentos registrados no período.</CardDescription>
          </CardHeader>
          <CardContent>
            {methods.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum recebimento registrado.</p>
            ) : (
              <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
                {methods.map(([m, cents]) => (
                  <div key={m} className="contents">
                    <dt>{paymentMethodLabel(m)}</dt>
                    <dd className="text-right font-medium tabular-nums">{formatCents(cents)}</dd>
                  </div>
                ))}
                <dt className="border-t pt-1.5 font-medium">Total</dt>
                <dd className="border-t pt-1.5 text-right font-semibold tabular-nums">
                  {formatCents(data.received_cents)}
                </dd>
              </dl>
            )}
          </CardContent>
        </Card>
        {showProfessionals && (
          <Card>
            <CardHeader>
              <CardTitle>Por profissional</CardTitle>
              <CardDescription>Atendimentos, realizado e recebido no período.</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="pb-1.5 font-normal">Profissional</th>
                    <th className="pb-1.5 text-right font-normal">Atend.</th>
                    <th className="pb-1.5 text-right font-normal">Realizado</th>
                    <th className="pb-1.5 text-right font-normal">Recebido</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_professional.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="py-1.5">{p.display_name}</td>
                      <td className="py-1.5 text-right tabular-nums">{p.appointments}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatCents(p.realized_cents)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatCents(p.received_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
