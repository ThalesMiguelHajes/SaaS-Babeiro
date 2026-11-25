"use client";

import { Loader2Icon, MessageCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatCents } from "@/lib/money";
import { whatsappLink } from "@/lib/phone";
import { FormAlert } from "@/modules/auth/components/form-alert";

import {
  cancelInvoiceAction,
  extendDueDateAction,
  recordPaymentAction,
  reversePaymentAction,
} from "../actions";
import { BILLING_METHODS, billingMethodLabel, isPayable, type InvoiceStatus } from "../rules";

type Allocation = {
  id: string;
  amount_cents: number;
  payments: {
    id: string;
    method: string;
    received_on: string;
    status: string;
    reference: string | null;
    reverse_reason: string | null;
  } | null;
};

/** Ações do Super Admin sobre uma fatura: registrar pagamento, prorrogar, cancelar, cobrar pelo WhatsApp. */
export function InvoiceAdminActions({
  invoice,
  allocations,
  whatsappText,
  ownerWhatsapp,
  today,
}: {
  invoice: {
    id: string;
    establishment_id: string;
    status: InvoiceStatus;
    total_cents: number;
    amount_paid_cents: number;
    due_date: string;
  };
  allocations: Allocation[];
  whatsappText: string;
  ownerWhatsapp: string | null;
  today: string;
}) {
  const router = useRouter();
  const balance = Math.max(invoice.total_cents - invoice.amount_paid_cents, 0);
  const [amount, setAmount] = useState((balance / 100).toFixed(2).replace(".", ","));
  const [method, setMethod] = useState("pix");
  const [receivedOn, setReceivedOn] = useState(today);
  const [reference, setReference] = useState("");
  const [newDue, setNewDue] = useState(invoice.due_date);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function after(message: string) {
    toast.success(message);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {isPayable(invoice.status) && (
        <section className="flex flex-col gap-3 rounded-lg border p-4">
          <h3 className="font-medium">Registrar pagamento recebido</h3>
          <FormAlert message={error} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="pay-amount">Valor (R$)</FieldLabel>
              <Input
                id="pay-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pay-method">Forma</FieldLabel>
              <NativeSelect
                id="pay-method"
                className="w-full"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {BILLING_METHODS.map((m) => (
                  <NativeSelectOption key={m.value} value={m.value}>
                    {m.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="pay-date">Recebido em</FieldLabel>
              <Input
                id="pay-date"
                type="date"
                value={receivedOn}
                onChange={(e) => setReceivedOn(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pay-ref">Referência (opcional)</FieldLabel>
              <Input
                id="pay-ref"
                placeholder="ID do Pix, final do cartão…"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
          </div>
          <div>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await recordPaymentAction(invoice.establishment_id, invoice.id, {
                    amount,
                    method: method as "pix",
                    receivedOn,
                    reference,
                  });
                  if (!r.ok) setError(r.error.message);
                  else after("Pagamento registrado.");
                })
              }
            >
              {pending && <Loader2Icon className="animate-spin" aria-hidden />}
              Registrar pagamento
            </Button>
          </div>
        </section>
      )}

      {isPayable(invoice.status) && (
        <div className="flex flex-wrap items-end gap-2">
          <Button variant="outline" asChild>
            <a
              href={whatsappLink(ownerWhatsapp, whatsappText)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircleIcon aria-hidden />
              Enviar cobrança pelo WhatsApp
            </a>
          </Button>
          <Field className="w-auto">
            <FieldLabel htmlFor="new-due">Prorrogar para</FieldLabel>
            <Input
              id="new-due"
              type="date"
              min={invoice.due_date}
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
            />
          </Field>
          <ConfirmDialog
            trigger={
              <Button variant="outline" disabled={newDue === invoice.due_date}>
                Prorrogar
              </Button>
            }
            title="Prorrogar o vencimento?"
            description="O vencimento original fica registrado."
            confirmLabel="Prorrogar"
            requireReason
            onConfirm={async (reason) => {
              const r = await extendDueDateAction(invoice.id, newDue, reason);
              if (!r.ok) return r.error.message;
              after("Vencimento prorrogado.");
              return null;
            }}
          />
          {invoice.amount_paid_cents === 0 && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" className="text-destructive">
                  Cancelar fatura
                </Button>
              }
              title="Cancelar esta fatura?"
              description="A fatura fica no histórico como cancelada. Cobranças avulsas voltam a ficar pendentes e o ciclo pode ser gerado de novo."
              confirmLabel="Cancelar fatura"
              destructive
              requireReason
              onConfirm={async (reason) => {
                const r = await cancelInvoiceAction(invoice.id, reason);
                if (!r.ok) return r.error.message;
                after("Fatura cancelada.");
                return null;
              }}
            />
          )}
        </div>
      )}

      {allocations.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="font-medium">Pagamentos desta fatura</h3>
          <ul className="flex flex-col divide-y rounded-lg border text-sm">
            {allocations.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span
                  className={a.payments?.status === "reversed" ? "flex-1 line-through" : "flex-1"}
                >
                  {formatCents(a.amount_cents)} · {billingMethodLabel(a.payments?.method ?? "")} ·{" "}
                  {a.payments?.received_on.split("-").reverse().join("/")}
                  {a.payments?.reference && ` · ${a.payments.reference}`}
                </span>
                {a.payments?.status === "reversed" ? (
                  <span className="text-xs text-muted-foreground">
                    Revertido: {a.payments.reverse_reason}
                  </span>
                ) : (
                  a.payments && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="sm">
                          Reverter
                        </Button>
                      }
                      title="Reverter este pagamento?"
                      description="O lançamento fica no histórico como revertido e a fatura é recalculada. Registre o valor correto em seguida, se for o caso."
                      confirmLabel="Reverter"
                      destructive
                      requireReason
                      onConfirm={async (reason) => {
                        const r = await reversePaymentAction(a.payments!.id, reason);
                        if (!r.ok) return r.error.message;
                        after("Pagamento revertido.");
                        return null;
                      }}
                    />
                  )
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
