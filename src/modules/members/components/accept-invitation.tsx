"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { acceptInvitationAction, acceptWithNewAccountAction } from "../actions";
import { acceptWithNewAccountSchema, type AcceptWithNewAccountInput } from "../schemas";

export function AcceptInvitationButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <FormAlert message={error} />
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await acceptInvitationAction(token);
            if (result && !result.ok) setError(result.error.message);
          })
        }
      >
        {pending && <Loader2Icon className="animate-spin" aria-hidden />}
        Aceitar convite
      </Button>
    </div>
  );
}

export function CreateAccountAndAcceptForm({ token, email }: { token: string; email: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<AcceptWithNewAccountInput>({
    resolver: zodResolver(acceptWithNewAccountSchema),
    defaultValues: { token, fullName: "", password: "", confirmPassword: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await acceptWithNewAccountAction(values);
      if (result && !result.ok) setError(result.error.message);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <FormAlert message={error} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input id="email" value={email} readOnly disabled autoComplete="username" />
        </Field>
        <Field data-invalid={Boolean(errors.fullName)}>
          <FieldLabel htmlFor="fullName">Seu nome</FieldLabel>
          <Input
            id="fullName"
            autoComplete="name"
            aria-invalid={Boolean(errors.fullName)}
            {...form.register("fullName")}
          />
          <FieldError errors={[errors.fullName]} />
        </Field>
        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor="password">Crie uma senha</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            {...form.register("password")}
          />
          <FieldDescription>Pelo menos 8 caracteres, com letras e números.</FieldDescription>
          <FieldError errors={[errors.password]} />
        </Field>
        <Field data-invalid={Boolean(errors.confirmPassword)}>
          <FieldLabel htmlFor="confirmPassword">Confirme a senha</FieldLabel>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...form.register("confirmPassword")}
          />
          <FieldError errors={[errors.confirmPassword]} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2Icon className="animate-spin" aria-hidden />}
        Criar conta e entrar
      </Button>
    </form>
  );
}
