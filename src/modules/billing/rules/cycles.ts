/**
 * Espelho de `private.billing_cycle_start` (BILLING §8.1) — só para pré-visualização.
 * O ciclo k começa sempre a partir da âncora; o dia nunca "escorrega" (31 → 28 → 31).
 */
export function billingCycleStart(
  anchorDate: string,
  anchorDay: number,
  interval: "month" | "year",
  k: number,
): string {
  const [y, m] = anchorDate.split("-").map(Number);
  const months = m! - 1 + k * (interval === "year" ? 12 : 1);
  const year = y! + Math.floor(months / 12);
  const month = (months % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(anchorDay, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
