import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { formatPhone } from "@/lib/phone";

import { effectiveInvoiceStatus, type InvoiceStatus } from "../rules";
import { CopyTextButton } from "./copy-text-button";
import { InvoiceStatusBadge } from "./invoice-status-badge";

type Invoice = {
  number: string | null;
  status: InvoiceStatus;
  due_date: string;
  original_due_date: string;
  period_start: string | null;
  period_end: string | null;
  issued_at: string | null;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  cancel_reason: string | null;
  payment_instructions: unknown;
  establishments: { name: string } | null;
  items: {
    id: string;
    description: string;
    quantity: number;
    unit_price_cents: number;
    amount_cents: number;
  }[];
};

type Instructions = {
  pix_key_type?: string;
  pix_key?: string;
  pix_receiver_name?: string;
  instructions?: string;
  support_whatsapp_e164?: string;
};

const dateOnly = (d: string) => formatDate(`${d}T12:00:00Z`, "UTC");

/** Fatura em tela/impressão. Documento interno de cobrança — sem valor fiscal (BILLING §1). */
export function InvoiceDocument({ invoice, today }: { invoice: Invoice; today: string }) {
  const status = effectiveInvoiceStatus(invoice.status, invoice.due_date, today);
  const instr = (invoice.payment_instructions ?? {}) as Instructions;
  const balance = Math.max(invoice.total_cents - invoice.amount_paid_cents, 0);

  return (
    <article
      className="flex flex-col gap-5 rounded-lg border bg-card p-5 print:border-0 print:p-0"
      aria-label="Fatura"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Fatura {invoice.number ?? "(rascunho)"}</h2>
          <p className="text-sm text-muted-foreground">{invoice.establishments?.name}</p>
          {invoice.period_start && invoice.period_end && (
            <p className="text-sm text-muted-foreground">
              Período: {dateOnly(invoice.period_start)} a {dateOnly(invoice.period_end)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 text-sm">
          <InvoiceStatusBadge status={status} />
          <span>
            Vencimento: <strong>{dateOnly(invoice.due_date)}</strong>
          </span>
          {invoice.due_date !== invoice.original_due_date && (
            <span className="text-xs text-muted-foreground">
              (prorrogada de {dateOnly(invoice.original_due_date)})
            </span>
          )}
        </div>
      </header>

      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="pb-2 font-normal">Descrição</th>
            <th className="pb-2 text-right font-normal">Valor</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((i) => (
            <tr key={i.id} className="border-t">
              <td className="py-2">{i.description}</td>
              <td className="py-2 text-right tabular-nums">{formatCents(i.amount_cents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {invoice.discount_cents > 0 && (
            <tr className="border-t text-muted-foreground">
              <td className="py-1.5">Subtotal</td>
              <td className="py-1.5 text-right tabular-nums">
                {formatCents(invoice.subtotal_cents)}
              </td>
            </tr>
          )}
          <tr className="border-t font-semibold">
            <td className="py-2">Total</td>
            <td className="py-2 text-right tabular-nums" data-testid="invoice-total">
              {formatCents(invoice.total_cents)}
            </td>
          </tr>
          {invoice.amount_paid_cents > 0 && (
            <>
              <tr className="text-muted-foreground">
                <td className="py-1">Pago</td>
                <td className="py-1 text-right tabular-nums">
                  {formatCents(invoice.amount_paid_cents)}
                </td>
              </tr>
              <tr>
                <td className="py-1">Saldo</td>
                <td className="py-1 text-right font-medium tabular-nums">{formatCents(balance)}</td>
              </tr>
            </>
          )}
        </tfoot>
      </table>

      {invoice.cancel_reason && (
        <p className="text-sm text-muted-foreground">Cancelada: {invoice.cancel_reason}</p>
      )}

      {status !== "paid" && status !== "canceled" && (instr.pix_key || instr.instructions) && (
        <section className="flex flex-col gap-2 rounded-md bg-muted/50 p-3 text-sm">
          <h3 className="font-medium">Como pagar</h3>
          {instr.pix_key && (
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Pix ({instr.pix_key_type?.toUpperCase()}):{" "}
                <strong className="break-all">{instr.pix_key}</strong>
                {instr.pix_receiver_name && ` · ${instr.pix_receiver_name}`}
              </span>
              <span className="print:hidden">
                <CopyTextButton text={instr.pix_key} label="Copiar chave Pix" />
              </span>
            </div>
          )}
          {instr.instructions && <p className="whitespace-pre-line">{instr.instructions}</p>}
          {instr.support_whatsapp_e164 && (
            <p>Suporte: {formatPhone(instr.support_whatsapp_e164)}</p>
          )}
        </section>
      )}

      <footer className="text-xs text-muted-foreground">
        {invoice.issued_at && `Emitida em ${formatDate(invoice.issued_at)}. `}
        Documento interno de cobrança — sem valor fiscal.
      </footer>
    </article>
  );
}
