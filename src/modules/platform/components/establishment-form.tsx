"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatPhone } from "@/lib/phone";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { createEstablishmentAction, updateEstablishmentAction } from "../actions";
import { BRAZIL_STATES, BUSINESS_TYPE_LABEL, slugify, TIMEZONES } from "../rules";
import {
  establishmentFormSchema,
  type EstablishmentFormData,
  type EstablishmentFormInput,
} from "../schemas";
import { InviteCreatedCard } from "./invite-created-card";

export type EstablishmentFormDefaults = Partial<{
  id: string;
  name: string;
  slug: string;
  business_type: EstablishmentFormInput["business_type"];
  timezone: string;
  description: string | null;
  owner_name: string | null;
  owner_email: string | null;
  phone_e164: string | null;
  whatsapp_e164: string | null;
  instagram_handle: string | null;
  address_postal_code: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  accent_color: string;
}>;

function toFormValues(d: EstablishmentFormDefaults): EstablishmentFormInput {
  return {
    name: d.name ?? "",
    slug: d.slug ?? "",
    business_type: d.business_type ?? "barbershop",
    timezone: d.timezone ?? "America/Sao_Paulo",
    description: d.description ?? "",
    owner_name: d.owner_name ?? "",
    owner_email: d.owner_email ?? "",
    phone: d.phone_e164 ? formatPhone(d.phone_e164) : "",
    whatsapp: d.whatsapp_e164 ? formatPhone(d.whatsapp_e164) : "",
    instagram_handle: d.instagram_handle ?? "",
    address_postal_code: d.address_postal_code ?? "",
    address_street: d.address_street ?? "",
    address_number: d.address_number ?? "",
    address_complement: d.address_complement ?? "",
    address_district: d.address_district ?? "",
    address_city: d.address_city ?? "",
    address_state: d.address_state ?? "",
    accent_color: d.accent_color ?? "#18181B",
  };
}

