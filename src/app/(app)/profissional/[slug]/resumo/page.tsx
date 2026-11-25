import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { requireProfessional } from "@/lib/authz";
import { todayInTimeZone } from "@/modules/availability/rules";
import { DashboardSummary } from "@/modules/dashboards/components/dashboard-summary";
import { getDashboard } from "@/modules/dashboards/queries";
import { periodRange } from "@/modules/dashboards/rules";

export const metadata: Metadata = { title: "Meu resumo" };

export default async function ProfessionalSummaryPage({
  params,
  searchParams,
}: PageProps<"/profissional/[slug]/resumo">) {
  const { slug } = await params;
  const { periodo } = await searchParams;
  const { establishment } = await requireProfessional(slug);
  const range = periodRange(
    typeof periodo === "string" ? periodo : undefined,
    todayInTimeZone(establishment.timezone),
  );
  const data = await getDashboard(establishment.id, range.from, range.to);

  return (
    <>
      <PageHeader title="Meu resumo" description="Seus atendimentos e valores no período." />
      <DashboardSummary
        data={data}
        period={range.period}
        basePath={`/profissional/${establishment.slug}/resumo`}
        showProfessionals={false}
      />
    </>
  );
}
