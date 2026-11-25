import { TZDate } from "@date-fns/tz";

export type DayPeriod = "morning" | "afternoon" | "evening";

export const DAY_PERIOD_LABEL: Record<DayPeriod, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite",
};

export type Slot = { startsAt: string; professionalIds: string[] };

/** Manhã: antes das 12h · Tarde: 12h–17h59 · Noite: a partir das 18h (no fuso do estabelecimento). */
export function dayPeriodOf(instant: string | Date, timeZone: string): DayPeriod {
  const hour = new TZDate(new Date(instant), timeZone).getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function groupSlotsByPeriod<T extends { startsAt: string }>(
  slots: T[],
  timeZone: string,
): { period: DayPeriod; label: string; slots: T[] }[] {
  const groups: Record<DayPeriod, T[]> = { morning: [], afternoon: [], evening: [] };
  for (const slot of slots) groups[dayPeriodOf(slot.startsAt, timeZone)].push(slot);
  return (Object.keys(groups) as DayPeriod[])
    .filter((p) => groups[p].length > 0)
    .map((p) => ({ period: p, label: DAY_PERIOD_LABEL[p], slots: groups[p] }));
}

/** "Hoje" no fuso do estabelecimento, como yyyy-MM-dd. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  const d = new TZDate(now, timeZone);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Instante de uma data + hora locais no fuso informado (ISO). */
export function localToInstant(date: string, time: string, timeZone: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(new TZDate(y!, m! - 1, d!, h ?? 0, min ?? 0, timeZone).getTime()).toISOString();
}
