"use client";

import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";

import { revokeInvitationAction } from "../actions";

export function RevokeInvitationButton({
  invitationId,
  email,
}: {
  invitationId: string;
  email: string;
}) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" aria-label={`Revogar convite de ${email}`}>
          <XIcon aria-hidden /> Revogar
        </Button>
      }
      title="Revogar convite?"
      description={`O link enviado para ${email} deixa de funcionar.`}
      confirmLabel="Revogar"
      destructive
      onConfirm={async () => {
        const result = await revokeInvitationAction(invitationId);
        if (!result.ok) return result.error.message;
        toast.success("Convite revogado.");
        router.refresh();
        return null;
      }}
    />
  );
}
