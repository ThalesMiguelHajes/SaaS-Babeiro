import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { requireMembership } from "@/lib/authz";
import { AgendaView } from "@/modules/appointments/components/agenda-view";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({
  params,
  searchParams,
}: PageProps<"/painel/[slug]/agenda">) {
  const { slug } = await params;
  const { establishment, professionalId } = await requireMembership(slug, ["owner", "admin"]);

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Clique em um horário livre para agendar ou em um atendimento para ver detalhes."
      />
      <AgendaView
        basePath={`/painel/${establishment.slug}/agenda`}
        slug={establishment.slug}
        establishmentId={establishment.id}
        timeZone={establishment.timezone}
        isAdmin
        ownProfessionalId={professionalId}
        searchParams={await searchParams}
      />
    </>
  );
}
