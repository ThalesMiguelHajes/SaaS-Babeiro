"use client";

import { ArchiveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";

import { archiveServiceAction } from "../actions";

export function ArchiveServiceButton({
  slug,
  serviceId,
  name,
}: {
  slug: string;
  serviceId: string;
  name: string;
}) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Arquivar ${name}`}>
          <ArchiveIcon aria-hidden />
        </Button>
      }
      title={`Arquivar ${name}?`}
      description="O serviço deixa de ser oferecido e sai desta lista. O histórico de atendimentos continua guardado."
      confirmLabel="Arquivar"
      destructive
      onConfirm={async () => {
        const result = await archiveServiceAction(slug, serviceId);
        if (!result.ok) return result.error.message;
        toast.success("Serviço arquivado.");
        router.refresh();
        return null;
      }}
    />
  );
}
