import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireMembership } from "@/lib/authz";
import { todayInTimeZone } from "@/modules/availability/rules";
import { SlotSimulator } from "@/modules/availability/components/slot-simulator";
import { listProfessionals } from "@/modules/professionals/queries";
import { BlocksManager } from "@/modules/schedules/components/blocks-manager";
import { ConflictsList } from "@/modules/schedules/components/conflicts-list";
import { DateOverridesManager } from "@/modules/schedules/components/date-overrides-manager";
import { WeeklyHoursEditor } from "@/modules/schedules/components/weekly-hours-editor";
import {
  getScheduleConflicts,
  getWeeklyHours,
  listBlocks,
  listDateOverrides,
} from "@/modules/schedules/queries";
import { listServices } from "@/modules/services/queries";

export const metadata: Metadata = { title: "Horários" };

export default async function EstablishmentHoursPage({
  params,
}: PageProps<"/painel/[slug]/horarios">) {
  const { slug } = await params;
  const { establishment } = await requireMembership(slug, ["owner", "admin"]);
  const tz = establishment.timezone;
  const today = todayInTimeZone(tz);

  const [weekly, overrides, blocks, conflicts, { services }, professionals] = await Promise.all([
    getWeeklyHours(establishment.id, null),
    listDateOverrides(establishment.id, null, today),
    listBlocks(establishment.id, "establishment"),
    getScheduleConflicts(establishment.id),
    listServices(establishment.id),
    listProfessionals(establishment.id),
  ]);

  return (
    <>
      <PageHeader
        title="Horários"
        description="Funcionamento da casa, feriados e bloqueios. A jornada de cada profissional fica na página dele."
      />
      <ConflictsList conflicts={conflicts} timeZone={tz} />

      <Tabs defaultValue="semana" className="flex flex-col gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
          <TabsTrigger value="semana">Funcionamento</TabsTrigger>
          <TabsTrigger value="datas">Feriados e datas</TabsTrigger>
          <TabsTrigger value="bloqueios">Bloqueios</TabsTrigger>
          <TabsTrigger value="livres">Horários livres</TabsTrigger>
        </TabsList>

        <TabsContent value="semana">
          <Card>
            <CardHeader>
              <CardTitle>Horário de funcionamento</CardTitle>
              <CardDescription>
                Use mais de um intervalo para fechar no almoço (ex.: 09:00–12:00 e 13:00–19:00).
                {!weekly.configured && " Enquanto não for definido, nenhum horário é oferecido."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WeeklyHoursEditor
                slug={establishment.slug}
                professionalId={null}
                initialDays={weekly.days}
                configured={weekly.configured}
                timeZone={tz}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="datas">
          <Card>
            <CardHeader>
              <CardTitle>Feriados e datas especiais</CardTitle>
              <CardDescription>
                Feche a casa ou defina um horário diferente em uma data. Vale para toda a equipe.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DateOverridesManager
                slug={establishment.slug}
                professionalId={null}
                overrides={overrides}
                today={today}
                timeZone={tz}
                closedLabel="Fechado"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bloqueios">
          <Card>
            <CardHeader>
              <CardTitle>Bloqueios da casa</CardTitle>
              <CardDescription>
                Eventos, reformas ou pausas que valem para todos os profissionais.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BlocksManager
                slug={establishment.slug}
                professionalId={null}
                blocks={blocks}
                today={today}
                timeZone={tz}
                defaultKind="other"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="livres">
          <Card>
            <CardHeader>
              <CardTitle>Consultar horários livres</CardTitle>
              <CardDescription>
                Calculado pelo mesmo motor que vai validar as reservas: funcionamento, jornada,
                bloqueios, atendimentos e tempo de preparo/limpeza. A página de agendamento aplica
                ainda a antecedência mínima e o limite de dias definidos nas configurações.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SlotSimulator
                slug={establishment.slug}
                services={services.filter((s) => s.is_active && !s.archived_at)}
                professionals={professionals.filter((p) => p.is_active)}
                today={today}
                timeZone={tz}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
