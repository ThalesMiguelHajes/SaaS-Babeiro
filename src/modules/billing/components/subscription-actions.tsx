"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { formatCents } from "@/lib/money";
import { FormAlert } from "@/modules/auth/components/form-alert";

import {
  addChargeAction,
  changePlanAction,
  generateNextInvoiceAction,
  grantDiscountAction,
  schedulePlanChangeAction,
  setDunningOverrideAction,
  transitionSubscriptionAction,
} from "../actions";
import type { SubscriptionStatus } from "../rules";

type Plan = {
  versionId: string;
  name: string;
  monthly: number;
  included: number;
  extraPrice: number | null;
};
type AddOn = {
  id: string;
  name: string;
  price_cents: number | null;
  is_technically_available: boolean;
  billing_type: string;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">{title}</summary>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </details>
  );
}

/** Ações do Super Admin sobre a assinatura (todas auditadas no banco). */
export function SubscriptionActions({
  establishmentId,
  subscription,
  plans,
  addOns,
}: {
  establishmentId: string;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    planVersionId: string;
    extraProfessionals: number;
    autoSuspendOverride: boolean | null;
    graceDaysOverride: number | null;
  };
  plans: Plan[];
  addOns: AddOn[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [planId, setPlanId] = useState(subscription.planVersionId);
  const [whenNext, setWhenNext] = useState(false);
  const [autoSuspend, setAutoSuspend] = useState<"default" | "on" | "off">(
    subscription.autoSuspendOverride === null
      ? "default"
      : subscription.autoSuspendOverride
        ? "on"
        : "off",
  );
  const [graceOverride, setGraceOverride] = useState(
    subscription.graceDaysOverride === null ? "" : String(subscription.graceDaysOverride),
  );
  const [extra, setExtra] = useState(String(subscription.extraProfessionals));
  const [chargeAddOn, setChargeAddOn] = useState("");
  const [chargeDesc, setChargeDesc] = useState("");
  const [chargeQty, setChargeQty] = useState("1");
  const [chargePrice, setChargePrice] = useState("");
  const [standalone, setStandalone] = useState(false);
  const [discName, setDiscName] = useState("Desconto comercial");
  const [discKind, setDiscKind] = useState<"percent" | "fixed" | "free">("percent");
  const [discPercent, setDiscPercent] = useState("10");
  const [discAmount, setDiscAmount] = useState("");
  const [discDuration, setDiscDuration] = useState<"once" | "repeating" | "forever">("repeating");
  const [discCycles, setDiscCycles] = useState("3");
  const [discReason, setDiscReason] = useState("");
  const plan = plans.find((p) => p.versionId === planId);
  const s = subscription.status;

  function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>, message: string) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error?.message ?? "Erro");
        return;
      }
      toast.success(message);
      router.refresh();
    });
  }

  const transition = (
    to: "active" | "suspended" | "canceled",
    label: string,
    description: string,
  ) => (
    <ConfirmDialog
      trigger={
        <Button
          variant={to === "active" ? "outline" : "ghost"}
          className={to === "active" ? "" : "text-destructive"}
        >
          {label}
        </Button>
      }
      title={`${label}?`}
      description={description}
      confirmLabel={label}
      destructive={to !== "active"}
      requireReason={to !== "active"}
      onConfirm={async (reason) => {
        const r = await transitionSubscriptionAction(establishmentId, subscription.id, to, reason);
        if (!r.ok) return r.error.message;
        toast.success("Assinatura atualizada.");
        router.refresh();
        return null;
      }}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <FormAlert message={error} />
      <div className="flex flex-wrap gap-2">
        {s !== "canceled" && (
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () => generateNextInvoiceAction(establishmentId, subscription.id),
                "Próxima fatura gerada.",
              )
            }
          >
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Gerar próxima fatura
          </Button>
        )}
        {s === "pending_activation" &&
          transition(
            "active",
            "Ativar sem pagamento",
            "A assinatura fica ativa mesmo sem a 1ª fatura paga (ex.: cortesia).",
          )}
        {(s === "suspended" || s === "past_due") &&
          transition(
            "active",
            "Reativar",
            "O acesso volta ao normal. A suspensão administrativa, se houver, continua.",
          )}
        {(s === "active" || s === "past_due") &&
          transition(
            "suspended",
            "Suspender",
            "O estabelecimento fica em modo restrito: consulta e agendamentos existentes, sem novos. Nada é apagado.",
          )}
        {s !== "canceled" &&
          transition(
            "canceled",
            "Cancelar assinatura",
            "Dados preservados; o estabelecimento fica em modo restrito. Faturas em aberto continuam devidas, salvo se canceladas.",
          )}
      </div>

      {s !== "canceled" && (
        <>
          <Section title="Mudar plano ou vagas adicionais">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="cp-plan">Plano</FieldLabel>
                <NativeSelect
                  id="cp-plan"
                  className="w-full"
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                >
                  {plans.map((p) => (
                    <NativeSelectOption key={p.versionId} value={p.versionId}>
                      {p.name} — {formatCents(p.monthly)} · {p.included} prof.
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              {plan?.extraPrice !== null && plan?.extraPrice !== undefined && (
                <Field>
                  <FieldLabel htmlFor="cp-extra">Vagas adicionais</FieldLabel>
                  <Input
                    id="cp-extra"
                    type="number"
                    min={0}
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                  />
                </Field>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={whenNext}
                onCheckedChange={setWhenNext}
                aria-label="Aplicar no próximo ciclo"
              />
              Aplicar só no próximo ciclo (a rotina aplica na emissão da próxima fatura)
            </label>
            <p className="text-xs text-muted-foreground">
              Agora: vale a partir da próxima fatura. Downgrade acima do limite é bloqueado (no
              agendado, fica &quot;bloqueado&quot; e aparece aqui): ninguém é desativado
              automaticamente.
            </p>
            <div>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      (whenNext ? schedulePlanChangeAction : changePlanAction)(
                        establishmentId,
                        subscription.id,
                        {
                          planVersionId: planId,
                          extraProfessionals: plan?.extraPrice ? Number(extra) : 0,
                          reason: "",
                        },
                      ),
                    whenNext ? "Mudança agendada para o próximo ciclo." : "Plano atualizado.",
                  )
                }
              >
                Salvar plano
              </Button>
            </div>
          </Section>

          <Section title="Régua desta assinatura (exceções)">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="dn-auto">Suspensão automática</FieldLabel>
                <NativeSelect
                  id="dn-auto"
                  className="w-full"
                  value={autoSuspend}
                  onChange={(e) => setAutoSuspend(e.target.value as "default")}
                >
                  <NativeSelectOption value="default">
                    Seguir a configuração geral
                  </NativeSelectOption>
                  <NativeSelectOption value="on">Ligada para esta assinatura</NativeSelectOption>
                  <NativeSelectOption value="off">
                    Desligada para esta assinatura
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="dn-grace-o">Tolerância (dias)</FieldLabel>
                <Input
                  id="dn-grace-o"
                  type="number"
                  min={0}
                  max={90}
                  placeholder="geral"
                  value={graceOverride}
                  onChange={(e) => setGraceOverride(e.target.value)}
                />
              </Field>
            </div>
            <div>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      setDunningOverrideAction(
                        establishmentId,
                        subscription.id,
                        autoSuspend,
                        graceOverride,
                      ),
                    "Exceção salva.",
                  )
                }
              >
                Salvar exceção
              </Button>
            </div>
          </Section>

          <Section title="Cobrança avulsa ou serviço adicional">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="ch-addon">Serviço</FieldLabel>
                <NativeSelect
                  id="ch-addon"
                  className="w-full"
                  value={chargeAddOn}
                  onChange={(e) => {
                    setChargeAddOn(e.target.value);
                    const a = addOns.find((x) => x.id === e.target.value);
                    if (a) {
                      setChargeDesc(a.name);
                      if (a.price_cents !== null)
                        setChargePrice((a.price_cents / 100).toFixed(2).replace(".", ","));
                    }
                  }}
                >
                  <NativeSelectOption value="">Ajuste / outro</NativeSelectOption>
                  {addOns
                    .filter((a) => a.billing_type !== "recurring")
                    .map((a) => (
                      <NativeSelectOption key={a.id} value={a.id}>
                        {a.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="ch-desc">Descrição</FieldLabel>
                <Input
                  id="ch-desc"
                  value={chargeDesc}
                  onChange={(e) => setChargeDesc(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ch-qty">Quantidade</FieldLabel>
                <Input
                  id="ch-qty"
                  type="number"
                  min={1}
                  value={chargeQty}
                  onChange={(e) => setChargeQty(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ch-price">Valor unitário (R$)</FieldLabel>
                <Input
                  id="ch-price"
                  inputMode="decimal"
                  value={chargePrice}
                  onChange={(e) => setChargePrice(e.target.value)}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={standalone}
                onCheckedChange={setStandalone}
                aria-label="Fatura avulsa agora"
              />
              Gerar fatura avulsa agora (senão entra na próxima fatura)
            </label>
            <div>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      addChargeAction(establishmentId, {
                        addOnId: chargeAddOn || null,
                        description: chargeDesc,
                        quantity: Number(chargeQty),
                        unitPrice: chargePrice,
                        standalone,
                      }),
                    "Cobrança adicionada.",
                  )
                }
              >
                Adicionar cobrança
              </Button>
            </div>
          </Section>

          <Section title="Conceder desconto">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="dc-name">Nome</FieldLabel>
                <Input
                  id="dc-name"
                  value={discName}
                  onChange={(e) => setDiscName(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="dc-kind">Tipo</FieldLabel>
                <NativeSelect
                  id="dc-kind"
                  className="w-full"
                  value={discKind}
                  onChange={(e) => setDiscKind(e.target.value as "fixed")}
                >
                  <NativeSelectOption value="percent">Percentual</NativeSelectOption>
                  <NativeSelectOption value="fixed">Valor fixo</NativeSelectOption>
                  <NativeSelectOption value="free">Mensalidade gratuita</NativeSelectOption>
                </NativeSelect>
              </Field>
              {discKind === "percent" && (
                <Field>
                  <FieldLabel htmlFor="dc-pct">Percentual (%)</FieldLabel>
                  <Input
                    id="dc-pct"
                    inputMode="decimal"
                    value={discPercent}
                    onChange={(e) => setDiscPercent(e.target.value)}
                  />
                </Field>
              )}
              {discKind === "fixed" && (
                <Field>
                  <FieldLabel htmlFor="dc-amt">Valor (R$)</FieldLabel>
                  <Input
                    id="dc-amt"
                    inputMode="decimal"
                    value={discAmount}
                    onChange={(e) => setDiscAmount(e.target.value)}
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="dc-dur">Duração</FieldLabel>
                <NativeSelect
                  id="dc-dur"
                  className="w-full"
                  value={discDuration}
                  onChange={(e) => setDiscDuration(e.target.value as "once")}
                >
                  <NativeSelectOption value="once">Uma fatura</NativeSelectOption>
                  <NativeSelectOption value="repeating">Algumas faturas</NativeSelectOption>
                  <NativeSelectOption value="forever">Sempre</NativeSelectOption>
                </NativeSelect>
              </Field>
              {discDuration === "repeating" && (
                <Field>
                  <FieldLabel htmlFor="dc-cyc">Quantas faturas</FieldLabel>
                  <Input
                    id="dc-cyc"
                    type="number"
                    min={1}
                    value={discCycles}
                    onChange={(e) => setDiscCycles(e.target.value)}
                  />
                </Field>
              )}
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="dc-reason">Motivo</FieldLabel>
                <Input
                  id="dc-reason"
                  value={discReason}
                  onChange={(e) => setDiscReason(e.target.value)}
                />
              </Field>
            </div>
            <div>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      grantDiscountAction(establishmentId, subscription.id, {
                        name: discName,
                        kind: discKind,
                        percent: Number(discPercent.replace(",", ".")) || 0,
                        amount: discAmount,
                        duration: discDuration,
                        cycles: discDuration === "repeating" ? Number(discCycles) : null,
                        reason: discReason,
                      }),
                    "Desconto concedido.",
                  )
                }
              >
                Conceder desconto
              </Button>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
