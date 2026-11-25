import { TriangleAlertIcon } from "lucide-react";

import type { Database } from "@/types/database";

/** Aviso exibido no painel quando o estabelecimento não está ativo (MASTER_PLAN §4.1). */
export function EstablishmentStatusBanner({
  status,
}: {
  status: Database["public"]["Enums"]["establishment_status"];
}) {
  if (status !== "suspended") return null;
  return (
    <div
      role="status"
      className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
    >
      <TriangleAlertIcon
        className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden
      />
      <p>
        <span className="font-medium">Estabelecimento suspenso.</span> A página pública não aceita
        novos agendamentos. Você ainda pode consultar e gerenciar os agendamentos existentes.
      </p>
    </div>
  );
}
