"use client";

/* eslint-disable @next/next/no-img-element -- imagens do Storage, sem otimização para não consumir a cota da Vercel */
import { ImageIcon, Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Result } from "@/lib/result";
import { cn } from "@/lib/utils";

/**
 * Campo de upload de imagem. A Server Action recebe o FormData com `file` (ou `remove=1`)
 * mais os `fields` informados, e valida tipo real, tamanho e permissão no servidor.
 */
export function ImageUploadField({
  label,
  hint,
  currentUrl,
  shape = "square",
  fields,
  action,
}: {
  label: string;
  hint: string;
  currentUrl: string | null;
  shape?: "square" | "wide" | "round";
  fields: Record<string, string>;
  action: (formData: FormData) => Promise<Result<unknown>>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function send(file: File | null, remove = false) {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    if (file) data.set("file", file);
    if (remove) data.set("remove", "1");
    startTransition(async () => {
      const result = await action(data);
      if (!result.ok) toast.error(result.error.message);
      else {
        toast.success(remove ? "Imagem removida." : "Imagem atualizada.");
        router.refresh();
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden border bg-muted",
          shape === "square" && "size-24 rounded-lg",
          shape === "round" && "size-24 rounded-full",
          shape === "wide" && "aspect-[16/7] w-full max-w-md rounded-lg",
        )}
      >
        {currentUrl ? (
          <img src={currentUrl} alt={label} className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) send(file);
        }}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : (
            <UploadIcon aria-hidden />
          )}
          {currentUrl ? "Trocar" : "Enviar"}
        </Button>
        {currentUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => send(null, true)}
          >
            <Trash2Icon aria-hidden /> Remover
          </Button>
        )}
      </div>
    </div>
  );
}
