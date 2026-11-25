import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SlotSimulator } from "@/modules/availability/components/slot-simulator";

import { describeIntervals, type WeekDayHours } from "../rules";
import { BlocksManager } from "./blocks-manager";
import { DateOverridesManager } from "./date-overrides-manager";
import { WeeklyHoursEditor } from "./weekly-hours-editor";

type Override = {
  date: string;
  kind: "closed" | "custom_hours";
  label: string | null;
  intervals: { start: string; end: string }[];
};
type Block = {
  id: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  kind: string;
  reason: string | null;
};

/**
 * Jornada, folgas, bloqueios e horários livres de um profissional.
 * Usado pelo admin (página do profissional) e pelo próprio profissional (permissões da casa).
 */
export function ProfessionalSchedule({
  slug,
  professionalId,
  timeZone,
  today,
  weekly,
  overrides,
  blocks,
  services,
  canManageHours,
  canManageBlocks,
}: {
  slug: string;
  professionalId: string;
  timeZone: string;
  today: string;
  weekly: { configured: boolean; days: WeekDayHours[] };
  overrides: Override[];
  blocks: Block[];
  services: { id: string; name: string; duration_minutes: number }[];
  canManageHours: boolean;
  canManageBlocks: boolean;
}) {
  return (
    <Tabs defaultValue="jornada" className="flex flex-col gap-4">
      <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
        <TabsTrigger value="jornada">Jornada</TabsTrigger>
        <TabsTrigger value="datas">Folgas e datas</TabsTrigger>
        <TabsTrigger value="bloqueios">Bloqueios e férias</TabsTrigger>
        <TabsTrigger value="livres">Horários livres</TabsTrigger>
      </TabsList>

      <TabsContent value="jornada">
        <Card>
          <CardHeader>
            <CardTitle>Jornada semanal</CardTitle>
            <CardDescription>
              Os horários oferecidos respeitam ao mesmo tempo esta jornada e o horário de
              funcionamento do estabelecimento.
              {!canManageHours && " Só a administração altera a jornada."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyHoursEditor
              slug={slug}
              professionalId={professionalId}
              initialDays={weekly.days}
              configured={weekly.configured}
              timeZone={timeZone}
              inheritOption
              readOnly={!canManageHours}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="datas">
        <Card>
          <CardHeader>
            <CardTitle>Folgas e horários especiais</CardTitle>
            <CardDescription>
              Substituem a jornada semanal apenas na data escolhida.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManageHours ? (
              <DateOverridesManager
                slug={slug}
                professionalId={professionalId}
                overrides={overrides}
                today={today}
                timeZone={timeZone}
                closedLabel="Folga"
              />
            ) : (
              <ul className="flex flex-col divide-y rounded-lg border text-sm">
                {overrides.length === 0 && (
                  <li className="px-3 py-3 text-muted-foreground">Nenhuma data especial.</li>
                )}
                {overrides.map((o) => (
                  <li key={o.date} className="px-3 py-2">
                    {o.date.split("-").reverse().join("/")} —{" "}
                    {o.kind === "closed" ? "Folga" : describeIntervals(o.intervals)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="bloqueios">
        <Card>
          <CardHeader>
            <CardTitle>Bloqueios e férias</CardTitle>
            <CardDescription>
              Pausas, compromissos e férias. Podem ser criados sobre agendamentos existentes: o
              sistema avisa e nada é cancelado.
              {!canManageBlocks && " Só a administração cria bloqueios."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BlocksManager
              slug={slug}
              professionalId={professionalId}
              blocks={blocks}
              today={today}
              timeZone={timeZone}
              readOnly={!canManageBlocks}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="livres">
        <Card>
          <CardHeader>
            <CardTitle>Horários livres</CardTitle>
            <CardDescription>
              O que o cliente poderá escolher, já descontando atendimentos, bloqueios e o tempo de
              preparo e limpeza.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SlotSimulator
              slug={slug}
              services={services}
              professionals={[]}
              today={today}
              timeZone={timeZone}
              fixedProfessionalId={professionalId}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