export function EstablishmentForm({ defaults = {} }: { defaults?: EstablishmentFormDefaults }) {
  const isEdit = Boolean(defaults.id);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    id: string;
    name: string;
    inviteUrl: string | null;
    whatsapp: string | null;
  } | null>(null);

  const form = useForm<EstablishmentFormInput, unknown, EstablishmentFormData>({
    resolver: zodResolver(establishmentFormSchema),
    defaultValues: toFormValues(defaults),
    mode: "onTouched",
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((data) => {
    setFormError(null);
    // O servidor valida de novo a partir dos valores digitados (nunca confia no cliente).
    const raw = form.getValues();
    startTransition(async () => {
      const result = isEdit
        ? await updateEstablishmentAction(defaults.id!, raw)
        : await createEstablishmentAction(raw);
      if (!result.ok) {
        setFormError(result.error.message);
        for (const [field, messages] of Object.entries(result.error.fieldErrors ?? {})) {
          form.setError(field as FieldPath<EstablishmentFormInput>, { message: messages[0] });
        }
        return;
      }
      if (isEdit) {
        toast.success("Dados salvos.");
        router.refresh();
      } else if (result.data && "id" in result.data) {
        setCreated({
          id: result.data.id,
          name: data.name,
          inviteUrl: result.data.inviteUrl,
          whatsapp: data.whatsapp,
        });
      }
    });
  });

  if (created) {
    return (
      <InviteCreatedCard
        establishmentId={created.id}
        establishmentName={created.name}
        inviteUrl={created.inviteUrl}
        whatsappTo={created.whatsapp}
      />
    );
  }

  const text = (
    name: FieldPath<EstablishmentFormInput>,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <Field data-invalid={Boolean(errors[name as keyof typeof errors])}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        aria-invalid={Boolean(errors[name as keyof typeof errors])}
        {...props}
        {...form.register(name)}
      />
      <FieldError errors={[errors[name as keyof typeof errors]]} />
    </Field>
  );

  const nameField = form.register("name");

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-3xl flex-col gap-8">
      <FormAlert message={formError} />

      <FieldSet>
        <FieldLegend>Identificação</FieldLegend>
        <FieldGroup>
          <Field data-invalid={Boolean(errors.name)}>
            <FieldLabel htmlFor="name">Nome comercial</FieldLabel>
            <Input
              id="name"
              aria-invalid={Boolean(errors.name)}
              {...nameField}
              onChange={(e) => {
                void nameField.onChange(e);
                // Preenche o slug enquanto a pessoa não editá-lo manualmente (setValue não marca como "sujo").
                if (!isEdit && !form.getFieldState("slug").isDirty)
                  form.setValue("slug", slugify(e.target.value));
              }}
            />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field data-invalid={Boolean(errors.slug)}>
            <FieldLabel htmlFor="slug">Endereço da página de agendamento</FieldLabel>
            <div className="flex items-center gap-1">
              <span className="shrink-0 text-sm text-muted-foreground">/agendar/</span>
              <Input id="slug" aria-invalid={Boolean(errors.slug)} {...form.register("slug")} />
            </div>
            <FieldDescription>
              Letras minúsculas, números e hífens.
              {isEdit && " Alterar o endereço invalida links já compartilhados."}
            </FieldDescription>
            <FieldError errors={[errors.slug]} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="business_type">Tipo de negócio</FieldLabel>
              <NativeSelect
                id="business_type"
                className="w-full"
                {...form.register("business_type")}
              >
                {Object.entries(BUSINESS_TYPE_LABEL).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="timezone">Fuso horário</FieldLabel>
              <NativeSelect id="timezone" className="w-full" {...form.register("timezone")}>
                {TIMEZONES.map((tz) => (
                  <NativeSelectOption key={tz.value} value={tz.value}>
                    {tz.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field data-invalid={Boolean(errors.description)}>
            <FieldLabel htmlFor="description">Descrição (aparece na página pública)</FieldLabel>
            <Textarea id="description" rows={3} {...form.register("description")} />
            <FieldError errors={[errors.description]} />
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Responsável</FieldLegend>
        <FieldDescription>
          {isEdit
            ? "Dados de contato do responsável. Para dar acesso, use a aba Equipe."
            : "Se informar o e-mail, geramos um convite para o responsável criar a senha e acessar o painel."}
        </FieldDescription>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("owner_name", "Nome")}
          {text("owner_email", "E-mail", { type: "email", autoComplete: "off" })}
        </div>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Contato</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-3">
          {text("whatsapp", "WhatsApp", { inputMode: "tel", placeholder: "(11) 91234-5678" })}
          {text("phone", "Telefone", { inputMode: "tel" })}
          {text("instagram_handle", "Instagram", { placeholder: "@barbearia" })}
        </div>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Endereço</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-6">
          <div className="sm:col-span-2">
            {text("address_postal_code", "CEP", { inputMode: "numeric" })}
          </div>
          <div className="sm:col-span-4">{text("address_street", "Rua")}</div>
          <div className="sm:col-span-2">{text("address_number", "Número")}</div>
          <div className="sm:col-span-4">{text("address_complement", "Complemento")}</div>
          <div className="sm:col-span-2">{text("address_district", "Bairro")}</div>
          <div className="sm:col-span-3">{text("address_city", "Cidade")}</div>
          <Field className="sm:col-span-1" data-invalid={Boolean(errors.address_state)}>
            <FieldLabel htmlFor="address_state">UF</FieldLabel>
            <NativeSelect id="address_state" className="w-full" {...form.register("address_state")}>
              <NativeSelectOption value="">—</NativeSelectOption>
              {BRAZIL_STATES.map((uf) => (
                <NativeSelectOption key={uf} value={uf}>
                  {uf}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError errors={[errors.address_state]} />
          </Field>
        </div>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Aparência</FieldLegend>
        <Field orientation="horizontal" data-invalid={Boolean(errors.accent_color)}>
          <Input
            id="accent_color"
            type="color"
            className="h-10 w-14 cursor-pointer p-1"
            {...form.register("accent_color")}
          />
          <FieldLabel htmlFor="accent_color">Cor de destaque da página pública</FieldLabel>
        </Field>
      </FieldSet>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" aria-hidden />}
          {isEdit ? "Salvar alterações" : "Cadastrar estabelecimento"}
        </Button>
      </div>
    </form>
  );
}
