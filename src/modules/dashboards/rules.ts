export const PERIODS = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "mes", label: "Este mês" },
] as const;

export type Period = (typeof PERIODS)[number]["value"];

function shift(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Datas locais (inclusivas) do período a partir de "hoje" no fuso do estabelecimento. */
export function periodRange(
  period: string | undefined,
  today: string,
): { period: Period; from: string; to: string } {
  if (period === "7d") return { period, from: shift(today, -6), to: today };
  if (period === "mes") return { period, from: `${today.slice(0, 8)}01`, to: today };
  return { period: "hoje", from: today, to: today };
}
