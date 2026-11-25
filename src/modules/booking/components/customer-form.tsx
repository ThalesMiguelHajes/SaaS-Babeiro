"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { maskBrazilPhone } from "../rules";
import { customerFormSchema, type CustomerFormInput } from "../schemas";
import { TurnstileWidget } from "./turnstile-widget";

export type CustomerSubmit = CustomerFormInput & {
  website: string;
  startedAt: number;
  turnstileToken: string | null;
};

/** Dados do cliente (sem cadastro). Inclui honeypot, tempo de preenchimento e Turnstile. */
export function CustomerForm({
  pending,
  error,
  policyText,
  onSubmit,
}: {
  pending: boolean;
  error: string | null;
  policyText: string | null;
  onSubmit: (data: CustomerSubmit) => void;
}) {
  const [startedAt] = useState(() => Date.now());
  const [website, setWebsite] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const form = useForm<CustomerFormInput>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: { name: "", phone: "", email: "", notes: "" },
    mode: "onTouched",
  });
  const { errors } = form.formState;

  return (
    <form
      id="customer-form"
      noValidate
      className="flex flex-col gap-5"
      onSubmit={form.handleSubmit((data) =>
        onSubmit({ ...data, website, startedAt, turnstileToken }),
      )}
    >
      <FormAlert message={error} />
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor="name">Seu nome</FieldLabel>
          <Input id="name" autoComplete="name" className="h-11" {...form.register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={Boolean(errors.phone)}>
          <FieldLabel htmlFor="phone">WhatsApp</FieldLabel>
          <Controller
            control={form.control}
            name="phone"
            render={({ field }) => (
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(11) 91234-5678"
                className="h-11"
                aria-invalid={Boolean(errors.phone)}
                value={field.value}
                onBlur={field.onBlur}
                onChange={(e) => field.onChange(maskBrazilPhone(e.target.value))}
              />
            )}
          />
          <FieldError errors={[errors.phone]} />
        </Field>
        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor="email">E-mail (opcional)</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            className="h-11"
            {...form.register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={Boolean(errors.notes)}>
          <FieldLabel htmlFor="notes">Observações (opcional)</FieldLabel>
          <Textarea id="notes" rows={2} maxLength={500} {...form.register("notes")} />
          <FieldError errors={[errors.notes]} />
        </Field>
        {/* Honeypot: invisível para pessoas, preenchido por robôs. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Site</label>
          <input
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
      </FieldGroup>

      <TurnstileWidget onToken={setTurnstileToken} />

      <FieldDescription>
        Seus dados são usados só para este agendamento e para o estabelecimento falar com você sobre
        ele.
        {policyText && (
          <>
            <br />
            <span className="whitespace-pre-line">{policyText}</span>
          </>
        )}
      </FieldDescription>

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-6 text-base font-semibold text-[var(--brand-foreground)] transition-opacity disabled:opacity-60"
      >
        {pending && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
        Confirmar agendamento
      </button>
    </form>
  );
}
