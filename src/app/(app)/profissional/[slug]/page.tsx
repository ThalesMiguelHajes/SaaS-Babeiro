import { CalendarDaysIcon } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireMembership } from "@/lib/authz";

export const metadata: Metadata = { title: "Minha agenda" };

export default async function ProfessionalHomePage({ params }: PageProps<"/profissional/[slug]">) {
  const { slug } = await params;
  const { user } = await requireMembership(slug);

  return (
    <>
      <PageHeader
        title={`Olá, ${user.fullName.split(" ")[0]}`}
        description="Seus próximos atendimentos aparecem aqui."
      />
      <EmptyState icon={CalendarDaysIcon} title="Nenhum atendimento agendado" />
    </>
  );
}
