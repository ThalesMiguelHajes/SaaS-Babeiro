"use client";

import { KeyRoundIcon, Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";

import { CopyLinkField } from "@/components/shared/copy-link-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { generatePasswordLinkAction } from "../actions";

export function PasswordLinkButton({ userId, name }: { userId: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setUrl(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <KeyRoundIcon aria-hidden /> Nova senha
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link de nova senha para {name}</DialogTitle>
          <DialogDescription>
            Gere um link de uso único e envie à pessoa. Ela define uma nova senha ao abrir o link. A
            ação fica registrada na auditoria.
          </DialogDescription>
        </DialogHeader>
        <FormAlert message={error} />
        {url ? (
          <CopyLinkField
            url={url}
            label="Link (uso único, expira em pouco tempo)"
            whatsappText={`Olá, ${name.split(" ")[0]}! Use este link para criar uma nova senha:\n${url}`}
          />
        ) : (
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await generatePasswordLinkAction(userId);
                if (result.ok) setUrl(result.data.url);
                else setError(result.error.message);
              })
            }
          >
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Gerar link
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
