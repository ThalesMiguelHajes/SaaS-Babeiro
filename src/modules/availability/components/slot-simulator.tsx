"use client";

import { Loader2Icon, SearchIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatInTimeZone } from "@/lib/dates";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { getAvailableSlotsAction } from "../actions";
import { groupSlotsByPeriod, type Slot } from "../rules";

/**
 * Consulta os horários livres calculados pelo motor (o mesmo que valida as reservas).
 * Visão da equipe: ignora antecedência mínima e limite de dias à frente.
 */
export function SlotSimulator({
  slug,
  services,
  professionals,
  today,
  timeZone,
  fixedProfessionalId = null,
}: {
  slug: string;
  services: { id: string; name: string; duration_minutes: number }[];
  professionals: { id: string; display_name: string }[];
  today: string;
  timeZone: string;
  fixedProfessionalId?: string | null;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [professionalId, setProfessionalId] = useState<string>(fixedProfessionalId ?? "");
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const names = new Map(professionals.map((p) => [p.id, p.display_name]));

  function search() {
    setError(null);
    startTransition(async () => {
      const result = await getAvailableSlotsAction(slug, {
        serviceId,
        professionalId: professionalId || null,
        date,
      });
      if (!result.ok) {
        setError(result.error.message);
        setSlots(null);
        return;
      }
      setSlots(result.data);
    });
  }

  if (services.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Cadastre um serviço e escolha quem o realiza para consultar os horários.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <Field>
          <FieldLabel htmlFor="sim-service">Serviço</FieldLabel>
          <NativeSelect
            id="sim-service"
            className="w-full"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            {services.map((s) => (
              <NativeSelectOption key={s.id} value={s.id}>
                {s.name} ({s.duration_minutes} min)
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {!fixedProfessionalId && (
          <Field>
            <FieldLabel htmlFor="sim-pro">Profissional</FieldLabel>
            <NativeSelect
              id="sim-pro"
              className="w-full"
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
            >
              <NativeSelectOption value="">Qualquer profissional</NativeSelectOption>
              {professionals.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.display_name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="sim-date">Data</FieldLabel>
          <Input
            id="sim-date"
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Button onClick={search} disabled={pending || !serviceId || !date}>
          {pending ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : (
            <SearchIcon aria-hidden />
          )}
          Ver horários
        </Button>
      </div>

      <FormAlert message={error} />

      {slots !== null &&
        (slots.length === 0 ? (
          <p
            className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
            role="status"
          >
            Nenhum horário livre nesse dia. Confira o horário de funcionamento, a jornada, os
            bloqueios e quem realiza o serviço.
          </p>
        ) : (
          <div className="flex flex-col gap-4" role="status" aria-label="Horários disponíveis">
            <p className="text-sm text-muted-foreground">
              {slots.length} {slots.length === 1 ? "horário livre" : "horários livres"}
            </p>
            {groupSlotsByPeriod(slots, timeZone).map((group) => (
              <section key={group.period} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">{group.label}</h3>
                <ul className="flex flex-wrap gap-2">
                  {group.slots.map((s) => (
                    <li
                      key={s.startsAt}
                      className="rounded-md border px-3 py-1.5 text-sm tabular-nums"
                      title={s.professionalIds.map((id) => names.get(id) ?? "").join(", ")}
                    >
                      {formatInTimeZone(s.startsAt, "HH:mm", timeZone)}
                      {!professionalId && s.professionalIds.length > 1 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({s.professionalIds.length})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ))}
    </div>
  );
}
