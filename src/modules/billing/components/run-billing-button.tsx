"use client";

import { Loader2Icon, PlayIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { runBillingNowAction } from "../actions";

/** Executa a mesma rotina do agendamento (idempotente; seguro rodar de novo). */
export function RunBillingButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await runBillingNowAction();
          if (!r.ok) toast.error(r.error.message);
          else {
            toast.success("Rotina executada.");
            router.refresh();
          }
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <PlayIcon aria-hidden />}
      Executar rotina agora
    </Button>
  );
}
