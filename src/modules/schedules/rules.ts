/**
 * Regras puras de horários (sem I/O). O banco é a autoridade; estas funções servem para
 * validar formulários e montar a interface.
 */

export const WEEKDAYS = [
  { value: 1, short: "Seg", label: "Segunda-feira" },
  { value: 2, short: "Ter", label: "Terça-feira" },
  { value: 3, short: "Qua", label: "Quarta-feira" },
  { value: 4, short: "Qui", label: "Quinta-feira" },
  { value: 5, short: "Sex", label: "Sexta-feira" },
  { value: 6, short: "Sáb", label: "Sábado" },
  { value: 0, short: "Dom", label: "Domingo" },
] as const;

export type TimeInterval = { start: string; end: string };
export type WeekDayHours = { weekday: number; intervals: TimeInterval[] };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** "09:30" → 570. Aceita "24:00" (fim do dia). */
export function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Normaliza "09:00:00" (formato do Postgres) para "09:00"; "24:00:00" continua "24:00". */
export function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

/** Índice do primeiro intervalo que se sobrepõe a um anterior (ou começa antes de terminar), senão -1. */
export function findIntervalProblem(intervals: TimeInterval[]): number {
  for (let i = 0; i < intervals.length; i++) {
    const a = intervals[i]!;
    if (!isValidTime(a.start) || !isValidTime(a.end)) return i;
    if (timeToMinutes(a.start) >= timeToMinutes(a.end)) return i;
    for (let j = 0; j < i; j++) {
      const b = intervals[j]!;
      if (
        timeToMinutes(a.start) < timeToMinutes(b.end) &&
        timeToMinutes(b.start) < timeToMinutes(a.end)
      ) {
        return i;
      }
    }
  }
  return -1;
}

export function sortIntervals(intervals: TimeInterval[]): TimeInterval[] {
  return [...intervals].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
}

/** Agrupa linhas do banco por dia da semana, na ordem de exibição (segunda → domingo). */
export function groupWeeklyHours(
  rows: { weekday: number; start_time: string; end_time: string }[],
): WeekDayHours[] {
  return WEEKDAYS.map(({ value }) => ({
    weekday: value,
    intervals: sortIntervals(
      rows
        .filter((r) => r.weekday === value)
        .map((r) => ({ start: normalizeTime(r.start_time), end: normalizeTime(r.end_time) })),
    ),
  }));
}

/** Formato aceito pelas RPCs de horário semanal. */
export function toWeeklyPayload(days: WeekDayHours[]) {
  return days.flatMap((d) =>
    d.intervals.map((i) => ({ weekday: d.weekday, start: i.start, end: i.end })),
  );
}

export function describeIntervals(intervals: TimeInterval[]): string {
  if (intervals.length === 0) return "Fechado";
  return intervals.map((i) => `${i.start}–${i.end}`).join(" · ");
}

export const BLOCK_KINDS = [
  { value: "break", label: "Pausa" },
  { value: "personal", label: "Compromisso pessoal" },
  { value: "vacation", label: "Férias" },
  { value: "day_off", label: "Folga" },
  { value: "absence", label: "Ausência" },
  { value: "holiday", label: "Feriado" },
  { value: "other", label: "Outro" },
] as const;

export type BlockKind = (typeof BLOCK_KINDS)[number]["value"];

export function blockKindLabel(kind: string): string {
  return BLOCK_KINDS.find((k) => k.value === kind)?.label ?? "Bloqueio";
}

export const CONFLICT_REASON_LABEL: Record<string, string> = {
  outside_hours: "Fora do horário de trabalho",
  blocked: "Em cima de um bloqueio",
};
