import { CalendarDaysIcon } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireMembership } from "@/lib/authz";
import { AgendaView } from "@/modules/appointments/components/agenda-view";

export const metadata: Metadata = { title: "Minha agenda" };

export default async function ProfessionalHomePage({
  params,
  searchParams,
}: PageProps<"/profissional/[slug]">) {
  const { slug } = await params;
  const { user, establishment, professionalId } = await requireMembership(slug);

  if (!professionalId) {
    return (
      <>
        <PageHeader title={`Olá, ${user.fullName.split(" ")[0]}`} />
        <EmptyState
          icon={CalendarDaysIcon}
          title="Sua conta ainda não está ligada a um perfil de profissional"
          description="Peça à administração para vincular seu acesso na página do profissional."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Minha agenda"
        description={`Olá, ${user.fullName.split(" ")[0]}! Seus atendimentos do dia.`}
      />
      <AgendaView
        basePath={`/profissional/${establishment.slug}`}
        slug={establishment.slug}
        establishmentId={establishment.id}
        timeZone={establishment.timezone}
        isAdmin={false}
        ownProfessionalId={professionalId}
        searchParams={await searchParams}
      />
    </>
  );
}
