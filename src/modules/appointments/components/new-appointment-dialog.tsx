"use client";

import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatInTimeZone } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { localToInstant } from "@/modules/availability/rules";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { createAppointmentAction, getPanelSlotsAction, searchCustomersAction } from "../actions";
import { newAppointmentSchema } from "../schemas";

export type NewAppointmentPrefill = {
  professionalId: string | null;
  date: string;
  startsAt: string | null;
};

type Customer = { id: string; full_name: string; phone_e164: string | null };

/** Agendamento manual pelo painel: cliente existente ou novo, horário livre ou encaixe (só admin). */
export function NewAppointmentDialog({
  slug,
  open,
  onOpenChange,
  prefill,
  services,
  professionals,
  timeZone,
  isAdmin,
  ownProfessionalId,
  onCreated,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill: NewAppointmentPrefill;
  services: { id: string; name: string; duration_minutes: number; professionalIds: string[] }[];
  professionals: { id: string; display_name: string }[];
  timeZone: string;
  isAdmin: boolean;
  ownProfessionalId: string | null;
  onCreated: () => void;
}) {
  const fixedPro = isAdmin ? null : ownProfessionalId;
  const [serviceId, setServiceId] = useState(
    services.find(
      (s) => !prefill.professionalId || s.professionalIds.includes(prefill.professionalId),
    )?.id ??
      services[0]?.id ??
      "",
  );
  const [professionalId, setProfessionalId] = useState<string>(
    fixedPro ?? prefill.professionalId ?? "",
  );
  const [date, setDate] = useState(prefill.date);
  const [startsAt, setStartsAt] = useState<string | null>(prefill.startsAt);
  const [fitIn, setFitIn] = useState(false);
  const [fitTime, setFitTime] = useState(
    prefill.startsAt ? formatInTimeZone(prefill.startsAt, "HH:mm", timeZone) : "12:00",
  );
  const [slots, setSlots] = useState<string[] | null>(null);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingSlots, startSlots] = useTransition();
  const [pending, startSubmit] = useTransition();

  const service = services.find((s) => s.id === serviceId);
  const pros = professionals.filter((p) => !service || service.professionalIds.includes(p.id));

  useEffect(() => {
    if (!serviceId || !date || fitIn) return;
    let active = true;
    startSlots(async () => {
      const r = await getPanelSlotsAction(slug, {
        serviceId,
        professionalId: professionalId || null,
        date,
      });
      if (active) setSlots(r.ok ? r.data : []);
    });
    return () => {
      active = false;
    };
  }, [slug, serviceId, professionalId, date, fitIn]);

  useEffect(() => {
    if (!isAdmin || term.trim().length < 2 || customer) return;
    let active = true;
    const t = setTimeout(async () => {
      const r = await searchCustomersAction(slug, term);
      if (active) setResults(r);
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [slug, term, isAdmin, customer]);

  function submit() {
    setError(null);
    const finalStart = fitIn ? localToInstant(date, fitTime, timeZone) : startsAt;
    const input = {
      serviceId,
      professionalId: professionalId || null,
      startsAt: finalStart ?? "",
      outsideWorkingHours: fitIn,
      customerId: customer?.id ?? null,
      customerName: customer ? "" : name,
      customerPhone: customer ? "" : phone,
      notes,
    };
    const parsed = newAppointmentSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira os campos.");
      return;
    }
    if (fitIn && !professionalId) {
      setError("No encaixe, escolha o profissional.");
      return;
    }
    startSubmit(async () => {
      const r = await createAppointmentAction(slug, input);
      if (!r.ok) {
        setError(r.error.message);
        if (r.error.code === "SLOT_UNAVAILABLE") setStartsAt(null);
        return;
      }
      toast.success("Agendamento criado.");
      onCreated();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>Escolha o serviço, o horário e o cliente.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <FormAlert message={error} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="na-service">Serviço</FieldLabel>
              <NativeSelect
                id="na-service"
                className="w-full"
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setStartsAt(null);
                }}
              >
                {services.map((s) => (
                  <NativeSelectOption key={s.id} value={s.id}>
                    {s.name} ({s.duration_minutes} min)
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {!fixedPro && (
              <Field>
                <FieldLabel htmlFor="na-pro">Profissional</FieldLabel>
                <NativeSelect
                  id="na-pro"
                  className="w-full"
                  value={professionalId}
                  onChange={(e) => {
                    setProfessionalId(e.target.value);
                    setStartsAt(null);
                  }}
                >
                  <NativeSelectOption value="">Qualquer profissional</NativeSelectOption>
                  {pros.map((p) => (
                    <NativeSelectOption key={p.id} value={p.id}>
                      {p.display_name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <Field className="w-auto">
              <FieldLabel htmlFor="na-date">Data</FieldLabel>
              <Input
                id="na-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setStartsAt(null);
                }}
              />
            </Field>
            {isAdmin && (
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Switch
                  checked={fitIn}
                  onCheckedChange={setFitIn}
                  aria-label="Encaixe fora da agenda"
                />
                Encaixe (fora do horário livre)
              </label>
            )}
          </div>

          {fitIn ? (
            <Field className="w-auto">
              <FieldLabel htmlFor="na-fit">Horário do encaixe</FieldLabel>
              <Input
                id="na-fit"
                type="time"
                step={300}
                className="w-32"
                value={fitTime}
                onChange={(e) => setFitTime(e.target.value)}
              />
            </Field>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Horário</span>
              {loadingSlots || slots === null ? (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" aria-hidden /> Buscando horários…
                </span>
              ) : slots.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  Nenhum horário livre nessa data.
                </span>
              ) : (
                <ul className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                  {slots.map((t) => (
                    <li key={t}>
                      <button
                        type="button"
                        aria-pressed={t === startsAt}
                        onClick={() => setStartsAt(t)}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-sm tabular-nums",
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
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Cliente</span>
            {customer ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>
                  {customer.full_name}
                  {customer.phone_e164 && (
                    <span className="text-muted-foreground"> · {customer.phone_e164}</span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Trocar cliente"
                  onClick={() => setCustomer(null)}
                >
                  <XIcon aria-hidden />
                </Button>
              </div>
            ) : (
              <>
                {isAdmin && (
                  <div className="relative">
                    <SearchIcon
                      className="absolute top-2.5 left-2.5 size-4 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      className="pl-8"
                      placeholder="Buscar cliente por nome ou telefone"
                      aria-label="Buscar cliente"
                      value={term}
                      onChange={(e) => setTerm(e.target.value)}
                    />
                    {results.length > 0 && term.trim().length >= 2 && (
                      <ul className="mt-1 flex flex-col divide-y rounded-md border text-sm">
                        {results.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left hover:bg-muted"
                              onClick={() => {
                                setCustomer(c);
                                setResults([]);
                              }}
                            >
                              {c.full_name}
                              {c.phone_e164 && (
                                <span className="text-muted-foreground"> · {c.phone_e164}</span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="na-name">
                      {isAdmin ? "Ou novo cliente: nome" : "Nome do cliente"}
                    </FieldLabel>
                    <Input id="na-name" value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="na-phone">WhatsApp (opcional)</FieldLabel>
                    <Input
                      id="na-phone"
                      type="tel"
                      inputMode="tel"
                      placeholder="(11) 91234-5678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </Field>
                </div>
              </>
            )}
          </div>

          <Field>
            <FieldLabel htmlFor="na-notes">Observação interna (opcional)</FieldLabel>
            <Textarea
              id="na-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
