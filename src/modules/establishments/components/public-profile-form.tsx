"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
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
import { FormAlert } from "@/modules/auth/components/form-alert";
import { BRAZIL_STATES } from "@/modules/platform/rules";

import { updatePublicProfileAction } from "../actions";
import { publicProfileSchema, type PublicProfileData, type PublicProfileInput } from "../schemas";

const COLOR_SUGGESTIONS = [
  { value: "#18181B", label: "Preto" },
  { value: "#B08D57", label: "Dourado" },
  { value: "#7F1D1D", label: "Bordô" },
  { value: "#14532D", label: "Verde-escuro" },
  { value: "#1E3A8A", label: "Azul-marinho" },
  { value: "#BE7C7C", label: "Rosé" },
];

export function PublicProfileForm({
  slug,
  defaults,
}: {
  slug: string;
  defaults: PublicProfileInput;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<PublicProfileInput, unknown, PublicProfileData>({
    resolver: zodResolver(publicProfileSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });
  const { errors } = form.formState;
  const color = useWatch({ control: form.control, name: "accentColor" });

  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    const raw = form.getValues();
    startTransition(async () => {
      const result = await updatePublicProfileAction(slug, raw);
      if (!result.ok) {
        setFormError(result.error.message);
        for (const [field, messages] of Object.entries(result.error.fieldErrors ?? {})) {
          form.setError(field as FieldPath<PublicProfileInput>, { message: messages[0] });
        }
        return;
      }
      toast.success("Página atualizada.");
      router.refresh();
    });
  });

  const text = (
    name: FieldPath<PublicProfileInput>,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <Field data-invalid={Boolean(errors[name as keyof typeof errors])}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input id={name} {...props} {...form.register(name)} />
      <FieldError errors={[errors[name as keyof typeof errors]]} />
    </Field>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-3xl flex-col gap-8">
      <FormAlert message={formError} />
      <FieldGroup>
        <Field data-invalid={Boolean(errors.description)}>
          <FieldLabel htmlFor="description">Descrição</FieldLabel>
          <Textarea
            id="description"
            rows={3}
            placeholder="Ex.: Barbearia clássica no centro, cortes e barba na régua."
            {...form.register("description")}
          />
          <FieldError errors={[errors.description]} />
        </Field>
      </FieldGroup>

      <FieldSet>
        <FieldLegend>Contato</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-3">
          {text("whatsapp", "WhatsApp", { inputMode: "tel", placeholder: "(11) 91234-5678" })}
          {text("phone", "Telefone", { inputMode: "tel" })}
          {text("instagram", "Instagram", { placeholder: "@barbearia" })}
        </div>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Endereço</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-6">
          <div className="sm:col-span-2">{text("postalCode", "CEP", { inputMode: "numeric" })}</div>
          <div className="sm:col-span-4">{text("street", "Rua")}</div>
          <div className="sm:col-span-2">{text("number", "Número")}</div>
          <div className="sm:col-span-4">{text("complement", "Complemento")}</div>
          <div className="sm:col-span-2">{text("district", "Bairro")}</div>
          <div className="sm:col-span-3">{text("city", "Cidade")}</div>
          <Field className="sm:col-span-1">
            <FieldLabel htmlFor="state">UF</FieldLabel>
            <NativeSelect id="state" className="w-full" {...form.register("state")}>
              <NativeSelectOption value="">—</NativeSelectOption>
              {BRAZIL_STATES.map((uf) => (
                <NativeSelectOption key={uf} value={uf}>
                  {uf}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Cor de destaque</FieldLegend>
        <FieldDescription>
          Usada nos botões e destaques da sua página de agendamento.
        </FieldDescription>
        <div className="flex flex-wrap items-center gap-2">
          {COLOR_SUGGESTIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              aria-label={`Cor ${c.label}`}
              aria-pressed={color.toLowerCase() === c.value.toLowerCase()}
              onClick={() => form.setValue("accentColor", c.value, { shouldDirty: true })}
              className="size-8 rounded-full border-2 border-transparent ring-offset-2 ring-offset-background aria-pressed:ring-2 aria-pressed:ring-ring"
              style={{ backgroundColor: c.value }}
            />
          ))}
          <Input
            type="color"
            aria-label="Escolher outra cor"
            className="h-8 w-12 cursor-pointer p-1"
            {...form.register("accentColor")}
          />
          <span className="font-mono text-xs text-muted-foreground uppercase">{color}</span>
        </div>
      </FieldSet>

      <Button type="submit" disabled={pending} className="self-start">
        {pending && <Loader2Icon className="animate-spin" aria-hidden />}
        Salvar página
      </Button>
    </form>
  );
}
