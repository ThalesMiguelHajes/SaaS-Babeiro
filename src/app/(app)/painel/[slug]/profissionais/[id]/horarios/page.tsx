import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requireMembership } from "@/lib/authz";
import { todayInTimeZone } from "@/modules/availability/rules";
import { getProfessional } from "@/modules/professionals/queries";
import { ProfessionalSchedule } from "@/modules/schedules/components/professional-schedule";
import { getWeeklyHours, listBlocks, listDateOverrides } from "@/modules/schedules/queries";
import { listServices } from "@/modules/services/queries";

export const metadata: Metadata = { title: "Horários do profissional" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProfessionalHoursPage({
  params,
}: PageProps<"/painel/[slug]/profissionais/[id]/horarios">) {
  const { slug, id } = await params;
  const { establishment } = await requireMembership(slug, ["owner", "admin"]);
  if (!UUID.test(id)) notFound();
  const tz = establishment.timezone;
  const today = todayInTimeZone(tz);

  const [pro, weekly, overrides, blocks, { services }] = await Promise.all([
    getProfessional(establishment.id, id),
    getWeeklyHours(establishment.id, id),
    listDateOverrides(establishment.id, id, today),
    listBlocks(establishment.id, id),
    listServices(establishment.id),
  ]);
  if (!pro) notFound();

  return (
    <>
      <PageHeader
        title={`Horários de ${pro.display_name}`}
        description="Jornada, folgas, férias e os horários que o cliente poderá escolher."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/painel/${establishment.slug}/profissionais/${pro.id}`}>
              <ArrowLeftIcon aria-hidden />
              Dados do profissional
            </Link>
          </Button>
        }
      />
      <ProfessionalSchedule
        slug={establishment.slug}
        professionalId={pro.id}
        timeZone={tz}
        today={today}
        weekly={weekly}
        overrides={overrides}
        blocks={blocks}
        services={services.filter(
          (s) => s.is_active && !s.archived_at && pro.serviceIds.includes(s.id),
        )}
        canManageHours
        canManageBlocks
      />
    </>
  );
}
