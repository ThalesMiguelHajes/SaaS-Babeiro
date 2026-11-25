"use client";

import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

/** Confirmação de ação sensível, opcionalmente exigindo um motivo (registrado na auditoria). */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = false,
  requireReason = false,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  requireReason?: boolean;
  onConfirm: (reason: string) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (requireReason && reason.trim().length < 3) {
      setError("Informe o motivo (mínimo de 3 caracteres).");
      return;
    }
    setError(null);
    startTransition(async () => {
      const failure = await onConfirm(reason.trim());
      if (failure) setError(failure);
      else {
        setOpen(false);
        setReason("");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {requireReason && (
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="confirm-reason">Motivo</FieldLabel>
            <Textarea
              id="confirm-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          </Field>
        )}
        {error && <FieldError>{error}</FieldError>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={confirm}
            disabled={pending}
          >
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
