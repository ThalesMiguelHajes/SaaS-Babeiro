"use client";

import { CheckIcon, CopyIcon, MessageCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { whatsappLink } from "@/lib/phone";

/**
 * Link para copiar e enviar manualmente (convites, redefinição de senha).
 * "Enviar pelo WhatsApp" apenas abre o wa.me com a mensagem pronta — não há envio automático.
 */
export function CopyLinkField({
  url,
  label = "Link",
  whatsappText,
  whatsappTo = null,
}: {
  url: string;
  label?: string;
  whatsappText?: string;
  whatsappTo?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono text-xs"
          aria-label={label}
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={copy} className="flex-1 sm:flex-none">
            {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
            Copiar
          </Button>
          {whatsappText && (
            <Button type="button" variant="outline" asChild className="flex-1 sm:flex-none">
              <a
                href={whatsappLink(whatsappTo, whatsappText)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircleIcon aria-hidden />
                WhatsApp
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
