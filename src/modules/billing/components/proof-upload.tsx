"use client";

import { Loader2Icon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { uploadProofAction } from "../actions";

/** Envio de comprovante pelo estabelecimento. O envio não confirma o pagamento (BILLING §10.3). */
export function ProofUpload({ slug, invoiceId }: { slug: string; invoiceId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <FormAlert message={error} />
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Arquivo do comprovante"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const fd = new FormData();
          fd.set("slug", slug);
          fd.set("invoiceId", invoiceId);
          fd.set("file", file);
          setError(null);
          start(async () => {
            const r = await uploadProofAction(fd);
            if (input.current) input.current.value = "";
            if (!r.ok) setError(r.error.message);
            else {
              toast.success("Comprovante enviado. Vamos conferir e confirmar o pagamento.");
              router.refresh();
            }
          });
        }}
      />
      <div>
        <Button variant="outline" disabled={pending} onClick={() => input.current?.click()}>
          {pending ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : (
            <UploadIcon aria-hidden />
          )}
          Enviar comprovante
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        PDF ou imagem de até 10 MB. A confirmação é feita pela nossa equipe.
      </p>
    </div>
  );
}
