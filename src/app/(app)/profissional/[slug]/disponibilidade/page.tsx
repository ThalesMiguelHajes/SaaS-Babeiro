import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { requireProfessional } from "@/lib/authz";
import { todayInTimeZone } from "@/modules/availability/rules";
import { getProfessional } from "@/modules/professionals/queries";
import { ProfessionalSchedule } from "@/modules/schedules/components/professional-schedule";
import {
  getStaffPermissions,
  getWeeklyHours,
  listBlocks,
  listDateOverrides,
} from "@/modules/schedules/queries";
import { listServices } from "@/modules/services/queries";

export const metadata: Metadata = { title: "Minha disponibilidade" };

export default async function MyAvailabilityPage({
  params,
}: PageProps<"/profissional/[slug]/disponibilidade">) {
  const { slug } = await params;
  const { establishment, professionalId, role } = await requireProfessional(slug);
  const tz = establishment.timezone;
  const today = todayInTimeZone(tz);
  const isAdmin = role === "owner" || role === "admin";

  const [pro, weekly, overrides, blocks, { services }, perms] = await Promise.all([
    getProfessional(establishment.id, professionalId),
    getWeeklyHours(establishment.id, professionalId),
    listDateOverrides(establishment.id, professionalId, today),
    listBlocks(establishment.id, professionalId),
    listServices(establishment.id),
    getStaffPermissions(establishment.id),
  ]);

  return (
    <>
      <PageHeader
        title="Minha disponibilidade"
        description="Sua jornada, folgas, bloqueios e os horários livres para os clientes."
      />
      <ProfessionalSchedule
        slug={establishment.slug}
        professionalId={professionalId}
        timeZone={tz}
        today={today}
        weekly={weekly}
        overrides={overrides}
        blocks={blocks}
        services={services.filter(
          (s) => s.is_active && !s.archived_at && (pro?.serviceIds ?? []).includes(s.id),
        )}
        canManageHours={isAdmin || perms.canManageHours}
        canManageBlocks={isAdmin || perms.canManageBlocks}
      />
    </>
  );
}
