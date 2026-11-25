import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { requireMembership } from "@/lib/authz";
import { listProfessionals } from "@/modules/professionals/queries";
import { ServiceForm } from "@/modules/services/components/service-form";
import { getService, listServices } from "@/modules/services/queries";

export const metadata: Metadata = { title: "Serviço" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export default async function ServicePage({ params }: PageProps<"/painel/[slug]/servicos/[id]">) {
  const { slug, id } = await params;
  const { establishment } = await requireMembership(slug, ["owner", "admin"]);
  if (!UUID.test(id)) notFound();
  const [service, { categories }, pros] = await Promise.all([
    getService(establishment.id, id),
    listServices(establishment.id),
    listProfessionals(establishment.id),
  ]);
  if (!service || service.archived_at) notFound();

  return (
    <>
      <PageHeader
        title={service.name}
        description="Alterar preço ou duração vale para os próximos agendamentos; os já feitos mantêm os valores originais."
      />
      <ServiceForm
        slug={establishment.slug}
        serviceId={service.id}
        categories={categories}
        professionals={pros.filter((p) => p.is_active || service.professionalIds.includes(p.id))}
        defaults={{
          name: service.name,
          description: service.description ?? "",
          categoryId: service.category_id ?? "",
          price: centsToInput(service.price_cents),
          durationMinutes: service.duration_minutes,
          bufferBeforeMinutes: service.buffer_before_minutes,
          bufferAfterMinutes: service.buffer_after_minutes,
          isPublic: service.is_public,
          isActive: service.is_active,
          professionalIds: service.professionalIds,
        }}
      />
    </>
  );
}
