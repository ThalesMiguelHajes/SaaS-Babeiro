"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import type { Result } from "@/lib/result";

import type { ConflictPreview, SaveScheduleResult } from "../actions";

/**
 * Fluxo de salvar com pré-visualização de conflitos:
 * 1ª chamada com confirm=false; se houver agendamentos afetados, abre o diálogo;
 * ao confirmar, repete com confirm=true.
 */
export function useScheduleSave(successMessage: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [conflicts, setConflicts] = useState<ConflictPreview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingCall = useRef<{
    call: (confirm: boolean) => Promise<Result<SaveScheduleResult>>;
    onSaved?: () => void;
  } | null>(null);

  function run(confirm: boolean) {
    const current = pendingCall.current;
    if (!current) return;
    const { call, onSaved } = current;
    setError(null);
    startTransition(async () => {
      const result = await call(confirm);
      if (!result.ok) {
        setError(result.error.message);
        setConflicts(null);
        toast.error(result.error.message);
        return;
      }
      if (!result.data.saved) {
        setConflicts(result.data.conflicts);
        return;
      }
      setConflicts(null);
      pendingCall.current = null;
      toast.success(
        result.data.conflicts.length > 0
          ? `${successMessage} Confira os agendamentos que precisam de atenção.`
          : successMessage,
      );
      onSaved?.();
      router.refresh();
    });
  }

  return {
    pending,
    conflicts,
    error,
    save(call: (confirm: boolean) => Promise<Result<SaveScheduleResult>>, onSaved?: () => void) {
      pendingCall.current = { call, onSaved };
      run(false);
    },
    confirm() {
      run(true);
    },
    cancel() {
      setConflicts(null);
      pendingCall.current = null;
    },
  };
}
