"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatInTimeZone } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { getPanelSlotsAction, rescheduleAction } from "../actions";
import type { AppointmentDetail } from "../types";

/** Remarcar pelo painel: mesma validação do motor; falha mantém o horário original. */
export function RescheduleForm({
  slug,
  appointment,
  timeZone,
  professionals,
  onCancel,
  onDone,
}: {
  slug: string;
  appointment: AppointmentDetail;
  timeZone: string;
  professionals: { id: string; display_name: string }[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(formatInTimeZone(appointment.starts_at, "yyyy-MM-dd", timeZone));
  const [professionalId, setProfessionalId] = useState(appointment.professional_id);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [pending, startSave] = useTransition();

  useEffect(() => {
    let active = true;
    startLoad(async () => {
      const r = await getPanelSlotsAction(slug, {
        serviceId: appointment.service_id,
        professionalId,
        date,
      });
      if (active) setSlots(r.ok ? r.data : []);
    });
    return () => {
      active = false;
    };
  }, [slug, appointment.service_id, professionalId, date]);

  function save() {
    if (!startsAt) return;
    startSave(async () => {
      const r = await rescheduleAction(
        slug,
        appointment.id,
        startsAt,
        professionalId === appointment.professional_id ? null : professionalId,
        appointment.version,
        false,
      );
      if (!r.ok) {
        toast.error(r.error.message);
        setStartsAt(null);
        return;
      }
      onDone();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap gap-3">
        <Field className="w-auto">
          <FieldLabel htmlFor="rs-date">Nova data</FieldLabel>
          <Input id="rs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {professionals.length > 1 && (
          <Field className="w-auto">
            <FieldLabel htmlFor="rs-pro">Profissional</FieldLabel>
            <NativeSelect
              id="rs-pro"
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
            >
              {professionals.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.display_name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
      </div>
      {loading || slots === null ? (
        <span className="flex items-center gap-2 text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" aria-hidden /> Buscando horários…
        </span>
      ) : slots.length === 0 ? (
        <span className="text-muted-foreground">Nenhum horário livre nessa data.</span>
      ) : (
        <ul className="flex max-h-40 flex-wrap gap-2 overflow-y-auto" aria-label="Novos horários">
          {slots.map((t) => (
            <li key={t}>
              <button
                type="button"
                aria-pressed={t === startsAt}
                onClick={() => setStartsAt(t)}
                className={cn(
                  "rounded-md border px-3 py-1.5 tabular-nums",
                  t === startsAt
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                {formatInTimeZone(t, "HH:mm", timeZone)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Button onClick={save} disabled={!startsAt || pending}>
          {pending && <Loader2Icon className="animate-spin" aria-hidden />}
          Confirmar remarcação
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
