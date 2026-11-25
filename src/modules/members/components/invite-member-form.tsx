"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { CopyLinkField } from "@/components/shared/copy-link-field";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FormAlert } from "@/modules/auth/components/form-alert";
import { invitationMessage, MEMBER_ROLE_LABEL } from "@/modules/platform/rules";

import { createInvitationAction } from "../actions";
import { createInvitationSchema, type CreateInvitationInput } from "../schemas";

type Role = CreateInvitationInput["role"];

export function InviteMemberForm({
  establishmentId,
  establishmentName,
  allowedRoles,
}: {
  establishmentId: string;
  establishmentName: string;
  allowedRoles: Role[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; role: Role } | null>(null);

  const form = useForm<CreateInvitationInput>({
    resolver: zodResolver(createInvitationSchema),
    defaultValues: { establishmentId, email: "", role: allowedRoles[0] ?? "staff" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    setResult(null);
    startTransition(async () => {
      const res = await createInvitationAction(values);
      if (!res.ok) {
        setFormError(res.error.message);
        return;
      }
      setResult({ url: res.data.url, role: values.role });
      form.reset({ establishmentId, email: "", role: values.role });
      router.refresh();
    });
  });

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-3 sm:flex-row sm:items-start"
      >
        <Field data-invalid={Boolean(errors.email)} className="sm:flex-1">
          <FieldLabel htmlFor="invite-email">E-mail</FieldLabel>
          <Input
            id="invite-email"
            type="email"
            autoComplete="off"
            aria-invalid={Boolean(errors.email)}
            {...form.register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field className="sm:w-48">
          <FieldLabel htmlFor="invite-role">Papel</FieldLabel>
          <NativeSelect id="invite-role" className="w-full" {...form.register("role")}>
            {allowedRoles.map((role) => (
              <NativeSelectOption key={role} value={role}>
                {MEMBER_ROLE_LABEL[role]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Button type="submit" disabled={pending} className="sm:mt-7">
          {pending ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : (
            <UserPlusIcon aria-hidden />
          )}
          Gerar convite
        </Button>
      </form>
      <FormAlert message={formError} />
      {result && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <CopyLinkField
            url={result.url}
            label="Link do convite (aparece só agora; vale por 7 dias)"
            whatsappText={invitationMessage({
              establishmentName,
              roleLabel: MEMBER_ROLE_LABEL[result.role],
              url: result.url,
            })}
          />
        </div>
      )}
    </div>
  );
}
