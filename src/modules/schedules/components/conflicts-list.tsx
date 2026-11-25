import { TriangleAlertIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInTimeZone } from "@/lib/dates";

import { CONFLICT_REASON_LABEL } from "../rules";

type Conflict = {
  appointmentId: string;
  professionalName: string;
  startsAt: string;
  serviceName: string;
  customerName: string;
  reason: string;
};

/** "Agendamentos que precisam de atenção" (DATABASE §7.6). Não aparece quando não há nenhum. */
export function ConflictsList({
  conflicts,
  timeZone,
}: {
  conflicts: Conflict[];
  timeZone: string;
}) {
  if (conflicts.length === 0) return null;
  return (
    <Card className="border-amber-500/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlertIcon className="size-5 text-amber-600" aria-hidden />
          Agendamentos que precisam de atenção
        </CardTitle>
        <CardDescription>
          Ficaram fora do horário de trabalho ou em cima de um bloqueio depois de uma mudança.
          Remarque ou avise o cliente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y text-sm">
          {conflicts.map((c) => (
            <li key={c.appointmentId} className="flex flex-col gap-0.5 py-2">
              <span className="font-medium">
                {formatInTimeZone(c.startsAt, "EEE, dd/MM 'às' HH:mm", timeZone)} · {c.customerName}
              </span>
              <span className="text-muted-foreground">
                {c.serviceName} com {c.professionalName} — {CONFLICT_REASON_LABEL[c.reason]}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
