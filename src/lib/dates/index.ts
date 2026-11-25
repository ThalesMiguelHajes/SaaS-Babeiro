import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** Formata um instante no fuso do estabelecimento, em pt-BR. */
export function formatInTimeZone(
  instant: Date | string,
  pattern: string,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const date = new TZDate(typeof instant === "string" ? new Date(instant) : instant, timeZone);
  return format(date, pattern, { locale: ptBR });
}

export const formatDate = (instant: Date | string, timeZone?: string) =>
  formatInTimeZone(instant, "dd/MM/yyyy", timeZone);

export const formatTime = (instant: Date | string, timeZone?: string) =>
  formatInTimeZone(instant, "HH:mm", timeZone);

export const formatDateTime = (instant: Date | string, timeZone?: string) =>
  formatInTimeZone(instant, "dd/MM/yyyy 'às' HH:mm", timeZone);

export const formatLongDate = (instant: Date | string, timeZone?: string) =>
  formatInTimeZone(instant, "EEEE, d 'de' MMMM", timeZone);
