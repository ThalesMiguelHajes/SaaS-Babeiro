"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { createEstablishment } from "../create-establishment";
import { createEstablishmentSchema, type EstablishmentInput } from "../establishment-schema";

const defaults: EstablishmentInput = {
  name: "",
  slug: "",
  business_type: "barbershop",
  timezone: DEFAULT_TIMEZONE,
  description: "",
  owner_name: "",
  owner_email: "",
  phone_e164: "",
  whatsapp_e164: "",
  instagram_handle: "",
  address_street: "",
  address_number: "",
  address_complement: "",
  address_district: "",
  address_city: "",
  address_state: "",
  address_postal_code: "",
};

export function CreateEstablishmentForm() {
  const form = useForm<EstablishmentInput>({
    resolver: zodResolver(createEstablishmentSchema),
    defaultValues: defaults,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await createEstablishment(values);
      if (!result.ok) {
        setError(result.error.message);
        const fields = result.error.fieldErrors ?? {};
        for (const field of Object.keys(defaults) as (keyof EstablishmentInput)[]) {
          const message = fields[field]?.[0];
          if (message) form.setError(field, { message }, { shouldFocus: true });
        }
      }
    });
  });

  function input(
    name: keyof EstablishmentInput,
    label: string,
    props: React.ComponentProps<"input"> = {},
  ) {
    const error = form.formState.errors[name];
    return (
      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor={name}>{label}</FieldLabel>
        <Input
          id={name}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
          {...props}
          {...form.register(name)}
        />
        <FieldError id={`${name}-error`} errors={[error]} />
      </Field>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending} className="grid max-w-3xl gap-8">
      <FieldSet disabled={pending}>
        <FieldLegend>Dados do estabelecimento</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2">
          {input("name", "Nome comercial *", { autoComplete: "organization", required: true })}
          {input("slug", "Endereço do link (slug) *", {
            placeholder: "barbearia-central",
            autoCapitalize: "none",
            required: true,
          })}
          <Field>
            <FieldLabel htmlFor="business_type">Tipo de estabelecimento *</FieldLabel>
            <select
              id="business_type"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...form.register("business_type")}
            >
              <option value="barbershop">Barbearia</option>
              <option value="beauty_salon">Salão de beleza</option>
              <option value="nail_studio">Estúdio de unhas</option>
              <option value="aesthetics">Estética</option>
              <option value="other">Outro</option>
            </select>
            <FieldError errors={[form.formState.errors.business_type]} />
          </Field>
          {input("timezone", "Fuso horário *", { autoCapitalize: "none", required: true })}
        </div>
        <Field>
          <FieldLabel htmlFor="description">Descrição</FieldLabel>
          <textarea
            id="description"
            rows={3}
            maxLength={1000}
            aria-invalid={Boolean(form.formState.errors.description)}
            aria-describedby="description-error"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...form.register("description")}
          />
          <FieldError id="description-error" errors={[form.formState.errors.description]} />
        </Field>
      </FieldSet>
      <FieldSet disabled={pending}>
        <FieldLegend>Responsável e contatos</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2">
          {input("owner_name", "Nome do responsável", { autoComplete: "name" })}
          {input("owner_email", "E-mail do responsável", { type: "email", autoComplete: "email" })}
          {input("phone_e164", "Telefone", { type: "tel", autoComplete: "tel" })}
          {input("whatsapp_e164", "WhatsApp", { type: "tel" })}
          {input("instagram_handle", "Instagram", {
            placeholder: "@estabelecimento",
            autoCapitalize: "none",
          })}
        </div>
      </FieldSet>
      <FieldSet disabled={pending}>
        <FieldLegend>Endereço</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2">
          {input("address_postal_code", "CEP", {
            inputMode: "numeric",
            autoComplete: "postal-code",
          })}
          {input("address_street", "Logradouro", { autoComplete: "address-line1" })}
          {input("address_number", "Número")}
          {input("address_complement", "Complemento", { autoComplete: "address-line2" })}
          {input("address_district", "Bairro")}
          {input("address_city", "Cidade", { autoComplete: "address-level2" })}
          {input("address_state", "UF", { autoComplete: "address-level1", maxLength: 2 })}
        </div>
      </FieldSet>
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Cadastrando…" : "Cadastrar estabelecimento"}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/estabelecimentos">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
