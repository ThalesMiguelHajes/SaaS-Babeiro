"use client";

import { Loader2Icon, TriangleAlertIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatInTimeZone } from "@/lib/dates";

import type { ConflictPreview } from "../actions";
import { CONFLICT_REASON_LABEL } from "../rules";

/**
 * Mostra os agendamentos afetados por uma mudança de horário/bloqueio antes de salvar.
 * Nada é cancelado automaticamente: a equipe decide o que fazer com cada cliente.
 */
export function ConflictsDialog({
  conflicts,
  timeZone,
  pending,
  onCancel,
  onConfirm,
}: {
  conflicts: ConflictPreview[] | null;
  timeZone: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={conflicts !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <TriangleAlertIcon className="size-5 text-amber-600" aria-hidden />
            {conflicts?.length === 1
              ? "1 agendamento será afetado"
              : `${conflicts?.length ?? 0} agendamentos serão afetados`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Eles não serão cancelados. Depois de salvar, aparecem em &quot;Precisam de atenção&quot;
            para você remarcar ou avisar o cliente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="flex max-h-64 flex-col divide-y overflow-y-auto rounded-md border text-sm">
          {conflicts?.map((c) => (
            <li key={c.appointmentId} className="flex flex-col gap-0.5 px-3 py-2">
              <span className="font-medium">
                {formatInTimeZone(c.startsAt, "EEE, dd/MM 'às' HH:mm", timeZone)} · {c.customerName}
              </span>
              <span className="text-muted-foreground">
                {c.serviceName} com {c.professionalName} — {CONFLICT_REASON_LABEL[c.reason]}
              </span>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Voltar</AlertDialogCancel>
          <Button onClick={onConfirm} disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Salvar mesmo assim
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
