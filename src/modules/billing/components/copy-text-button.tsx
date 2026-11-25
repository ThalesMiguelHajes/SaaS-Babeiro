"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function CopyTextButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success("Copiado.");
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Não foi possível copiar. Selecione e copie manualmente.");
        }
      }}
    >
      {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      {label}
    </Button>
  );
}
