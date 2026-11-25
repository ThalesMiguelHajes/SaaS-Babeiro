"use client";

import { Link2Icon, Link2OffIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import { linkProfessionalUserAction } from "../actions";

/**
 * Vincula a conta de alguém da equipe a este perfil profissional: assim a pessoa vê a própria
 * agenda na área do profissional e edita o próprio perfil.
 */
export function LinkUserControl({
  slug,
  professionalId,
  linkedName,
  candidates,
}: {
  slug: string;
  professionalId: string;
  linkedName: string | null;
  candidates: { userId: string; name: string; email: string | null }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(candidates[0]?.userId ?? "");

  if (linkedName) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm">
          Conta vinculada: <strong>{linkedName}</strong>
        </p>
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="sm">
              <Link2OffIcon aria-hidden /> Desvincular
            </Button>
          }
          title="Desvincular a conta?"
          description="A pessoa continua na equipe, mas deixa de ver esta agenda na área do profissional."
          confirmLabel="Desvincular"
          onConfirm={async () => {
            const result = await linkProfessionalUserAction(slug, professionalId, null);
            if (!result.ok) return result.error.message;
            toast.success("Conta desvinculada.");
            router.refresh();
            return null;
          }}
        />
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma conta disponível para vincular. Convide a pessoa pela página Equipe e volte aqui
        depois que ela aceitar.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <NativeSelect
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        aria-label="Conta da equipe"
        className="sm:w-72"
      >
        {candidates.map((c) => (
          <NativeSelectOption key={c.userId} value={c.userId}>
            {c.name}
            {c.email ? ` (${c.email})` : ""}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Button
        variant="outline"
        disabled={pending || !selected}
        onClick={() =>
          startTransition(async () => {
            const result = await linkProfessionalUserAction(slug, professionalId, selected);
            if (!result.ok) toast.error(result.error.message);
            else {
              toast.success("Conta vinculada.");
              router.refresh();
            }
          })
        }
      >
        {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <Link2Icon aria-hidden />}
        Vincular acesso
      </Button>
    </div>
  );
}
