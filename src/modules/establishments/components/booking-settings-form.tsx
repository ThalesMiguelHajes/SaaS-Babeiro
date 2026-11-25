"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { updateBookingSettingsAction } from "../actions";
import {
  bookingSettingsSchema,
  SLOT_INTERVALS,
  type BookingSettingsData,
  type BookingSettingsInput,
} from "../schemas";

const NOTICE_OPTIONS = [
  { value: 0, label: "Sem antecedência mínima" },
  { value: 30, label: "30 minutos" },
  { value: 60, label: "1 hora" },
  { value: 120, label: "2 horas" },
  { value: 240, label: "4 horas" },
  { value: 720, label: "12 horas" },
  { value: 1440, label: "1 dia" },
  { value: 2880, label: "2 dias" },
];

type SwitchName = {
  [K in keyof BookingSettingsInput]: BookingSettingsInput[K] extends boolean ? K : never;
}[keyof BookingSettingsInput];

export function BookingSettingsForm({
  slug,
  defaults,
}: {
  slug: string;
  defaults: BookingSettingsInput;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<BookingSettingsInput, unknown, BookingSettingsData>({
    resolver: zodResolver(bookingSettingsSchema),
    defaultValues: defaults,
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    const raw = form.getValues();
    startTransition(async () => {
      const result = await updateBookingSettingsAction(slug, raw);
      if (!result.ok) {
        setFormError(result.error.message);
        for (const [field, messages] of Object.entries(result.error.fieldErrors ?? {})) {
          form.setError(field as FieldPath<BookingSettingsInput>, { message: messages[0] });
        }
        return;
      }
      toast.success("Configurações salvas.");
      router.refresh();
    });
  });

  const toggle = (name: SwitchName, label: string, description: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal">
          <Switch id={name} checked={Boolean(field.value)} onCheckedChange={field.onChange} />
          <FieldContent>
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            <FieldDescription>{description}</FieldDescription>
          </FieldContent>
        </Field>
      )}
    />
  );

  const noticeSelect = (
    name: "minBookingNoticeMinutes" | "customerChangeNoticeMinutes",
    label: string,
  ) => (
    <Field>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <NativeSelect id={name} className="w-full" {...form.register(name)}>
        {NOTICE_OPTIONS.map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-2xl flex-col gap-8">
      <FormAlert message={formError} />

      <FieldSet>
        <FieldLegend>Agendamento online</FieldLegend>
        {toggle(
          "publicBookingEnabled",
          "Aceitar agendamentos pela página",
          "Desligue para pausar novos agendamentos online (ex.: férias coletivas).",
        )}
        {toggle(
          "bookingRequiresConfirmation",
          "Confirmar cada agendamento manualmente",
          "Ligado: o agendamento entra como Pendente até a equipe confirmar. Desligado: já entra Confirmado.",
        )}
      </FieldSet>

      <FieldSet>
        <FieldLegend>Horários oferecidos</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="slotIntervalMinutes">Intervalo entre horários</FieldLabel>
            <NativeSelect
              id="slotIntervalMinutes"
              className="w-full"
              {...form.register("slotIntervalMinutes")}
            >
              {SLOT_INTERVALS.map((n) => (
                <NativeSelectOption key={n} value={n}>
                  A cada {n} min
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {noticeSelect("minBookingNoticeMinutes", "Antecedência mínima")}
          <Field data-invalid={Boolean(errors.maxBookingDaysAhead)}>
            <FieldLabel htmlFor="maxBookingDaysAhead">Agenda aberta por (dias)</FieldLabel>
            <Input
              id="maxBookingDaysAhead"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              {...form.register("maxBookingDaysAhead")}
            />
            <FieldError errors={[errors.maxBookingDaysAhead]} />
          </Field>
        </div>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Cliente</FieldLegend>
        {toggle(
          "allowCustomerCancellation",
          "Cliente pode cancelar pelo link da reserva",
          "Respeitando a antecedência abaixo.",
        )}
        {toggle(
          "allowCustomerReschedule",
          "Cliente pode reagendar pelo link da reserva",
          "Respeitando a antecedência abaixo.",
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {noticeSelect("customerChangeNoticeMinutes", "Antecedência para cancelar/reagendar")}
          <Field data-invalid={Boolean(errors.maxActiveBookingsPerCustomer)}>
            <FieldLabel htmlFor="maxActiveBookingsPerCustomer">
              Agendamentos futuros por cliente
            </FieldLabel>
            <Input
              id="maxActiveBookingsPerCustomer"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              {...form.register("maxActiveBookingsPerCustomer")}
            />
            <FieldDescription>Evita que alguém ocupe vários horários de uma vez.</FieldDescription>
            <FieldError errors={[errors.maxActiveBookingsPerCustomer]} />
          </Field>
        </div>
        <Field data-invalid={Boolean(errors.bookingPolicyText)}>
          <FieldLabel htmlFor="bookingPolicyText">Política para o cliente (opcional)</FieldLabel>
          <Textarea
            id="bookingPolicyText"
            rows={3}
            placeholder="Ex.: Tolerância de 10 minutos de atraso."
            {...form.register("bookingPolicyText")}
          />
          <FieldError errors={[errors.bookingPolicyText]} />
        </Field>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Profissionais</FieldLegend>
        {toggle(
          "staffCanManageOwnBlocks",
          "Podem bloquear a própria agenda",
          "Folgas, compromissos e férias.",
        )}
        {toggle(
          "staffCanManageOwnHours",
          "Podem alterar a própria jornada semanal",
          "Sempre dentro do horário do estabelecimento.",
        )}
        {toggle(
          "staffCanRecordPayments",
          "Podem registrar pagamentos dos próprios atendimentos",
          "Ao concluir o atendimento.",
        )}
      </FieldSet>

      <Button type="submit" disabled={pending} className="self-start">
        {pending && <Loader2Icon className="animate-spin" aria-hidden />}
        Salvar configurações
      </Button>
    </form>
  );
}
