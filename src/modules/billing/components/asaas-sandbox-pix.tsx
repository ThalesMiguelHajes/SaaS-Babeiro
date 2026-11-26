"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { getInvoiceSandboxPix } from "../asaas-actions";

export function AsaasSandboxPix({ slug, invoiceId }: { slug: string; invoiceId: string }) {
  const router = useRouter();
  const [result, setResult] = useState<Awaited<ReturnType<typeof getInvoiceSandboxPix>>>();
  const [pending, start] = useTransition();

  return (
    <section className="flex flex-col items-start gap-3 rounded-lg border p-3">
      <h2 className="text-sm font-medium">Pix de teste · Asaas</h2>
      <p className="text-sm text-muted-foreground">
        Use o ambiente de testes do Asaas para simular o pagamento.
      </p>
      {result?.status === "ready" && (
        <>
          <Image
            src={`data:image/png;base64,${result.encodedImage}`}
            width={180}
            height={180}
            alt="QR Code Pix do Asaas Sandbox"
            unoptimized
          />
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(result.payload);
                toast.success("Código Pix copiado.");
              } catch {
                toast.error("Não foi possível copiar o código.");
              }
            }}
          >
            Copiar código Pix
          </Button>
        </>
      )}
      {result?.status === "unavailable" && (
        <p role="status" className="text-sm text-muted-foreground">
          Pix indisponível para esta fatura. Consulte novamente em instantes.
        </p>
      )}
      {result?.status === "received" && <p role="status">Pagamento confirmado.</p>}
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const next = await getInvoiceSandboxPix(slug, invoiceId);
            setResult(next);
            router.refresh();
          })
        }
      >
        {pending ? "Consultando…" : result ? "Consultar Pix" : "Gerar Pix de teste"}
      </Button>
    </section>
  );
}
