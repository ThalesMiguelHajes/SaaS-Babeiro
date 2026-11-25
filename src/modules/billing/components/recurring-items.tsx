"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatCents } from "@/lib/money";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { addRecurringItemAction, applyCouponAction, endRecurringItemAction } from "../actions";

type Item = {
  id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  starts_on: string;
  ends_on: string | null;
};
type AddOn = {
  id: string;
  name: string;
  price_cents: number | null;
  billing_type: string;
  is_technically_available: boolean;
};

const br = (d: string) => d.split("-").reverse().join("/");

/** Adicionais recorrentes da assinatura (entram em todas as faturas enquanto vigentes) e cupom. */
export function RecurringItems({
  establishmentId,
  subscriptionId,
  items,
  addOns,
  today,
}: {
  establishmentId: string;
  subscriptionId: string;
  items: Item[];
  addOns: AddOn[];
  today: string;
}) {
  const router = useRouter();
  const recurring = addOns.filter((a) => a.billing_type === "recurring" && a.id);
  const [addOnId, setAddOnId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [startsOn, setStartsOn] = useState(today);
  const [coupon, setCoupon] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(
    fn: () => Promise<{ ok: boolean; error?: { message: string } }>,
    message: string,
    after?: () => void,
  ) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error?.message ?? "Erro");
      else {
        toast.success(message);
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <FormAlert message={error} />
      <ul className="flex flex-col divide-y rounded-lg border text-sm">
        {items.length === 0 && (
          <li className="px-3 py-2 text-muted-foreground">Nenhum adicional recorrente.</li>
        )}
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span
              className={
                i.ends_on && i.ends_on <= today
                  ? "flex-1 text-muted-foreground line-through"
                  : "flex-1"
              }
            >
              {i.description} · {i.quantity} × {formatCents(i.unit_price_cents)} · desde{" "}
              {br(i.starts_on)}
              {i.ends_on && ` · até ${br(i.ends_on)}`}
            </span>
            {!i.ends_on && (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="ghost">
                    Encerrar
                  </Button>
                }
                title="Encerrar este adicional?"
                description="Deixa de entrar nas faturas a partir de hoje. Faturas já emitidas não mudam."
                confirmLabel="Encerrar"
                requireReason
                onConfirm={async (reason) => {
                  // Termina hoje; se o adicional ainda nem começou, no dia seguinte ao início.
                  const next = new Date(`${i.starts_on}T12:00:00Z`);
                  next.setUTCDate(next.getUTCDate() + 1);
                  const end = today > i.starts_on ? today : next.toISOString().slice(0, 10);
                  const r = await endRecurringItemAction(establishmentId, i.id, end, reason);
                  if (!r.ok) return r.error.message;
                  toast.success("Adicional encerrado.");
                  router.refresh();
                  return null;
                }}
              />
            )}
          </li>
        ))}
      </ul>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="ri-addon">Serviço recorrente</FieldLabel>
          <NativeSelect
            id="ri-addon"
            className="w-full"
            value={addOnId}
            onChange={(e) => {
              setAddOnId(e.target.value);
              const a = recurring.find((x) => x.id === e.target.value);
              if (a) {
                setDescription(a.name);
                if (a.price_cents !== null)
                  setPrice((a.price_cents / 100).toFixed(2).replace(".", ","));
              }
            }}
          >
            <NativeSelectOption value="">Outro</NativeSelectOption>
            {recurring.map((a) => (
              <NativeSelectOption key={a.id} value={a.id}>
                {a.name}
                {!a.is_technically_available && " (projeto — integração ainda não disponível)"}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="ri-desc">Descrição na fatura</FieldLabel>
          <Input
            id="ri-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="ri-qty">Quantidade</FieldLabel>
          <Input
            id="ri-qty"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="ri-price">Valor mensal (R$)</FieldLabel>
          <Input
            id="ri-price"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="ri-start">Início</FieldLabel>
          <Input
            id="ri-start"
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
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
                addRecurringItemAction(establishmentId, subscriptionId, {
                  addOnId: addOnId || null,
                  description,
                  quantity: Number(quantity) || 1,
                  unitPrice: price,
                  startsOn,
                }),
              "Adicional incluído nas próximas faturas.",
            )
          }
        >
          Adicionar recorrente
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t pt-4">
        <Field className="w-auto">
          <FieldLabel htmlFor="ri-coupon">Aplicar cupom</FieldLabel>
          <Input
            id="ri-coupon"
            placeholder="CÓDIGO"
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
          />
        </Field>
        <Button
          variant="outline"
          disabled={pending || coupon.trim().length < 3}
          onClick={() =>
            run(
              () => applyCouponAction(establishmentId, subscriptionId, coupon),
              "Cupom aplicado.",
              () => setCoupon(""),
            )
          }
        >
          Aplicar
        </Button>
      </div>
    </div>
  );
}
