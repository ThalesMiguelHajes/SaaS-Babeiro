"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { createCouponAction, setCouponActiveAction } from "../actions";

/** Cupom reutilizável: código único, validade e limite de resgates (BILLING §6.2). */
export function CouponForm() {
  const router = useRouter();
  const [v, setV] = useState({
    code: "",
    name: "",
    kind: "percent" as "percent" | "fixed" | "free",
    percent: "10",
    amount: "",
    duration: "once" as "once" | "repeating" | "forever",
    cycles: "3",
    validUntil: "",
    maxRedemptions: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="flex flex-col gap-3">
      <FormAlert message={error} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="cp-code">Código</FieldLabel>
          <Input id="cp-code" placeholder="BEMVINDO10" value={v.code} onChange={set("code")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="cp-name">Nome</FieldLabel>
          <Input id="cp-name" value={v.name} onChange={set("name")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="cp-kind">Tipo</FieldLabel>
          <NativeSelect id="cp-kind" className="w-full" value={v.kind} onChange={set("kind")}>
            <NativeSelectOption value="percent">Percentual</NativeSelectOption>
            <NativeSelectOption value="fixed">Valor fixo</NativeSelectOption>
            <NativeSelectOption value="free">Mensalidade gratuita</NativeSelectOption>
          </NativeSelect>
        </Field>
        {v.kind === "percent" && (
          <Field>
            <FieldLabel htmlFor="cp-pct">Percentual (%)</FieldLabel>
            <Input id="cp-pct" inputMode="decimal" value={v.percent} onChange={set("percent")} />
          </Field>
        )}
        {v.kind === "fixed" && (
          <Field>
            <FieldLabel htmlFor="cp-amt">Valor (R$)</FieldLabel>
            <Input id="cp-amt" inputMode="decimal" value={v.amount} onChange={set("amount")} />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="cp-dur">Duração</FieldLabel>
          <NativeSelect
            id="cp-dur"
            className="w-full"
            value={v.duration}
            onChange={set("duration")}
          >
            <NativeSelectOption value="once">Uma fatura</NativeSelectOption>
            <NativeSelectOption value="repeating">Algumas faturas</NativeSelectOption>
            <NativeSelectOption value="forever">Sempre</NativeSelectOption>
          </NativeSelect>
        </Field>
        {v.duration === "repeating" && (
          <Field>
            <FieldLabel htmlFor="cp-cyc">Quantas faturas</FieldLabel>
            <Input id="cp-cyc" type="number" min={1} value={v.cycles} onChange={set("cycles")} />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="cp-until">Válido até (opcional)</FieldLabel>
          <Input id="cp-until" type="date" value={v.validUntil} onChange={set("validUntil")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="cp-max">Limite de usos (opcional)</FieldLabel>
          <Input
            id="cp-max"
            inputMode="numeric"
            value={v.maxRedemptions}
            onChange={set("maxRedemptions")}
          />
        </Field>
      </div>
      <div>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await createCouponAction({
                ...v,
                percent: Number(v.percent.replace(",", ".")) || 0,
                cycles: v.duration === "repeating" ? Number(v.cycles) : null,
              });
              if (!r.ok) setError(r.error.message);
              else {
                toast.success("Cupom criado.");
                setV((p) => ({ ...p, code: "", name: "" }));
                router.refresh();
              }
            })
          }
        >
          Criar cupom
        </Button>
      </div>
    </div>
  );
}

export function CouponToggle({ couponId, active }: { couponId: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await setCouponActiveAction(couponId, !active);
          if (!r.ok) toast.error(r.error.message);
          else router.refresh();
        })
      }
    >
      {active ? "Desativar" : "Reativar"}
    </Button>
  );
}
