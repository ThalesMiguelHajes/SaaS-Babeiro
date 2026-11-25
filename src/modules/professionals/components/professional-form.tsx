"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatCents } from "@/lib/money";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { saveProfessionalAction } from "../actions";
import {
  professionalFormSchema,
  type ProfessionalFormData,
  type ProfessionalFormInput,
} from "../schemas";

export function ProfessionalForm({
  slug,
  professionalId,
  defaults,
  services,
}: {
  slug: string;
  professionalId: string | null;
  defaults: ProfessionalFormInput;
  services: { id: string; name: string; price_cents: number; duration_minutes: number }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ProfessionalFormInput, unknown, ProfessionalFormData>({
    resolver: zodResolver(professionalFormSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });
  const { errors } = form.formState;
  const base = `/painel/${slug}/profissionais`;

  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    const raw = form.getValues();
    startTransition(async () => {
      const result = await saveProfessionalAction(slug, professionalId, raw);
      if (!result.ok) {
        setFormError(result.error.message);
        return;
      }
      toast.success(professionalId ? "Profissional atualizado." : "Profissional cadastrado.");
      if (professionalId) router.refresh();
      else router.push(`${base}/${result.data.id}`);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-2xl flex-col gap-8">
      <FormAlert message={formError} />
      <FieldGroup>
        <Field data-invalid={Boolean(errors.displayName)}>
          <FieldLabel htmlFor="displayName">Nome de exibição</FieldLabel>
          <Input
            id="displayName"
            placeholder="Como o cliente vai ver"
            aria-invalid={Boolean(errors.displayName)}
            {...form.register("displayName")}
          />
          <FieldError errors={[errors.displayName]} />
        </Field>
        <Field data-invalid={Boolean(errors.specialties)}>
          <FieldLabel htmlFor="specialties">Especialidades</FieldLabel>
          <Input
            id="specialties"
            placeholder="Degradê, Barba, Coloração"
            {...form.register("specialties")}
          />
          <FieldDescription>
            Separe por vírgula. Aparecem na página de agendamento.
          </FieldDescription>
          <FieldError errors={[errors.specialties]} />
        </Field>
        <Field data-invalid={Boolean(errors.bio)}>
          <FieldLabel htmlFor="bio">Sobre (opcional)</FieldLabel>
          <Textarea id="bio" rows={3} {...form.register("bio")} />
          <FieldError errors={[errors.bio]} />
        </Field>
      </FieldGroup>

      <FieldSet>
        <FieldLegend>Serviços que realiza</FieldLegend>
        {services.length === 0 ? (
          <FieldDescription>
            Nenhum serviço cadastrado ainda.{" "}
            <Link href={`/painel/${slug}/servicos/novo`} className="underline underline-offset-4">
              Cadastrar serviço
            </Link>
          </FieldDescription>
        ) : (
          <Controller
            control={form.control}
            name="serviceIds"
            render={({ field }) => (
              <div className="grid gap-2 sm:grid-cols-2">
                {services.map((s) => (
                  <Field
                    key={s.id}
                    orientation="horizontal"
                    className="rounded-md border px-3 py-2"
                  >
                    <Checkbox
                      id={`svc-${s.id}`}
                      checked={field.value.includes(s.id)}
                      onCheckedChange={(on) =>
                        field.onChange(
                          on ? [...field.value, s.id] : field.value.filter((id) => id !== s.id),
                        )
                      }
                    />
                    <FieldLabel htmlFor={`svc-${s.id}`} className="flex-1 font-normal">
                      <span className="flex-1">{s.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {s.duration_minutes} min · {formatCents(s.price_cents)}
                      </span>
                    </FieldLabel>
                  </Field>
                ))}
              </div>
            )}
          />
        )}
      </FieldSet>

      <FieldSet>
        <FieldLegend>Situação</FieldLegend>
        <Controller
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />
              <FieldContent>
                <FieldLabel htmlFor="isActive">Ativo</FieldLabel>
                <FieldDescription>
                  Inativo: sai da agenda e dos agendamentos; o histórico é mantido.
                </FieldDescription>
              </FieldContent>
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="isBookable"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch id="isBookable" checked={field.value} onCheckedChange={field.onChange} />
              <FieldContent>
                <FieldLabel htmlFor="isBookable">
                  Aparece para o cliente na página de agendamento
                </FieldLabel>
                <FieldDescription>
                  Desligado: só a equipe agenda horários com este profissional.
                </FieldDescription>
              </FieldContent>
            </Field>
          )}
        />
      </FieldSet>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" aria-hidden />}
          {professionalId ? "Salvar alterações" : "Cadastrar profissional"}
        </Button>
        <Button type="button" variant="ghost" asChild>
          <Link href={base}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
