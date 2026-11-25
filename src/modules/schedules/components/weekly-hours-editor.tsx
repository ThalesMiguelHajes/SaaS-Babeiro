"use client";

import { CopyIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormAlert } from "@/modules/auth/components/form-alert";

import { saveWeeklyHoursAction } from "../actions";
import { WEEKDAYS, findIntervalProblem, type WeekDayHours } from "../rules";
import { weeklyHoursSchema } from "../schemas";
import { ConflictsDialog } from "./conflicts-dialog";
import { useScheduleSave } from "./use-schedule-save";

const DEFAULT_INTERVAL = { start: "09:00", end: "18:00" };

/**
 * Editor do horário semanal: vários intervalos por dia (ex.: 09–12 e 13–18), copiar um dia
 * para os outros. Para profissionais, permite seguir o horário do estabelecimento.
 */
export function WeeklyHoursEditor({
  slug,
  professionalId,
  initialDays,
  configured,
  timeZone,
  inheritOption = false,
  readOnly = false,
}: {
  slug: string;
  professionalId: string | null;
  initialDays: WeekDayHours[];
  configured: boolean;
  timeZone: string;
  inheritOption?: boolean;
  readOnly?: boolean;
}) {
  const [days, setDays] = useState(initialDays);
  const [inherit, setInherit] = useState(inheritOption && !configured);
  const [localError, setLocalError] = useState<string | null>(null);
  const saver = useScheduleSave("Horário salvo.");

  function update(weekday: number, fn: (d: WeekDayHours) => WeekDayHours) {
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? fn(d) : d)));
  }

  function copyToOpenDays(source: WeekDayHours) {
    setDays((prev) =>
      prev.map((d) =>
        d.weekday === source.weekday || d.intervals.length === 0
          ? d
          : { ...d, intervals: source.intervals.map((i) => ({ ...i })) },
      ),
    );
  }

  function submit() {
    const payload = { days: inherit ? [] : days };
    const parsed = weeklyHoursSchema.safeParse(payload);
    if (!parsed.success) {
      setLocalError(
        "Confira os horários destacados: o fim precisa ser depois do início e os intervalos não podem se sobrepor.",
      );
      return;
    }
    setLocalError(null);
    saver.save((confirm) => saveWeeklyHoursAction(slug, professionalId, payload, confirm));
  }

  return (
    <div className="flex flex-col gap-4">
      <FormAlert message={localError ?? saver.error} />

      {inheritOption && (
        <div className="flex items-start gap-3 rounded-lg border p-3">
          <Switch
            id="inherit-hours"
            checked={inherit}
            disabled={readOnly}
            onCheckedChange={setInherit}
          />
          <FieldContent>
            <FieldLabel htmlFor="inherit-hours">Seguir o horário do estabelecimento</FieldLabel>
            <FieldDescription>
              Desligue para definir uma jornada própria (ex.: folga às segundas).
            </FieldDescription>
          </FieldContent>
        </div>
      )}

      {!inherit && (
        <ul className="flex flex-col divide-y rounded-lg border">
          {WEEKDAYS.map(({ value, label, short }) => {
            const day = days.find((d) => d.weekday === value) ?? { weekday: value, intervals: [] };
            const open = day.intervals.length > 0;
            const problem = findIntervalProblem(day.intervals);
            return (
              <li
                key={value}
                className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start"
                data-testid={`weekday-${value}`}
              >
                <div className="flex w-40 shrink-0 items-center gap-3 pt-1.5">
                  <Switch
                    id={`open-${value}`}
                    checked={open}
                    disabled={readOnly}
                    aria-label={`${label} aberto`}
                    onCheckedChange={(on) =>
                      update(value, (d) => ({
                        ...d,
                        intervals: on ? [{ ...DEFAULT_INTERVAL }] : [],
                      }))
                    }
                  />
                  <label htmlFor={`open-${value}`} className="text-sm font-medium">
                    <span className="sm:hidden">{label}</span>
                    <span className="hidden sm:inline">{short}</span>
                  </label>
                </div>

                {open ? (
                  <div className="flex flex-1 flex-col gap-2">
                    {day.intervals.map((interval, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2">
                        <Input
                          type="time"
                          step={300}
                          className="w-28"
                          value={interval.start}
                          disabled={readOnly}
                          aria-label={`${label}: início do intervalo ${idx + 1}`}
                          aria-invalid={problem === idx}
                          onChange={(e) =>
                            update(value, (d) => ({
                              ...d,
                              intervals: d.intervals.map((i, j) =>
                                j === idx ? { ...i, start: e.target.value } : i,
                              ),
                            }))
                          }
                        />
                        <span className="text-sm text-muted-foreground">às</span>
                        <Input
                          type="time"
                          step={300}
                          className="w-28"
                          value={interval.end}
                          disabled={readOnly}
                          aria-label={`${label}: fim do intervalo ${idx + 1}`}
                          aria-invalid={problem === idx}
                          onChange={(e) =>
                            update(value, (d) => ({
                              ...d,
                              intervals: d.intervals.map((i, j) =>
                                j === idx ? { ...i, end: e.target.value } : i,
                              ),
                            }))
                          }
                        />
                        {!readOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remover intervalo ${idx + 1} de ${label}`}
                            onClick={() =>
                              update(value, (d) => ({
                                ...d,
                                intervals: d.intervals.filter((_, j) => j !== idx),
                              }))
                            }
                          >
                            <Trash2Icon aria-hidden />
                          </Button>
                        )}
                      </div>
                    ))}
                    {problem >= 0 && (
                      <p className="text-sm text-destructive">
                        O fim precisa ser depois do início, sem sobrepor outro intervalo.
                      </p>
                    )}
                    {!readOnly && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const last = day.intervals.at(-1);
                            const start = last ? last.end : "09:00";
                            update(value, (d) => ({
                              ...d,
                              intervals: [
                                ...d.intervals,
                                { start, end: start < "18:00" ? "18:00" : "23:00" },
                              ],
                            }));
                          }}
                        >
                          <PlusIcon aria-hidden />
                          Intervalo
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToOpenDays(day)}
                        >
                          <CopyIcon aria-hidden />
                          Copiar para os dias abertos
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="pt-1.5 text-sm text-muted-foreground">Fechado</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly && (
        <div>
          <Button onClick={submit} disabled={saver.pending}>
            {saver.pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Salvar horário
          </Button>
        </div>
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
