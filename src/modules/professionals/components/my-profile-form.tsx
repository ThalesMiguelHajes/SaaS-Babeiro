"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { updateMyProfileAction } from "../actions";
import { myProfileSchema, type MyProfileData, type MyProfileInput } from "../schemas";

export function MyProfileForm({ slug, defaults }: { slug: string; defaults: MyProfileInput }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<MyProfileInput, unknown, MyProfileData>({
    resolver: zodResolver(myProfileSchema),
    defaultValues: defaults,
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    const raw = form.getValues();
    startTransition(async () => {
      const result = await updateMyProfileAction(slug, raw);
      if (!result.ok) setFormError(result.error.message);
      else {
        toast.success("Perfil atualizado.");
        router.refresh();
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-6">
      <FormAlert message={formError} />
      <FieldGroup>
        <Field data-invalid={Boolean(errors.displayName)}>
          <FieldLabel htmlFor="displayName">Nome de exibição</FieldLabel>
          <Input id="displayName" {...form.register("displayName")} />
          <FieldError errors={[errors.displayName]} />
        </Field>
        <Field data-invalid={Boolean(errors.specialties)}>
          <FieldLabel htmlFor="specialties">Especialidades</FieldLabel>
          <Input id="specialties" placeholder="Degradê, Barba" {...form.register("specialties")} />
          <FieldDescription>Separe por vírgula.</FieldDescription>
          <FieldError errors={[errors.specialties]} />
        </Field>
        <Field data-invalid={Boolean(errors.bio)}>
          <FieldLabel htmlFor="bio">Sobre você</FieldLabel>
          <Textarea id="bio" rows={4} {...form.register("bio")} />
          <FieldError errors={[errors.bio]} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={pending} className="self-start">
        {pending && <Loader2Icon className="animate-spin" aria-hidden />}
        Salvar perfil
      </Button>
    </form>
  );
}
