"use client";

import { MessageCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import { whatsappLink } from "@/lib/phone";

import { markNotificationAction } from "../actions";
import type { Collection } from "../queries";
import { dunningStageLabel, invoiceWhatsappMessage } from "../rules";

/**
 * "Cobranças do dia": a régua prepara a mensagem; o envio é feito por você no WhatsApp e o
 * sistema registra que foi enviado (sem integração automática).
 */
export function CollectionsList({ items, appUrl }: { items: Collection[]; appUrl: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const mark = (id: string, status: "sent" | "dismissed") =>
    start(async () => {
      const r = await markNotificationAction(id, status);
      if (!r.ok) toast.error(r.error.message);
      else {
        if (status === "sent") toast.success("Envio registrado.");
        router.refresh();
      }
    });

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma cobrança para enviar hoje.</p>;
  }

  return (
    <ul className="flex flex-col divide-y text-sm">
      {items.map((c) => {
        const text = invoiceWhatsappMessage({
          establishmentName: c.establishment_name,
          number: c.number,
          totalLabel: formatCents(c.balance_cents),
          dueLabel: c.due_date.split("-").reverse().join("/"),
          pixKey: c.pix_key,
          pixReceiver: c.pix_receiver_name,
          url: `${appUrl}/painel/${c.slug}/assinatura/faturas/${c.invoice_id}`,
        });
        return (
          <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="flex flex-1 flex-col">
              <Link
                href={`/admin/financeiro/faturas/${c.invoice_id}`}
                className="font-medium hover:underline"
              >
                {c.establishment_name} · {c.number}
              </Link>
              <span
                className={
                  c.days_from_due > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                }
              >
                {dunningStageLabel(c.days_from_due)} · {formatCents(c.balance_cents)}
              </span>
            </span>
            <Button size="sm" asChild>
              <a
                href={whatsappLink(c.whatsapp_e164, text)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => mark(c.id, "sent")}
              >
                <MessageCircleIcon aria-hidden />
                Enviar pelo WhatsApp
              </a>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => mark(c.id, "dismissed")}
            >
              Dispensar
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
