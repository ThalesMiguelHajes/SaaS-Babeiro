"use client";

import { Loader2Icon, MessageCircleIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatInTimeZone } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { cn } from "@/lib/utils";

import {
  completeAction,
  getAppointmentDetailAction,
  recordPaymentAction,
  updateStatusAction,
  voidPaymentAction,
} from "../actions";
import { STATUS_LABEL, STATUS_TONE, availableActions, paymentMethodLabel } from "../rules";
import type { AppointmentDetail } from "../types";
import { PaymentForm } from "./payment-form";
import { RescheduleForm } from "./reschedule-form";

const EVENT_LABEL: Record<string, string> = {
  created: "Criado",
  status_changed: "Situação alterada",
  rescheduled: "Remarcado",
  updated: "Alterado",
  cancelled: "Cancelado",
};
const ACTOR_LABEL: Record<string, string> = {
  customer: "cliente",
  member: "equipe",
  platform_admin: "plataforma",
  system: "sistema",
};

/** Painel lateral do agendamento: dados, ações válidas, recebimentos e histórico (E6-4, E6-4b). */
export function AppointmentSheet({
  slug,
  appointmentId,
  timeZone,
  isAdmin,
  canRecordPayment,
  professionals,
  onClose,
  onChanged,
}: {
  slug: string;
  appointmentId: string | null;
  timeZone: string;
  isAdmin: boolean;
  canRecordPayment: boolean;
  professionals: { id: string; display_name: string }[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [mode, setMode] = useState<"view" | "complete" | "record" | "reschedule">("view");
  const [reload, setReload] = useState(0);
  const [loading, startLoad] = useTransition();
  const [pending, startAction] = useTransition();

  useEffect(() => {
    if (!appointmentId) return;
    let active = true;
    startLoad(async () => {
      const r = await getAppointmentDetailAction(slug, appointmentId);
      if (!active) return;
      if (r.ok) setDetail(r.data);
      else toast.error(r.error.message);
    });
    return () => {
      active = false;
    };
  }, [slug, appointmentId, reload]);

  function done(message: string) {
    toast.success(message);
    setMode("view");
    setReload((n) => n + 1);
    onChanged();
  }

  function run(fn: () => Promise<{ ok: boolean; error?: { message: string } }>, message: string) {
    startAction(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error?.message ?? "Erro");
        setReload((n) => n + 1);
        return;
      }
      done(message);
    });
  }

  const d = detail && detail.id === appointmentId ? detail : null;
  const actions = d ? availableActions(d.status, d.starts_at, new Date(), canRecordPayment) : [];
  const charged = d ? (d.final_price_cents ?? d.price_cents) : 0;
  const paid = d
    ? d.payments.filter((p) => !p.voided_at).reduce((s, p) => s + p.amount_cents, 0)
    : 0;

  return (
    <Sheet open={appointmentId !== null} onOpenChange={(o) => !o && (setMode("view"), onClose())}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{d ? d.customer_name : "Agendamento"}</SheetTitle>
          <SheetDescription>
            {d
              ? `${formatInTimeZone(d.starts_at, "EEEE, dd/MM 'às' HH:mm", timeZone)} · código ${d.reference_code}`
              : "Carregando…"}
          </SheetDescription>
        </SheetHeader>

        {!d || loading ? (
          <div className="flex items-center gap-2 px-4 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" aria-hidden /> Carregando…
          </div>
        ) : (
          <div className="flex flex-col gap-5 px-4 pb-6 text-sm">
            <span
              className={cn(
                "w-fit rounded-full border px-3 py-1 text-xs font-medium",
                STATUS_TONE[d.status],
              )}
            >
              {STATUS_LABEL[d.status]}
            </span>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              <dt className="text-muted-foreground">Serviço</dt>
              <dd>
                {d.service_name} · {d.duration_minutes} min · {formatCents(d.price_cents)}
              </dd>
              <dt className="text-muted-foreground">Profissional</dt>
              <dd>
                {d.professional_name}
                {d.professional_auto_assigned && (
                  <span className="text-muted-foreground"> (atribuído)</span>
                )}
              </dd>
              {d.customer_phone && (
                <>
                  <dt className="text-muted-foreground">WhatsApp</dt>
                  <dd>
                    <a
                      href={whatsappLink(
                        d.customer_phone,
                        `Olá, ${d.customer_name.split(" ")[0]}! Sobre seu horário de ${formatInTimeZone(d.starts_at, "dd/MM 'às' HH:mm", timeZone)}.`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline underline-offset-4"
                    >
                      <MessageCircleIcon className="size-4" aria-hidden />
                      {formatPhone(d.customer_phone)}
                    </a>
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Origem</dt>
              <dd>
                {d.source === "public_page" ? "Página de agendamento" : "Painel"}
                {d.outside_working_hours && " · encaixe"}
              </dd>
              {d.customer_notes && (
                <>
                  <dt className="text-muted-foreground">Obs. do cliente</dt>
                  <dd className="whitespace-pre-line">{d.customer_notes}</dd>
                </>
              )}
              {d.internal_notes && (
                <>
                  <dt className="text-muted-foreground">Obs. interna</dt>
                  <dd className="whitespace-pre-line">{d.internal_notes}</dd>
                </>
              )}
              {d.cancellation_reason && (
                <>
                  <dt className="text-muted-foreground">Motivo</dt>
                  <dd>{d.cancellation_reason}</dd>
                </>
              )}
            </dl>

            {mode === "view" && actions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {actions.includes("confirm") && (
                  <Button
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => updateStatusAction(slug, d.id, "confirmed", "", d.version),
                        "Agendamento confirmado.",
                      )
                    }
                  >
                    Confirmar
                  </Button>
                )}
                {actions.includes("complete") && (
                  <Button disabled={pending} onClick={() => setMode("complete")}>
                    Concluir atendimento
                  </Button>
                )}
                {actions.includes("start") && (
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => updateStatusAction(slug, d.id, "in_progress", "", d.version),
                        "Atendimento iniciado.",
                      )
                    }
                  >
                    Iniciar
                  </Button>
                )}
                {actions.includes("record_payment") && (
                  <Button variant="outline" disabled={pending} onClick={() => setMode("record")}>
                    Registrar pagamento
                  </Button>
                )}
                {actions.includes("reschedule") && (
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => setMode("reschedule")}
                  >
                    Remarcar
                  </Button>
                )}
                {actions.includes("no_show") && (
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => updateStatusAction(slug, d.id, "no_show", "", d.version),
                        "Marcado como falta.",
                      )
                    }
                  >
                    Não compareceu
                  </Button>
                )}
                {actions.includes("cancel") && (
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" className="text-destructive">
                        Cancelar
                      </Button>
                    }
                    title="Cancelar este agendamento?"
                    description="O horário fica livre. O cliente não é avisado automaticamente."
                    confirmLabel="Cancelar agendamento"
                    destructive
                    requireReason
                    onConfirm={async (reason) => {
                      const r = await updateStatusAction(
                        slug,
                        d.id,
                        "cancelled",
                        reason,
                        d.version,
                      );
                      if (!r.ok) return r.error.message;
                      done("Agendamento cancelado.");
                      return null;
                    }}
                  />
                )}
              </div>
            )}

            {mode === "complete" && (
              <PaymentForm
                mode="complete"
                defaultCents={d.price_cents}
                canRecordPayment={canRecordPayment}
                pending={pending}
                onCancel={() => setMode("view")}
                onSubmit={(data) =>
                  run(() => completeAction(slug, d.id, data, d.version), "Atendimento concluído.")
                }
              />
            )}
            {mode === "record" && (
              <PaymentForm
                mode="record"
                defaultCents={Math.max(charged - paid, 0) || charged}
                canRecordPayment
                pending={pending}
                onCancel={() => setMode("view")}
                onSubmit={(data) =>
                  run(
                    () => recordPaymentAction(slug, d.id, data.payments[0]!),
                    "Pagamento registrado.",
                  )
                }
              />
            )}
            {mode === "reschedule" && (
              <RescheduleForm
                slug={slug}
                appointment={d}
                timeZone={timeZone}
                professionals={isAdmin ? professionals : []}
                onCancel={() => setMode("view")}
                onDone={() => done("Agendamento remarcado.")}
              />
            )}

            {(d.status === "completed" || d.status === "in_progress" || d.payments.length > 0) && (
              <section className="flex flex-col gap-2">
                <h3 className="font-medium">Recebimentos</h3>
                <p className="text-muted-foreground">
                  Cobrado {formatCents(charged)} · Recebido {formatCents(paid)}
                  {paid < charged &&
                    d.status === "completed" &&
                    ` · falta ${formatCents(charged - paid)}`}
                </p>
                <ul className="flex flex-col divide-y rounded-md border">
                  {d.payments.length === 0 && (
                    <li className="px-3 py-2 text-muted-foreground">
                      Nenhum pagamento registrado.
                    </li>
                  )}
                  {d.payments.map((p) => (
                    <li
                      key={p.id}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2",
                        p.voided_at && "text-muted-foreground",
                      )}
                    >
                      <span className={cn("flex-1", p.voided_at && "line-through")}>
                        {formatCents(p.amount_cents)} · {paymentMethodLabel(p.method)} ·{" "}
                        {formatInTimeZone(p.received_at, "dd/MM HH:mm", timeZone)}
                      </span>
                      {p.voided_at ? (
                        <span className="text-xs">Anulado: {p.void_reason}</span>
                      ) : (
                        canRecordPayment && (
                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" size="sm">
                                Anular
                              </Button>
                            }
                            title="Anular este pagamento?"
                            description="O lançamento continua no histórico, marcado como anulado."
                            confirmLabel="Anular"
                            destructive
                            requireReason
                            onConfirm={async (reason) => {
                              const r = await voidPaymentAction(slug, p.id, reason);
                              if (!r.ok) return r.error.message;
                              done("Pagamento anulado.");
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

            <section className="flex flex-col gap-2">
              <h3 className="font-medium">Histórico</h3>
              <ol className="flex flex-col gap-1.5 text-muted-foreground">
                {d.events.map((e) => (
                  <li key={e.id}>
                    {formatInTimeZone(e.created_at, "dd/MM HH:mm", timeZone)} —{" "}
                    {EVENT_LABEL[e.event_type] ?? e.event_type}
                    {e.to_status &&
                      e.event_type === "status_changed" &&
                      `: ${STATUS_LABEL[e.to_status]}`}
                    {e.new_starts_at &&
                      e.event_type === "rescheduled" &&
                      ` para ${formatInTimeZone(e.new_starts_at, "dd/MM HH:mm", timeZone)}`}
                    {` (${ACTOR_LABEL[e.actor_type] ?? e.actor_type})`}
                    {e.note && ` · ${e.note}`}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
