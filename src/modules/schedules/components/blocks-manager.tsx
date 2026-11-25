"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { formatInTimeZone } from "@/lib/dates";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { deleteBlockAction, saveBlockAction } from "../actions";
import { BLOCK_KINDS, blockKindLabel } from "../rules";
import { blockSchema, type BlockInput } from "../schemas";
import { ConflictsDialog } from "./conflicts-dialog";
import { useScheduleSave } from "./use-schedule-save";

type Block = {
  id: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  kind: string;
  reason: string | null;
};

function describePeriod(b: Block, tz: string): string {
  if (b.allDay) {
    // O fim do dia inteiro é a meia-noite do dia seguinte.
    const last = new Date(new Date(b.endsAt).getTime() - 60_000);
    const start = formatInTimeZone(b.startsAt, "dd/MM/yyyy", tz);
    const end = formatInTimeZone(last, "dd/MM/yyyy", tz);
    return start === end ? `${start} (dia inteiro)` : `${start} a ${end}`;
  }
  const startDay = formatInTimeZone(b.startsAt, "dd/MM/yyyy", tz);
  const endDay = formatInTimeZone(b.endsAt, "dd/MM/yyyy", tz);
  return startDay === endDay
    ? `${startDay}, ${formatInTimeZone(b.startsAt, "HH:mm", tz)} às ${formatInTimeZone(b.endsAt, "HH:mm", tz)}`
    : `${formatInTimeZone(b.startsAt, "dd/MM/yyyy HH:mm", tz)} a ${formatInTimeZone(b.endsAt, "dd/MM/yyyy HH:mm", tz)}`;
}

/** Bloqueios (pausas, compromissos, férias, eventos). Podem ficar sobre agendamentos, com aviso. */
export function BlocksManager({
  slug,
  professionalId,
  blocks,
  today,
  timeZone,
  defaultKind = "personal",
  readOnly = false,
}: {
  slug: string;
  professionalId: string | null;
  blocks: Block[];
  today: string;
  timeZone: string;
  defaultKind?: BlockInput["kind"];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const empty: BlockInput = {
    professionalId,
    allDay: false,
    startDate: today,
    endDate: today,
    startTime: "12:00",
    endTime: "13:00",
    kind: defaultKind,
    reason: "",
  };
  const [form, setForm] = useState<BlockInput>(empty);
  const [localError, setLocalError] = useState<string | null>(null);
  const saver = useScheduleSave("Bloqueio salvo.");
  const idp = professionalId ?? "est";

  function set<K extends keyof BlockInput>(key: K, value: BlockInput[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "startDate" && next.endDate < (value as string)) next.endDate = value as string;
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = blockSchema.safeParse(form);
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? "Confira os campos.");
      return;
    }
    setLocalError(null);
    saver.save(
      (confirm) => saveBlockAction(slug, null, form, confirm),
      () => setForm(empty),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y rounded-lg border">
        {blocks.length === 0 && (
          <li className="px-3 py-3 text-sm text-muted-foreground">Nenhum bloqueio programado.</li>
        )}
        {blocks.map((b) => (
          <li key={b.id} className="flex items-center gap-3 px-3 py-2">
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium">
                {blockKindLabel(b.kind)}
                {b.reason ? ` · ${b.reason}` : ""}
              </span>
              <span className="text-sm text-muted-foreground">{describePeriod(b, timeZone)}</span>
            </div>
            {!readOnly && (
              <ConfirmDialog
                trigger={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remover bloqueio ${blockKindLabel(b.kind)}`}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                }
                title="Remover este bloqueio?"
                description="O período volta a ficar disponível para agendamentos."
                confirmLabel="Remover"
                destructive
                onConfirm={async () => {
                  const result = await deleteBlockAction(slug, b.id);
                  if (!result.ok) return result.error.message;
                  toast.success("Bloqueio removido.");
                  router.refresh();
                  return null;
                }}
              />
            )}
          </li>
        ))}
      </ul>

      {!readOnly && (
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border p-3" noValidate>
          <FormAlert message={localError ?? saver.error} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`bl-kind-${idp}`}>Tipo</FieldLabel>
              <NativeSelect
                id={`bl-kind-${idp}`}
                className="w-full"
                value={form.kind}
                onChange={(e) => set("kind", e.target.value)}
              >
                {BLOCK_KINDS.map((k) => (
                  <NativeSelectOption key={k.value} value={k.value}>
                    {k.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor={`bl-reason-${idp}`}>Observação interna (opcional)</FieldLabel>
              <Input
                id={`bl-reason-${idp}`}
                maxLength={200}
                placeholder="Não aparece para o cliente"
                value={form.reason}
                onChange={(e) => set("reason", e.target.value)}
              />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id={`bl-allday-${idp}`}
              checked={form.allDay}
              onCheckedChange={(v) => set("allDay", v)}
            />
            <label htmlFor={`bl-allday-${idp}`} className="text-sm">
              Dia inteiro
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-wrap items-end gap-2">
              <Field className="w-auto">
                <FieldLabel htmlFor={`bl-sd-${idp}`}>Início</FieldLabel>
                <Input
                  id={`bl-sd-${idp}`}
                  type="date"
                  min={today}
                  value={form.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                />
              </Field>
              {!form.allDay && (
                <Input
                  type="time"
                  step={300}
                  className="w-28"
                  aria-label="Hora de início"
                  value={form.startTime}
                  onChange={(e) => set("startTime", e.target.value)}
                />
              )}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Field className="w-auto">
                <FieldLabel htmlFor={`bl-ed-${idp}`}>Fim</FieldLabel>
                <Input
                  id={`bl-ed-${idp}`}
                  type="date"
                  min={form.startDate}
                  value={form.endDate}
                  onChange={(e) => set("endDate", e.target.value)}
                />
              </Field>
              {!form.allDay && (
                <Input
                  type="time"
                  step={300}
                  className="w-28"
                  aria-label="Hora de fim"
                  value={form.endTime}
                  onChange={(e) => set("endTime", e.target.value)}
                />
              )}
            </div>
          </div>
          <div>
            <Button type="submit" variant="outline" disabled={saver.pending}>
              {saver.pending && <Loader2Icon className="animate-spin" aria-hidden />}
              Adicionar bloqueio
            </Button>
          </div>
        </form>
      )}

      <ConflictsDialog
        conflicts={saver.conflicts}
        timeZone={timeZone}
        pending={saver.pending}
        onCancel={saver.cancel}
        onConfirm={saver.confirm}
      />
    </div>
  );
}
