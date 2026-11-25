"use client";

import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatCents, parseBrlToCents } from "@/lib/money";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { PAYMENT_METHODS } from "../rules";
import { completeSchema, recordPaymentSchema } from "../schemas";

type Line = { amount: string; method: string; notes: string };

const centsToInput = (c: number) => (c / 100).toFixed(2).replace(".", ",");

/**
 * Concluir atendimento (valor cobrado + recebimentos) ou registrar um pagamento depois (D19).
 * Aceita mais de uma forma de pagamento. Não processa pagamento: é o registro do que entrou no caixa.
 */
export function PaymentForm({
  mode,
  defaultCents,
  canRecordPayment,
  pending,
  onSubmit,
  onCancel,
}: {
  mode: "complete" | "record";
  defaultCents: number;
  canRecordPayment: boolean;
  pending: boolean;
  onSubmit: (data: { finalPrice: string; payments: Line[] }) => void;
  onCancel: () => void;
}) {
  const [finalPrice, setFinalPrice] = useState(centsToInput(defaultCents));
  const [lines, setLines] = useState<Line[]>(
    canRecordPayment ? [{ amount: centsToInput(defaultCents), method: "pix", notes: "" }] : [],
  );
  const [error, setError] = useState<string | null>(null);

  const total = lines.reduce((sum, l) => sum + (parseBrlToCents(l.amount) ?? 0), 0);
  const charged = parseBrlToCents(finalPrice) ?? 0;

  function submit() {
    const check =
      mode === "complete"
        ? completeSchema.safeParse({ finalPrice, payments: lines })
        : recordPaymentSchema.safeParse(lines[0]);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "Confira os valores.");
      return;
    }
    setError(null);
    onSubmit({ finalPrice, payments: lines });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-3">
      <FormAlert message={error} />
      {mode === "complete" && (
        <Field>
          <FieldLabel htmlFor="pf-final">Valor cobrado</FieldLabel>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">R$</span>
            <Input
              id="pf-final"
              inputMode="decimal"
              className="w-32"
              value={finalPrice}
              onChange={(e) => setFinalPrice(e.target.value)}
            />
          </div>
        </Field>
      )}

      {lines.map((l, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <Field className="w-auto">
            <FieldLabel htmlFor={`pf-amount-${i}`}>
              {i === 0 ? "Recebido" : "Mais um pagamento"}
            </FieldLabel>
            <Input
              id={`pf-amount-${i}`}
              inputMode="decimal"
              className="w-28"
              value={l.amount}
              onChange={(e) =>
                setLines((prev) =>
                  prev.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)),
                )
              }
            />
          </Field>
          <Field className="w-auto">
            <FieldLabel htmlFor={`pf-method-${i}`}>Forma</FieldLabel>
            <NativeSelect
              id={`pf-method-${i}`}
              value={l.method}
              onChange={(e) =>
                setLines((prev) =>
                  prev.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)),
                )
              }
            >
              {PAYMENT_METHODS.map((m) => (
                <NativeSelectOption key={m.value} value={m.value}>
                  {m.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {mode === "complete" && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remover pagamento ${i + 1}`}
              onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
            >
              <Trash2Icon aria-hidden />
            </Button>
          )}
        </div>
      ))}

      {mode === "complete" && canRecordPayment && lines.length < 5 && (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                { amount: centsToInput(Math.max(charged - total, 0)), method: "cash", notes: "" },
              ])
            }
          >
            <PlusIcon aria-hidden />
            Dividir pagamento
          </Button>
        </div>
      )}

      {mode === "complete" && (
        <p className="text-sm text-muted-foreground">
          {lines.length === 0
            ? canRecordPayment
              ? 'Sem pagamento agora: fica em "concluídos sem pagamento" até alguém registrar.'
              : "O registro de pagamentos é feito pela administração."
            : total < charged
              ? `Falta registrar ${formatCents(charged - total)}.`
              : total > charged
                ? `Recebido ${formatCents(total - charged)} a mais (gorjeta/extra).`
                : "Valor recebido confere com o cobrado."}
        </p>
      )}

      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" aria-hidden />}
          {mode === "complete"
            ? lines.length
              ? "Concluir e registrar"
              : "Concluir"
            : "Registrar pagamento"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
