"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { requestPasswordReset } from "../actions";
import { recoverPasswordSchema, type RecoverPasswordInput } from "../schemas";
import { FormAlert } from "./form-alert";

export function RecoverPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const form = useForm<RecoverPasswordInput>({
    resolver: zodResolver(recoverPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    setStatus(null);
    startTransition(async () => {
      const result = await requestPasswordReset(values);
      setStatus(
        result.ok
          ? {
              tone: "success",
              message:
                "Se existir uma conta com esse e-mail, enviaremos um link para criar uma nova senha. Confira também a caixa de spam.",
            }
          : { tone: "error", message: result.error.message },
      );
    });
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <FormAlert message={status?.message ?? null} tone={status?.tone} />
      <FieldGroup>
        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor="email">E-mail da sua conta</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            {...form.register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2Icon className="animate-spin" aria-hidden />}
        Enviar link
      </Button>
    </form>
  );
}
