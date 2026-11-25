"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { updateDunningAction } from "../actions";

/** Régua de cobrança e prazos (BILLING §11.1). Suspensão automática vem desligada. */
export function DunningForm({
  defaults,
}: {
  defaults: {
    issueDays: number;
    pastDueAfter: number;
    graceDays: number;
    autoSuspend: boolean;
    offsets: number[];
  };
}) {
  const router = useRouter();
  const [issue, setIssue] = useState(String(defaults.issueDays));
  const [pastDue, setPastDue] = useState(String(defaults.pastDueAfter));
  const [grace, setGrace] = useState(String(defaults.graceDays));
  const [auto, setAuto] = useState(defaults.autoSuspend);
  const [offsets, setOffsets] = useState(defaults.offsets.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <FormAlert message={error} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="dn-issue">Emitir fatura (dias antes)</FieldLabel>
          <Input
            id="dn-issue"
            type="number"
            min={0}
            max={28}
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="dn-pastdue">Em atraso após (dias)</FieldLabel>
          <Input
            id="dn-pastdue"
            type="number"
            min={0}
            max={60}
            value={pastDue}
            onChange={(e) => setPastDue(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="dn-grace">Tolerância para suspender (dias)</FieldLabel>
          <Input
            id="dn-grace"
            type="number"
            min={0}
            max={90}
            value={grace}
            onChange={(e) => setGrace(e.target.value)}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="dn-offsets">Dias da régua (relativos ao vencimento)</FieldLabel>
        <Input id="dn-offsets" value={offsets} onChange={(e) => setOffsets(e.target.value)} />
        <FieldDescription>
          Negativo = antes, 0 = no dia, positivo = depois. Ex.: -5, -1, 0, 1, 5.
        </FieldDescription>
      </Field>
      <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
        <Switch checked={auto} onCheckedChange={setAuto} aria-label="Suspensão automática" />
        <span>
          <span className="font-medium">Suspender automaticamente após a tolerância</span>
          <span className="block text-muted-foreground">
            Desligado: a assinatura fica &quot;em atraso&quot; e a suspensão é manual. Nunca apaga
            dados nem cancela agendamentos.
          </span>
        </span>
      </label>
      <div>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await updateDunningAction({
                issueDaysBeforeDue: issue,
                pastDueAfterDays: pastDue,
                graceDays: grace,
                autoSuspendEnabled: auto,
                offsets,
              });
              if (!r.ok) setError(r.error.message);
              else {
                toast.success("Régua salva.");
                router.refresh();
              }
            })
          }
        >
          {pending && <Loader2Icon className="animate-spin" aria-hidden />}
          Salvar régua
        </Button>
      </div>
    </div>
  );
}
