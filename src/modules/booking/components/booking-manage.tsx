"use client";

import {
  CalendarPlusIcon,
  CheckCircle2Icon,
  CopyIcon,
  Loader2Icon,
  MessageCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatInTimeZone } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { whatsappLink } from "@/lib/phone";

import { cancelBookingAction, rescheduleBookingAction } from "../actions";
import { bookingShareText, buildIcs, formatAddress } from "../rules";
import type { PublicBooking } from "../types";
import { DateTimePicker } from "./date-time-picker";

const STATUS: Record<PublicBooking["status"], string> = {
  pending: "Aguardando confirmação",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

const pill =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors hover:bg-muted";

/** Gestão da reserva pelo cliente: calendário, WhatsApp, remarcar e cancelar (conforme a política). */
export function BookingManage({
  booking,
  token,
  isNew,
  url,
}: {
  booking: PublicBooking;
  token: string;
  isNew: boolean;
  url: string;
}) {
  const router = useRouter();
  const tz = booking.establishment.timezone;
  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const when = formatInTimeZone(booking.starts_at, "EEEE, d 'de' MMMM 'às' HH:mm", tz);
  const address = formatAddress(booking.establishment);
  const active = booking.status === "pending" || booking.status === "confirmed";

  function downloadIcs() {
    const ics = buildIcs({
      uid: `${booking.reference_code}@agenda`,
      title: `${booking.service_name} — ${booking.establishment.name}`,
      description: `Com ${booking.professional_name}. Código ${booking.reference_code}.\n${url}`,
      location: address,
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
    });
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `agendamento-${booking.reference_code}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function confirmReschedule() {
    if (!startsAt) return;
    startTransition(async () => {
      const result = await rescheduleBookingAction(token, startsAt);
      if (!result.ok) {
        toast.error(
          result.error.code === "SLOT_UNAVAILABLE"
            ? "Esse horário acabou de ser reservado. Escolha outro."
            : result.error.message,
        );
        setStartsAt(null);
        setReloadKey((k) => k + 1);
        return;
      }
      toast.success("Agendamento remarcado.");
      setRescheduling(false);
      setStartsAt(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5 px-4">
      {isNew && active && (
        <div className="flex flex-col items-center gap-2 pt-4 text-center" role="status">
          <CheckCircle2Icon className="size-12 text-[var(--brand)]" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">
            {booking.status === "pending" ? "Pedido enviado!" : "Agendamento confirmado!"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {booking.status === "pending"
              ? "O estabelecimento vai confirmar seu horário. Acompanhe por este link."
              : "Guarde este link: por ele você consulta, remarca ou cancela."}
          </p>
        </div>
      )}
      {!isNew && <h1 className="pt-4 text-2xl font-semibold tracking-tight">Seu agendamento</h1>}

      <div className="flex flex-col gap-3 rounded-2xl border p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">Código {booking.reference_code}</span>
          <span
            className="rounded-full bg-muted px-3 py-1 text-xs font-medium"
            data-testid="booking-status"
          >
            {STATUS[booking.status]}
          </span>
        </div>
        <p className="text-lg font-semibold first-letter:uppercase">{when}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Serviço</dt>
          <dd>
            {booking.service_name} · {formatCents(booking.price_cents)}
          </dd>
          <dt className="text-muted-foreground">Profissional</dt>
          <dd>{booking.professional_name}</dd>
          <dt className="text-muted-foreground">Local</dt>
          <dd>
            {booking.establishment.name}
            {address && <span className="block text-muted-foreground">{address}</span>}
          </dd>
          <dt className="text-muted-foreground">Nome</dt>
          <dd>{booking.customer_name}</dd>
        </dl>
      </div>

      {active && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" className={pill} onClick={downloadIcs}>
            <CalendarPlusIcon className="size-4" aria-hidden />
            Adicionar ao calendário
          </button>
          <a
            className={pill}
            href={whatsappLink(
              null,
              bookingShareText({
                establishmentName: booking.establishment.name,
                serviceName: booking.service_name,
                when,
                professionalName: booking.professional_name,
                referenceCode: booking.reference_code,
                url,
              }),
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircleIcon className="size-4" aria-hidden />
            Enviar para meu WhatsApp
          </a>
          <button
            type="button"
            className={`${pill} sm:col-span-2`}
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              toast.success("Link copiado.");
            }}
          >
            <CopyIcon className="size-4" aria-hidden />
            Copiar link da reserva
          </button>
        </div>
      )}

      {active && booking.can_reschedule && !rescheduling && (
        <button type="button" className={pill} onClick={() => setRescheduling(true)}>
          Remarcar
        </button>
      )}

      {rescheduling && (
        <section className="flex flex-col gap-4 rounded-2xl border p-4" aria-label="Remarcar">
          <h2 className="font-semibold">Escolha o novo horário</h2>
          <DateTimePicker
            slug={booking.establishment.slug}
            serviceId={booking.service_id}
            professionalId={booking.professional_id}
            timeZone={tz}
            maxDaysAhead={61}
            date={date}
            startsAt={startsAt}
            reloadKey={reloadKey}
            onDateChange={(d) => {
              setDate(d);
              setStartsAt(null);
            }}
            onSlotChange={setStartsAt}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!startsAt || pending}
              onClick={confirmReschedule}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-4 font-semibold text-[var(--brand-foreground)] disabled:opacity-50"
            >
              {pending && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
              Confirmar novo horário
            </button>
            <button type="button" className={pill} onClick={() => setRescheduling(false)}>
              Voltar
            </button>
          </div>
        </section>
      )}

      {active && booking.can_cancel && (
        <ConfirmDialog
          trigger={
            <button type="button" className="min-h-11 text-sm font-medium text-destructive">
              Cancelar agendamento
            </button>
          }
          title="Cancelar este agendamento?"
          description="O horário fica livre para outra pessoa. Essa ação não pode ser desfeita."
          confirmLabel="Cancelar agendamento"
          destructive
          onConfirm={async () => {
            const result = await cancelBookingAction(token, "");
            if (!result.ok) return result.error.message;
            toast.success("Agendamento cancelado.");
            router.refresh();
            return null;
          }}
        />
      )}

      {active && (!booking.can_cancel || !booking.can_reschedule) && (
        <p className="text-sm text-muted-foreground">
          {booking.change_notice_minutes > 0
            ? `Alterações pelo link são aceitas até ${Math.round(booking.change_notice_minutes / 60) || 1}h antes do horário. `
            : ""}
          Para outras mudanças, fale com o estabelecimento.
        </p>
      )}

      {booking.establishment.whatsapp_e164 && (
        <a
          className={pill}
          href={whatsappLink(
            booking.establishment.whatsapp_e164,
            `Olá! Sobre meu agendamento ${booking.reference_code} (${when}).`,
          )}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircleIcon className="size-4" aria-hidden />
          Falar com {booking.establishment.name}
        </a>
      )}

      {booking.status === "cancelled" && (
        <Link
          href={`/agendar/${booking.establishment.slug}`}
          className="flex min-h-11 items-center justify-center rounded-full bg-[var(--brand)] px-4 font-semibold text-[var(--brand-foreground)]"
        >
          Fazer novo agendamento
        </Link>
      )}
    </div>
  );
}
