import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { requireMembership } from "@/lib/authz";
import { ProfessionalForm } from "@/modules/professionals/components/professional-form";
import { listServices } from "@/modules/services/queries";

export const metadata: Metadata = { title: "Novo profissional" };

export default async function NewProfessionalPage({
  params,
}: PageProps<"/painel/[slug]/profissionais/novo">) {
  const { slug } = await params;
  const { establishment } = await requireMembership(slug, ["owner", "admin"]);
  const { services } = await listServices(establishment.id);

  return (
    <>
      <PageHeader
        title="Novo profissional"
        description="Depois de salvar, você pode enviar a foto e vincular o acesso dele ao painel."
      />
      <ProfessionalForm
        slug={establishment.slug}
        professionalId={null}
        defaults={{
          displayName: "",
          bio: "",
          specialties: "",
          isBookable: true,
          isActive: true,
          serviceIds: [],
        }}
        services={services.filter((s) => !s.archived_at && s.is_active)}
      />
    </>
  );
}
