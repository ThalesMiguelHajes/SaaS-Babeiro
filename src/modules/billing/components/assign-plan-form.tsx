"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatCents, parseBrlToCents } from "@/lib/money";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { assignSubscriptionAction } from "../actions";
import { billingCycleStart } from "../rules";

type PlanOption = {
  versionId: string;
  name: string;
  monthly: number;
  included: number;
  extraPrice: number | null;
};

const toInput = (c: number) => (c / 100).toFixed(2).replace(".", ",");

/** Escolher plano → oferta/implantação → condições → gerar a 1ª fatura (BILLING §18.1). */
export function AssignPlanForm({
  establishmentId,
  plans,
  offerPriceCents,
  defaultSetupCents,
  activeProfessionals,
  today,
}: {
  establishmentId: string;
  plans: PlanOption[];
  offerPriceCents: number | null;
  defaultSetupCents: number;
  activeProfessionals: number;
  today: string;
}) {
  const router = useRouter();
  const [versionId, setVersionId] = useState(plans[1]?.versionId ?? plans[0]?.versionId ?? "");
  const [useOffer, setUseOffer] = useState(offerPriceCents !== null);
  const [setupMode, setSetupMode] = useState<"first_invoice" | "waive" | "separate">(
    "first_invoice",
  );
  const [setupFee, setSetupFee] = useState(toInput(defaultSetupCents));
  const [override, setOverride] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [extra, setExtra] = useState("0");
  const [anchorDate, setAnchorDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const plan = plans.find((p) => p.versionId === versionId);
  const monthly = parseBrlToCents(override) ?? plan?.monthly ?? 0;
  const extras = plan?.extraPrice ? Number(extra || 0) * plan.extraPrice : 0;
  const setup = setupMode === "first_invoice" ? (parseBrlToCents(setupFee) ?? 0) : 0;
  const first =
    useOffer && offerPriceCents !== null ? offerPriceCents + extras : monthly + extras + setup;
  const limit = (plan?.included ?? 0) + (plan?.extraPrice ? Number(extra || 0) : 0);

  function submit() {
    setError(null);
    start(async () => {
      const r = await assignSubscriptionAction(establishmentId, {
        planVersionId: versionId,
        anchorDate,
        useOffer: useOffer && offerPriceCents !== null,
        setupMode,
        setupFee,
        priceOverride: override,
        overrideReason,
        extraProfessionals: Number(extra || 0),
        notes,
      });
      if (!r.ok) {
        setError(r.error.message);
        return;
      }
      toast.success("Plano atribuído e 1ª fatura gerada.");
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <FormAlert message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="ap-plan">Plano</FieldLabel>
          <NativeSelect
            id="ap-plan"
            className="w-full"
            value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
          >
            {plans.map((p) => (
              <NativeSelectOption key={p.versionId} value={p.versionId}>
                {p.name} — {formatCents(p.monthly)}/mês · {p.included} profissional
                {p.included > 1 ? "is" : ""}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {plan && activeProfessionals > limit && (
            <FieldDescription className="text-destructive">
              O estabelecimento tem {activeProfessionals} profissionais ativos; este plano permite{" "}
              {limit}.
            </FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="ap-anchor">Início do 1º ciclo (vencimento)</FieldLabel>
          <Input
            id="ap-anchor"
            type="date"
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
          />
          <FieldDescription>
            Próximos vencimentos:{" "}
            {[1, 2]
              .map((k) =>
                billingCycleStart(anchorDate, Number(anchorDate.slice(8)), "month", k)
                  .split("-")
                  .reverse()
                  .join("/"),
              )
              .join(", ")}
            …
          </FieldDescription>
        </Field>
      </div>

      {offerPriceCents !== null && (
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
          <Switch
            checked={useOffer}
            onCheckedChange={setUseOffer}
            aria-label="Usar oferta de entrada"
          />
          <span>
            <span className="font-medium">
              Oferta de entrada: {formatCents(offerPriceCents)} no 1º mês
            </span>
            <span className="block text-muted-foreground">
              Inclui a implantação completa. Uso único por estabelecimento.
            </span>
          </span>
        </label>
      )}

      {!useOffer && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="ap-setup-mode">Implantação</FieldLabel>
            <NativeSelect
              id="ap-setup-mode"
              className="w-full"
              value={setupMode}
              onChange={(e) => setSetupMode(e.target.value as "waive")}
            >
              <NativeSelectOption value="first_invoice">Cobrar na 1ª fatura</NativeSelectOption>
              <NativeSelectOption value="separate">Cobrar em fatura separada</NativeSelectOption>
              <NativeSelectOption value="waive">Isentar</NativeSelectOption>
            </NativeSelect>
          </Field>
          {setupMode !== "waive" && (
            <Field>
              <FieldLabel htmlFor="ap-setup">Valor da implantação (R$)</FieldLabel>
              <Input
                id="ap-setup"
                inputMode="decimal"
                value={setupFee}
                onChange={(e) => setSetupFee(e.target.value)}
              />
            </Field>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="ap-override">Preço negociado (opcional, R$/mês)</FieldLabel>
          <Input
            id="ap-override"
            inputMode="decimal"
            placeholder={plan ? toInput(plan.monthly) : ""}
            value={override}
            onChange={(e) => setOverride(e.target.value)}
          />
        </Field>
        {override && (
          <Field>
            <FieldLabel htmlFor="ap-override-reason">Motivo do preço negociado</FieldLabel>
            <Input
              id="ap-override-reason"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
          </Field>
        )}
        {plan?.extraPrice !== null && plan?.extraPrice !== undefined && (
          <Field>
            <FieldLabel htmlFor="ap-extra">
              Vagas adicionais ({formatCents(plan.extraPrice)} cada)
            </FieldLabel>
            <Input
              id="ap-extra"
              type="number"
              min={0}
              max={500}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
            />
          </Field>
        )}
      </div>

      <Field>
        <FieldLabel htmlFor="ap-notes">Observações comerciais (opcional)</FieldLabel>
        <Textarea id="ap-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <p className="rounded-md bg-muted/60 p-3 text-sm">
        1ª fatura: <strong data-testid="first-invoice-preview">{formatCents(first)}</strong> ·
        depois {formatCents(monthly + extras)}/mês
        {!useOffer &&
          setupMode === "separate" &&
          setup === 0 &&
          " (implantação em fatura separada)"}
      </p>

      <div>
        <Button onClick={submit} disabled={pending || !versionId}>
          {pending && <Loader2Icon className="animate-spin" aria-hidden />}
          Atribuir plano e gerar fatura
        </Button>
      </div>
    </div>
  );
}
