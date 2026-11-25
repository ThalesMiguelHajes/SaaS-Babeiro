import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { requireMembership } from "@/lib/authz";
import { listProfessionals } from "@/modules/professionals/queries";
import { ServiceForm } from "@/modules/services/components/service-form";
import { listServices } from "@/modules/services/queries";

export const metadata: Metadata = { title: "Novo serviço" };

export default async function NewServicePage({
  params,
}: PageProps<"/painel/[slug]/servicos/novo">) {
  const { slug } = await params;
  const { establishment } = await requireMembership(slug, ["owner", "admin"]);
  const [{ categories }, pros] = await Promise.all([
    listServices(establishment.id),
    listProfessionals(establishment.id),
  ]);
  const activePros = pros.filter((p) => p.is_active);

  return (
    <>
      <PageHeader title="Novo serviço" />
      <ServiceForm
        slug={establishment.slug}
        serviceId={null}
        categories={categories}
        professionals={activePros}
        defaults={{
          name: "",
          description: "",
          categoryId: "",
          price: "",
          durationMinutes: 30,
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 0,
          isPublic: true,
          isActive: true,
          // Atalho comum: com um só profissional, ele já vem marcado.
          professionalIds: activePros.length === 1 ? [activePros[0]!.id] : [],
        }}
      />
    </>
  );
}
