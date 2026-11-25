"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { saveServiceAction } from "../actions";
import { serviceFormSchema, type ServiceFormData, type ServiceFormInput } from "../schemas";

const DURATION_SHORTCUTS = [15, 20, 30, 45, 60, 90];

export function ServiceForm({
  slug,
  serviceId,
  defaults,
  categories,
  professionals,
}: {
  slug: string;
  serviceId: string | null;
  defaults: ServiceFormInput;
  categories: { id: string; name: string }[];
  professionals: { id: string; display_name: string; is_active: boolean }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ServiceFormInput, unknown, ServiceFormData>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });
  const { errors } = form.formState;
  const base = `/painel/${slug}/servicos`;

  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    const raw = form.getValues();
    startTransition(async () => {
      const result = await saveServiceAction(slug, serviceId, raw);
      if (!result.ok) {
        setFormError(result.error.message);
        for (const [field, messages] of Object.entries(result.error.fieldErrors ?? {})) {
          form.setError(field as FieldPath<ServiceFormInput>, { message: messages[0] });
        }
        return;
      }
      toast.success(serviceId ? "Serviço atualizado." : "Serviço cadastrado.");
      router.push(base);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-2xl flex-col gap-8">
      <FormAlert message={formError} />

      <FieldGroup>
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor="name">Nome do serviço</FieldLabel>
          <Input
            id="name"
            placeholder="Ex.: Corte masculino"
            aria-invalid={Boolean(errors.name)}
            {...form.register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={Boolean(errors.description)}>
          <FieldLabel htmlFor="description">
            Descrição (opcional, aparece para o cliente)
          </FieldLabel>
          <Textarea id="description" rows={2} {...form.register("description")} />
          <FieldError errors={[errors.description]} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(errors.price)}>
            <FieldLabel htmlFor="price">Preço</FieldLabel>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">R$</span>
              <Input
                id="price"
                inputMode="decimal"
                placeholder="40,00"
                aria-invalid={Boolean(errors.price)}
                {...form.register("price")}
              />
            </div>
            <FieldError errors={[errors.price]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="categoryId">Categoria</FieldLabel>
            <NativeSelect id="categoryId" className="w-full" {...form.register("categoryId")}>
              <NativeSelectOption value="">Sem categoria</NativeSelectOption>
              {categories.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </FieldGroup>

      <FieldSet>
        <FieldLegend>Tempo</FieldLegend>
        <Field data-invalid={Boolean(errors.durationMinutes)}>
          <FieldLabel htmlFor="durationMinutes">Duração do atendimento (minutos)</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="durationMinutes"
              type="number"
              inputMode="numeric"
              min={5}
              max={720}
              className="w-24"
              {...form.register("durationMinutes")}
            />
            {DURATION_SHORTCUTS.map((m) => (
              <Button
                key={m}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => form.setValue("durationMinutes", m, { shouldValidate: true })}
              >
                {m} min
              </Button>
            ))}
          </div>
          <FieldError errors={[errors.durationMinutes]} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(errors.bufferBeforeMinutes)}>
            <FieldLabel htmlFor="bufferBeforeMinutes">Preparo antes (min)</FieldLabel>
            <Input
              id="bufferBeforeMinutes"
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              {...form.register("bufferBeforeMinutes")}
            />
            <FieldError errors={[errors.bufferBeforeMinutes]} />
          </Field>
          <Field data-invalid={Boolean(errors.bufferAfterMinutes)}>
            <FieldLabel htmlFor="bufferAfterMinutes">Limpeza depois (min)</FieldLabel>
            <Input
              id="bufferAfterMinutes"
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              {...form.register("bufferAfterMinutes")}
            />
            <FieldError errors={[errors.bufferAfterMinutes]} />
          </Field>
        </div>
        <FieldDescription>
          O preparo e a limpeza bloqueiam a agenda do profissional, mas não aparecem para o cliente.
        </FieldDescription>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Quem realiza este serviço</FieldLegend>
        {professionals.length === 0 ? (
          <FieldDescription>
            Nenhum profissional cadastrado ainda.{" "}
            <Link
              href={`/painel/${slug}/profissionais/novo`}
              className="underline underline-offset-4"
            >
              Cadastrar profissional
            </Link>
          </FieldDescription>
        ) : (
          <Controller
            control={form.control}
            name="professionalIds"
            render={({ field }) => (
              <div className="grid gap-2 sm:grid-cols-2">
                {professionals.map((p) => {
                  const checked = field.value.includes(p.id);
                  return (
                    <Field
                      key={p.id}
                      orientation="horizontal"
                      className="rounded-md border px-3 py-2"
                    >
                      <Checkbox
                        id={`pro-${p.id}`}
                        checked={checked}
                        onCheckedChange={(on) =>
                          field.onChange(
                            on ? [...field.value, p.id] : field.value.filter((id) => id !== p.id),
                          )
                        }
                      />
                      <FieldLabel htmlFor={`pro-${p.id}`} className="font-normal">
                        {p.display_name}
                        {!p.is_active && <span className="text-muted-foreground"> (inativo)</span>}
                      </FieldLabel>
                    </Field>
                  );
                })}
              </div>
            )}
          />
        )}
      </FieldSet>

      <FieldSet>
        <FieldLegend>Disponibilidade</FieldLegend>
        <Controller
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />
              <FieldContent>
                <FieldLabel htmlFor="isActive">Ativo</FieldLabel>
                <FieldDescription>Serviços inativos não podem ser agendados.</FieldDescription>
              </FieldContent>
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="isPublic"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch id="isPublic" checked={field.value} onCheckedChange={field.onChange} />
              <FieldContent>
                <FieldLabel htmlFor="isPublic">Aparece na página de agendamento</FieldLabel>
                <FieldDescription>
                  Desligado: só a equipe agenda este serviço pelo painel.
                </FieldDescription>
              </FieldContent>
            </Field>
          )}
        />
      </FieldSet>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" aria-hidden />}
          {serviceId ? "Salvar alterações" : "Cadastrar serviço"}
        </Button>
        <Button type="button" variant="ghost" asChild>
          <Link href={base}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
