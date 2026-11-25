"use client";

import { BanIcon, PauseCircleIcon, PlayCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { Database } from "@/types/database";

import { setEstablishmentStatusAction } from "../actions";

type Status = Database["public"]["Enums"]["establishment_status"];

export function StatusActions({
  establishmentId,
  name,
  status,
}: {
  establishmentId: string;
  name: string;
  status: Status;
}) {
  const router = useRouter();

  const change = (to: Status, success: string) => async (reason: string) => {
    const result = await setEstablishmentStatusAction({ establishmentId, status: to, reason });
    if (!result.ok) return result.error.message;
    toast.success(success);
    router.refresh();
    return null;
  };

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "active" && (
        <ConfirmDialog
          trigger={
            <Button variant="outline">
              <PlayCircleIcon aria-hidden /> Reativar
            </Button>
          }
          title={`Reativar ${name}?`}
          description="A equipe volta a ter acesso completo e a página pública volta a aceitar agendamentos."
          confirmLabel="Reativar"
          onConfirm={change("active", "Estabelecimento reativado.")}
        />
      )}
      {status === "active" && (
        <ConfirmDialog
          trigger={
            <Button variant="outline">
              <PauseCircleIcon aria-hidden /> Suspender
            </Button>
          }
          title={`Suspender ${name}?`}
          description={
            <ul className="list-disc space-y-1 pl-4">
              <li>A página pública deixa de aceitar novos agendamentos.</li>
              <li>
                A equipe continua acessando o painel para gerenciar os agendamentos existentes.
              </li>
              <li>Nenhum dado é apagado e nenhum agendamento é cancelado.</li>
            </ul>
          }
          confirmLabel="Suspender"
          requireReason
          onConfirm={change("suspended", "Estabelecimento suspenso.")}
        />
      )}
      {status !== "deactivated" && (
        <ConfirmDialog
          trigger={
            <Button variant="outline" className="text-destructive">
              <BanIcon aria-hidden /> Desativar
            </Button>
          }
          title={`Desativar ${name}?`}
          description={
            <ul className="list-disc space-y-1 pl-4">
              <li>A equipe perde o acesso ao painel.</li>
              <li>A página pública deixa de existir.</li>
              <li>Os dados são preservados e você pode reativar depois.</li>
            </ul>
          }
          confirmLabel="Desativar"
          destructive
          requireReason
          onConfirm={change("deactivated", "Estabelecimento desativado.")}
        />
      )}
    </div>
  );
}
