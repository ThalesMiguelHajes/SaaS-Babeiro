"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { updateBillingSettingsAction } from "../actions";
import { PIX_KEY_TYPES } from "../rules";

/** Instruções de pagamento copiadas para cada fatura no momento da emissão (BILLING §10.2). */
export function BillingSettingsForm({
  defaults,
}: {
  defaults: {
    pixKeyType: string;
    pixKey: string;
    pixReceiverName: string;
    instructions: string;
    supportWhatsapp: string;
    setupFee: string;
  };
}) {
  const router = useRouter();
  const [v, setV] = useState(defaults);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <FormAlert message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="bs-type">Tipo de chave Pix</FieldLabel>
          <NativeSelect
            id="bs-type"
            className="w-full"
            value={v.pixKeyType}
            onChange={set("pixKeyType")}
          >
            <NativeSelectOption value="">—</NativeSelectOption>
            {PIX_KEY_TYPES.map((t) => (
              <NativeSelectOption key={t.value} value={t.value}>
                {t.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="bs-key">Chave Pix</FieldLabel>
          <Input id="bs-key" value={v.pixKey} onChange={set("pixKey")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="bs-name">Nome do recebedor</FieldLabel>
          <Input id="bs-name" value={v.pixReceiverName} onChange={set("pixReceiverName")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="bs-wa">WhatsApp do suporte</FieldLabel>
          <Input
            id="bs-wa"
            type="tel"
            placeholder="(11) 91234-5678"
            value={v.supportWhatsapp}
            onChange={set("supportWhatsapp")}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="bs-setup">Implantação padrão (R$)</FieldLabel>
          <Input id="bs-setup" inputMode="decimal" value={v.setupFee} onChange={set("setupFee")} />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="bs-instr">Instruções de pagamento</FieldLabel>
        <Textarea id="bs-instr" rows={3} value={v.instructions} onChange={set("instructions")} />
        <FieldDescription>
          Aparecem nas faturas emitidas a partir de agora. Faturas antigas mantêm as instruções da
          época.
        </FieldDescription>
      </Field>
      <div>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await updateBillingSettingsAction({ ...v, pixKeyType: v.pixKeyType as "" });
              if (!r.ok) setError(r.error.message);
              else {
                toast.success("Configurações salvas.");
                router.refresh();
              }
            })
          }
        >
          {pending && <Loader2Icon className="animate-spin" aria-hidden />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
