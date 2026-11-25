import { CalendarDaysIcon } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireMembership } from "@/lib/authz";

export const metadata: Metadata = { title: "Visão geral" };

export default async function EstablishmentHomePage({ params }: PageProps<"/painel/[slug]">) {
  const { slug } = await params;
  const { establishment } = await requireMembership(slug, ["owner", "admin"]);

  return (
    <>
      <PageHeader title="Visão geral" description={`Resumo de ${establishment.name}.`} />
      <EmptyState
        icon={CalendarDaysIcon}
        title="Nenhum agendamento ainda"
        description="Equipe, serviços, horários e agenda serão configurados nas próximas etapas."
      />
    </>
  );
}
