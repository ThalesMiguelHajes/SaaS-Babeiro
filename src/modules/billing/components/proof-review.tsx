"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseBrlToCents } from "@/lib/money";

import { proofUrlAction, reviewProofAction } from "../actions";

/** Conferência de comprovante: abrir (URL assinada de 60 s), aceitar com o valor recebido ou rejeitar. */
export function ProofReview({ proofId, balanceCents }: { proofId: string; balanceCents: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState((balanceCents / 100).toFixed(2).replace(".", ","));
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await proofUrlAction(proofId);
            if (!r.ok) toast.error(r.error.message);
            else window.open(r.data, "_blank", "noopener,noreferrer");
          })
        }
      >
        <ExternalLinkIcon aria-hidden />
        Ver comprovante
      </Button>
      <Input
        className="h-8 w-28"
        inputMode="decimal"
        aria-label="Valor recebido"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await reviewProofAction(proofId, true, parseBrlToCents(amount) ?? 0, "");
            if (!r.ok) toast.error(r.error.message);
            else {
              toast.success("Pagamento confirmado.");
              router.refresh();
            }
          })
        }
      >
        Confirmar pagamento
      </Button>
      <ConfirmDialog
        trigger={
          <Button size="sm" variant="ghost" className="text-destructive">
            Rejeitar
          </Button>
        }
        title="Rejeitar este comprovante?"
        description="O motivo aparece para o estabelecimento."
        confirmLabel="Rejeitar"
        destructive
        requireReason
        onConfirm={async (reason) => {
          const r = await reviewProofAction(proofId, false, 0, reason);
          if (!r.ok) return r.error.message;
          toast.success("Comprovante rejeitado.");
          router.refresh();
          return null;
        }}
      />
    </div>
  );
}
