"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { createPlanVersionAction } from "../actions";

const toInput = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ","));

/** Reajuste: cria uma nova versão; assinaturas existentes mantêm o preço contratado (BILLING §2.2). */
export function PlanVersionForm({
  planId,
  current,
}: {
  planId: string;
  current: { monthly: number; annual: number | null; included: number; extra: number | null };
}) {
  const router = useRouter();
  const [monthly, setMonthly] = useState(toInput(current.monthly));
  const [annual, setAnnual] = useState(toInput(current.annual));
  const [included, setIncluded] = useState(String(current.included));
  const [extra, setExtra] = useState(toInput(current.extra));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <FormAlert message={error} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs">
          Mensal (R$)
          <Input inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Anual (R$)
          <Input inputMode="decimal" value={annual} onChange={(e) => setAnnual(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Profissionais
          <Input
            type="number"
            min={1}
            value={included}
            onChange={(e) => setIncluded(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Vaga extra (R$)
          <Input
            inputMode="decimal"
            placeholder="não permite"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
        </label>
      </div>
      <div>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await createPlanVersionAction(planId, {
                monthlyPrice: monthly,
                annualPrice: annual,
                includedProfessionals: Number(included),
                extraPrice: extra,
              });
              if (!r.ok) setError(r.error.message);
              else {
                toast.success("Nova versão criada. Contratos existentes não mudam.");
                router.refresh();
              }
            })
          }
        >
          Criar nova versão de preço
        </Button>
      </div>
    </div>
  );
}
