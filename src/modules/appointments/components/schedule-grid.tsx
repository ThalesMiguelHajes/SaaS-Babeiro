"use client";

import { TZDate } from "@date-fns/tz";
import { useSyncExternalStore } from "react";

import { formatInTimeZone } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { blockKindLabel } from "@/modules/schedules/rules";

import { STATUS_LABEL, STATUS_TONE, gridRange } from "../rules";
import type { AgendaDay } from "../types";

const PX_PER_MIN = 1.6; // 15 min = 24 px
const SNAP_MIN = 15;

/** Minutos desde a meia-noite local da data exibida (pode passar de 1440 ou ficar negativo). */
function minutesFrom(iso: string, dayStartMs: number): number {
  return Math.round((new Date(iso).getTime() - dayStartMs) / 60_000);
}

function subscribeMinute(cb: () => void) {
  const t = setInterval(cb, 60_000);
  return () => clearInterval(t);
}

/**
 * Agenda do dia em colunas por profissional (DESIGN_SYSTEM §5.2): fora do expediente hachurado,
 * bloqueios em cinza, linha do "agora". Clique em espaço livre → novo agendamento naquele horário.
 */
export function ScheduleGrid({
  day,
  date,
  onAppointmentClick,
  onEmptyClick,
}: {
  day: AgendaDay;
  date: string;
  onAppointmentClick: (id: string) => void;
  onEmptyClick?: (professionalId: string, startsAt: string) => void;
}) {
  const tz = day.timezone;
  const [y, m, d] = date.split("-").map(Number);
  const dayStart = new TZDate(y!, m! - 1, d!, 0, 0, tz).getTime();
  const now = useSyncExternalStore(
    subscribeMinute,
    () => Math.floor(Date.now() / 60_000),
    () => 0,
  );
  const nowMin = now ? Math.round((now * 60_000 - dayStart) / 60_000) : -1;

  const spans = [
    ...day.professionals.flatMap((p) =>
      p.work.map(([s, e]) => ({ start: minutesFrom(s, dayStart), end: minutesFrom(e, dayStart) })),
    ),
    ...day.appointments.map((a) => ({
      start: minutesFrom(a.starts_at, dayStart),
      end: minutesFrom(a.ends_at, dayStart),
    })),
  ].map((s) => ({ start: Math.max(0, s.start), end: Math.min(1440, s.end) }));
  const range = gridRange(spans);
  const height = (range.end - range.start) * PX_PER_MIN;
  const hours: number[] = [];
  for (let h = range.start; h < range.end; h += 60) hours.push(h);

  const top = (min: number) => (Math.max(min, range.start) - range.start) * PX_PER_MIN;
  const size = (start: number, end: number) =>
    Math.max((Math.min(end, range.end) - Math.max(start, range.start)) * PX_PER_MIN, 18);

  if (day.professionals.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhum profissional ativo. Cadastre os profissionais para usar a agenda.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border" data-testid="schedule-grid">
      <div className="flex w-fit min-w-full">
        {/* Régua de horas */}
        <div className="sticky left-0 z-20 w-14 shrink-0 border-r bg-background">
          <div className="h-12 border-b" />
          <div className="relative" style={{ height }}>
            {hours.map((h) => (
              <span
                key={h}
                className="absolute right-2 text-xs text-muted-foreground tabular-nums"
                style={{ top: top(h) + 2 }}
              >
                {String(Math.floor(h / 60)).padStart(2, "0")}:00
              </span>
            ))}
          </div>
        </div>

        {day.professionals.map((p) => {
          const work = p.work.map(
            ([s, e]) => [minutesFrom(s, dayStart), minutesFrom(e, dayStart)] as const,
          );
          const blocks = day.blocks.filter((b) => !b.professional_id || b.professional_id === p.id);
          const appts = day.appointments.filter((a) => a.professional_id === p.id);
          return (
            <div
              key={p.id}
              className="min-w-44 flex-1 border-r last:border-r-0 sm:min-w-52"
              role="group"
              aria-label={`Agenda de ${p.display_name}`}
            >
              <div className="sticky top-0 flex h-12 items-center gap-2 border-b bg-background px-3">
                <span className="truncate text-sm font-medium">{p.display_name}</span>
                {!p.is_active && <span className="text-xs text-muted-foreground">(inativo)</span>}
              </div>
              <div
                className={cn(
                  "relative bg-[repeating-linear-gradient(135deg,var(--muted)_0,var(--muted)_6px,transparent_6px,transparent_12px)]",
                  onEmptyClick && "cursor-pointer",
                )}
                style={{ height }}
                onClick={(e) => {
                  if (!onEmptyClick || e.target !== e.currentTarget) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const min = range.start + (e.clientY - rect.top) / PX_PER_MIN;
                  const snapped = Math.floor(min / SNAP_MIN) * SNAP_MIN;
                  onEmptyClick(p.id, new Date(dayStart + snapped * 60_000).toISOString());
                }}
              >
                {/* Expediente (fundo liso) */}
                {work.map(([s, e]) => (
                  <div
                    key={s}
                    className="pointer-events-none absolute inset-x-0 bg-background"
                    style={{ top: top(s), height: size(s, e) }}
                  />
                ))}
                {/* Linhas de hora */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/70"
                    style={{ top: top(h) }}
                  />
                ))}
                {blocks.map((b) => {
                  const s = minutesFrom(b.starts_at, dayStart);
                  const e = minutesFrom(b.ends_at, dayStart);
                  if (e <= range.start || s >= range.end) return null;
                  return (
                    <div
                      key={b.id}
                      className="pointer-events-none absolute inset-x-1 overflow-hidden rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                      style={{ top: top(s), height: size(s, e) }}
                    >
                      {blockKindLabel(b.kind)}
                      {b.reason ? ` · ${b.reason}` : ""}
                    </div>
                  );
                })}
                {appts.map((a) => {
                  const s = minutesFrom(a.starts_at, dayStart);
                  const e = minutesFrom(a.ends_at, dayStart);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onAppointmentClick(a.id)}
                      className={cn(
                        "absolute inset-x-1 z-10 flex flex-col overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-xs shadow-xs transition-shadow hover:shadow-md",
                        STATUS_TONE[a.status],
                      )}
                      style={{ top: top(s), height: size(s, e) }}
                      aria-label={`${formatInTimeZone(a.starts_at, "HH:mm", tz)} ${a.customer_name}, ${a.service_name}, ${STATUS_LABEL[a.status]}`}
                    >
                      <span className="font-semibold tabular-nums">
                        {formatInTimeZone(a.starts_at, "HH:mm", tz)} · {a.customer_name}
                      </span>
                      <span className="truncate">{a.service_name}</span>
                      {e - s >= 45 && (
                        <span className="truncate opacity-80">
                          {STATUS_LABEL[a.status]}
                          {a.status === "completed" &&
                            a.paid_cents > 0 &&
                            ` · ${formatCents(a.paid_cents)}`}
                        </span>
                      )}
                    </button>
                  );
                })}
                {nowMin >= range.start && nowMin <= range.end && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500"
                    style={{ top: top(nowMin) }}
                    aria-hidden
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
