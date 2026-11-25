import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMembership } from "@/lib/authz";
import { todayInTimeZone } from "@/modules/availability/rules";
import { DashboardSummary } from "@/modules/dashboards/components/dashboard-summary";
import { getDashboard } from "@/modules/dashboards/queries";
import { periodRange } from "@/modules/dashboards/rules";
import { getSetupStatus } from "@/modules/establishments/queries";
import { ConflictsList } from "@/modules/schedules/components/conflicts-list";
import { getScheduleConflicts } from "@/modules/schedules/queries";

export const metadata: Metadata = { title: "Visão geral" };

export default async function EstablishmentHomePage({
  params,
  searchParams,
}: PageProps<"/painel/[slug]">) {
  const { slug } = await params;
  const { periodo } = await searchParams;
  const { establishment } = await requireMembership(slug, ["owner", "admin"]);
  const range = periodRange(
    typeof periodo === "string" ? periodo : undefined,
    todayInTimeZone(establishment.timezone),
  );
  const [status, conflicts, dashboard] = await Promise.all([
    getSetupStatus(establishment.id),
    getScheduleConflicts(establishment.id),
    getDashboard(establishment.id, range.from, range.to),
  ]);
  const base = `/painel/${establishment.slug}`;

  const steps = [
    {
      done: status.hasHours,
      label: "Definir o horário de funcionamento",
      href: `${base}/horarios`,
    },
    {
      done: status.professionals > 0,
      label: "Cadastrar os profissionais",
      href: `${base}/profissionais/novo`,
    },
    {
      done: status.services > 0,
      label: "Cadastrar os serviços com preço e duração",
      href: `${base}/servicos/novo`,
    },
    {
      done: status.serviceLinks > 0,
      label: "Definir quais profissionais fazem cada serviço",
      href: `${base}/servicos`,
    },
    {
      done: status.hasProfile,
      label: "Preencher descrição e WhatsApp da página pública",
      href: `${base}/pagina-publica`,
    },
    { done: status.hasLogo, label: "Enviar a logo", href: `${base}/pagina-publica` },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <>
      <PageHeader title="Visão geral" description={`Resumo de ${establishment.name}.`} />
      <ConflictsList conflicts={conflicts} timeZone={establishment.timezone} />

      <DashboardSummary
        data={dashboard}
        period={range.period}
        basePath={base}
        showProfessionals={status.professionals > 1}
      />

      {doneCount < steps.length && (
        <Card>
          <CardHeader>
            <CardTitle>Primeiros passos</CardTitle>
            <CardDescription>
              {doneCount} de {steps.length} concluídos. A agenda e a página de agendamento usam
              estas informações.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col divide-y">
              {steps.map((s) => (
                <li key={s.label}>
                  <Link
                    href={s.href}
                    className="flex items-center gap-3 py-3 text-sm hover:underline"
                  >
                    {s.done ? (
                      <CheckCircle2Icon
                        className="size-5 shrink-0 text-green-600"
                        aria-label="Concluído"
                      />
                    ) : (
                      <CircleIcon
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-label="Pendente"
                      />
                    )}
                    <span className={s.done ? "text-muted-foreground line-through" : undefined}>
                      {s.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </>
  );
}
