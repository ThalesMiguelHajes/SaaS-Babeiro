"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { formatInTimeZone } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { groupSlotsByPeriod, localToInstant, todayInTimeZone } from "@/modules/availability/rules";

import { getAvailableDatesAction, getAvailableSlotsAction } from "../actions";

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Faixa de dias com horário + chips de horários agrupados em Manhã/Tarde/Noite.
 * Datas sem horário não aparecem (o motor decide). `reloadKey` força nova busca
 * (ex.: depois de "esse horário acabou de ser reservado").
 */
export function DateTimePicker({
  slug,
  serviceId,
  professionalId,
  timeZone,
  maxDaysAhead,
  date,
  startsAt,
  reloadKey = 0,
  onDateChange,
  onSlotChange,
}: {
  slug: string;
  serviceId: string;
  professionalId: string | null;
  timeZone: string;
  maxDaysAhead: number;
  date: string | null;
  startsAt: string | null;
  reloadKey?: number;
  onDateChange: (date: string) => void;
  onSlotChange: (startsAt: string) => void;
}) {
  const [dates, setDates] = useState<string[] | null>(null);
  const [slots, setSlots] = useState<{ date: string; items: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingDates, startDates] = useTransition();
  const [loadingSlots, startSlots] = useTransition();

  useEffect(() => {
    let active = true;
    const today = todayInTimeZone(timeZone);
    startDates(async () => {
      const result = await getAvailableDatesAction({
        slug,
        serviceId,
        professionalId,
        from: today,
        to: addDays(today, Math.min(maxDaysAhead, 61)),
      });
      if (!active) return;
      if (result.ok) {
        setDates(result.data);
        setError(null);
      } else setError(result.error.message);
    });
    return () => {
      active = false;
    };
  }, [slug, serviceId, professionalId, timeZone, maxDaysAhead, reloadKey]);

  const selectedDate = date && dates?.includes(date) ? date : (dates?.[0] ?? null);

  useEffect(() => {
    if (!selectedDate) return;
    let active = true;
    startSlots(async () => {
      const result = await getAvailableSlotsAction({
        slug,
        serviceId,
        professionalId,
        date: selectedDate,
      });
      if (!active) return;
      if (result.ok) {
        setSlots({ date: selectedDate, items: result.data });
        setError(null);
      } else setError(result.error.message);
    });
    return () => {
      active = false;
    };
  }, [slug, serviceId, professionalId, selectedDate, reloadKey]);

  if (dates === null) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status">
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
        Buscando os dias disponíveis…
      </div>
    );
  }

  if (dates.length === 0) {
    return (
      <p
        className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground"
        role="status"
      >
        {error ??
          "Não há horários disponíveis nos próximos dias. Tente outro profissional ou fale com o estabelecimento."}
      </p>
    );
  }

  const items = slots && slots.date === selectedDate ? slots.items : null;

  return (
    <div className="flex flex-col gap-5">
      <div
        className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1"
        role="listbox"
        aria-label="Dias disponíveis"
      >
        {dates.map((d) => {
          const instant = localToInstant(d, "12:00", timeZone);
          const selected = d === selectedDate;
          return (
            <button
              key={d}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onDateChange(d)}
              className={cn(
                "flex min-h-16 min-w-16 shrink-0 snap-start flex-col items-center justify-center rounded-xl border px-2 text-sm transition-colors",
                selected
                  ? "border-transparent bg-[var(--brand)] text-[var(--brand-foreground)]"
                  : "hover:bg-muted",
              )}
            >
              <span className="text-xs capitalize opacity-80">
                {formatInTimeZone(instant, "EEE", timeZone).replace(".", "")}
              </span>
              <span className="text-lg font-semibold tabular-nums">
                {formatInTimeZone(instant, "dd", timeZone)}
              </span>
              <span className="text-xs capitalize opacity-80">
                {formatInTimeZone(instant, "MMM", timeZone).replace(".", "")}
              </span>
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {items === null || loadingSlots || loadingDates ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground" role="status">
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
          Buscando horários…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground" role="status">
          Os horários deste dia acabaram de ser preenchidos. Escolha outro dia.
        </p>
      ) : (
        <div className="flex flex-col gap-4" aria-live="polite">
          {groupSlotsByPeriod(
            items.map((t) => ({ startsAt: t })),
            timeZone,
          ).map((group) => (
            <section key={group.period} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">{group.label}</h3>
              <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {group.slots.map(({ startsAt: t }) => {
                  const selected = t === startsAt;
                  return (
                    <li key={t}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onSlotChange(t)}
                        className={cn(
                          "min-h-11 w-full rounded-full border text-sm font-medium tabular-nums transition-colors",
                          selected
                            ? "border-transparent bg-[var(--brand)] text-[var(--brand-foreground)]"
                            : "hover:bg-muted",
                        )}
                      >
                        {formatInTimeZone(t, "HH:mm", timeZone)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
