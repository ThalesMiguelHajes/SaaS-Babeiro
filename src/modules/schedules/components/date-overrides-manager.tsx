"use client";

import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatInTimeZone } from "@/lib/dates";
import { localToInstant } from "@/modules/availability/rules";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { deleteDateOverrideAction, saveDateOverrideAction } from "../actions";
import { describeIntervals, type TimeInterval } from "../rules";
import { dateOverrideSchema } from "../schemas";
import { ConflictsDialog } from "./conflicts-dialog";
import { useScheduleSave } from "./use-schedule-save";

type Override = {
  date: string;
  kind: "closed" | "custom_hours";
  label: string | null;
  intervals: TimeInterval[];
};

/** Feriados, folgas e horários especiais por data (substituem o horário semanal do dia). */
export function DateOverridesManager({
  slug,
  professionalId,
  overrides,
  today,
  timeZone,
  closedLabel,
}: {
  slug: string;
  professionalId: string | null;
  overrides: Override[];
  today: string;
  timeZone: string;
  closedLabel: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [kind, setKind] = useState<"closed" | "custom_hours">("closed");
  const [intervals, setIntervals] = useState<TimeInterval[]>([{ start: "09:00", end: "13:00" }]);
  const [label, setLabel] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const saver = useScheduleSave("Data salva.");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = { date, kind, intervals: kind === "closed" ? [] : intervals, label };
    const parsed = dateOverrideSchema.safeParse(input);
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? "Confira os campos.");
      return;
    }
    setLocalError(null);
    saver.save(
      (confirm) => saveDateOverrideAction(slug, professionalId, input, confirm),
      () => {
        setDate("");
        setLabel("");
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y rounded-lg border">
        {overrides.length === 0 && (
          <li className="px-3 py-3 text-sm text-muted-foreground">
            Nenhuma data especial cadastrada.
          </li>
        )}
        {overrides.map((o) => (
          <li key={o.date} className="flex items-center gap-3 px-3 py-2">
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium">
                {formatInTimeZone(
                  localToInstant(o.date, "12:00", timeZone),
                  "EEE, dd/MM/yyyy",
                  timeZone,
                )}
                {o.label ? ` · ${o.label}` : ""}
              </span>
              <span className="text-sm text-muted-foreground">
                {o.kind === "closed"
                  ? closedLabel
                  : `Horário especial: ${describeIntervals(o.intervals)}`}
              </span>
            </div>
            <ConfirmDialog
              trigger={
                <Button size="icon-sm" variant="ghost" aria-label={`Remover a data ${o.date}`}>
                  <Trash2Icon aria-hidden />
                </Button>
              }
              title="Remover esta data especial?"
              description="O dia volta a seguir o horário semanal."
              confirmLabel="Remover"
              destructive
              onConfirm={async () => {
                const result = await deleteDateOverrideAction(slug, professionalId, o.date);
                if (!result.ok) return result.error.message;
                toast.success("Data removida.");
                router.refresh();
                return null;
              }}
            />
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border p-3" noValidate>
        <FormAlert message={localError ?? saver.error} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor={`ov-date-${professionalId ?? "est"}`}>Data</FieldLabel>
            <Input
              id={`ov-date-${professionalId ?? "est"}`}
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`ov-kind-${professionalId ?? "est"}`}>Nesse dia</FieldLabel>
            <NativeSelect
              id={`ov-kind-${professionalId ?? "est"}`}
              className="w-full"
              value={kind}
              onChange={(e) => setKind(e.target.value as "closed" | "custom_hours")}
            >
              <NativeSelectOption value="closed">{closedLabel}</NativeSelectOption>
              <NativeSelectOption value="custom_hours">Horário especial</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor={`ov-label-${professionalId ?? "est"}`}>
              Descrição (opcional)
            </FieldLabel>
            <Input
              id={`ov-label-${professionalId ?? "est"}`}
              placeholder="Ex.: Natal"
              maxLength={80}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>
        </div>

        {kind === "custom_hours" && (
          <div className="flex flex-col gap-2">
            {intervals.map((interval, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2">
                <Input
                  type="time"
                  step={300}
                  className="w-28"
                  aria-label={`Início do intervalo ${idx + 1}`}
                  value={interval.start}
                  onChange={(e) =>
                    setIntervals((prev) =>
                      prev.map((i, j) => (j === idx ? { ...i, start: e.target.value } : i)),
                    )
                  }
                />
                <span className="text-sm text-muted-foreground">às</span>
                <Input
                  type="time"
                  step={300}
                  className="w-28"
                  aria-label={`Fim do intervalo ${idx + 1}`}
                  value={interval.end}
                  onChange={(e) =>
                    setIntervals((prev) =>
                      prev.map((i, j) => (j === idx ? { ...i, end: e.target.value } : i)),
                    )
                  }
                />
                {intervals.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remover intervalo ${idx + 1}`}
                    onClick={() => setIntervals((prev) => prev.filter((_, j) => j !== idx))}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                )}
              </div>
            ))}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setIntervals((prev) => [
                    ...prev,
                    { start: prev.at(-1)?.end ?? "14:00", end: "18:00" },
                  ])
                }
              >
                <PlusIcon aria-hidden />
                Intervalo
              </Button>
            </div>
          </div>
        )}

        <div>
          <Button type="submit" variant="outline" disabled={saver.pending || !date}>
            {saver.pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Adicionar data
          </Button>
        </div>
      </form>

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
