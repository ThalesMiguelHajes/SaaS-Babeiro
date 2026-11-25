"use client";

import { useState } from "react";

import { formatCents } from "@/lib/money";

type Point = { month: string; invoiced_cents: number; received_cents: number };

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const label = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

/**
 * Faturado × Recebido por mês (uma escala; duas séries em cores fixas da paleta validada:
 * azul = faturado, laranja = recebido). Legenda sempre visível, valores no foco/hover e tabela.
 */
export function MonthlyChart({ data }: { data: Point[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => [d.invoiced_cents, d.received_cents]));
  const shown = active ?? data.length - 1;
  const current = data[shown];

  return (
    <figure className="flex flex-col gap-3 [--s1:#257de0] [--s2:#f47230] dark:[--s1:#338ced] dark:[--s2:#e76624]">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-4" aria-label="Legenda">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-[var(--s1)]" aria-hidden />
            Faturado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-[var(--s2)]" aria-hidden />
            Recebido
          </span>
        </div>
        {current && (
          <span className="text-muted-foreground tabular-nums" aria-live="polite">
            {label(current.month)}: faturado {formatCents(current.invoiced_cents)} · recebido{" "}
            {formatCents(current.received_cents)}
          </span>
        )}
      </div>
      <div
        className="relative flex h-48 items-end gap-1 border-b border-border"
        role="img"
        aria-label="Faturado e recebido nos últimos 12 meses"
      >
        {data.map((d, i) => (
          <button
            key={d.month}
            type="button"
            className="group flex h-full flex-1 items-end justify-center gap-[2px] rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            aria-label={`${label(d.month)}: faturado ${formatCents(d.invoiced_cents)}, recebido ${formatCents(d.received_cents)}`}
          >
            <span
              className="w-full max-w-3 rounded-t-[4px] bg-[var(--s1)] transition-opacity group-hover:opacity-80"
              style={{
                height: `${(d.invoiced_cents / max) * 100}%`,
                minHeight: d.invoiced_cents ? 2 : 0,
              }}
            />
            <span
              className="w-full max-w-3 rounded-t-[4px] bg-[var(--s2)] transition-opacity group-hover:opacity-80"
              style={{
                height: `${(d.received_cents / max) * 100}%`,
                minHeight: d.received_cents ? 2 : 0,
              }}
            />
          </button>
        ))}
      </div>
      <div className="flex gap-1 text-[10px] text-muted-foreground" aria-hidden>
        {data.map((d) => (
          <span key={d.month} className="flex-1 text-center">
            {label(d.month)}
          </span>
        ))}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Ver tabela</summary>
        <table className="mt-2 w-full">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="font-normal">Mês</th>
              <th className="text-right font-normal">Faturado</th>
              <th className="text-right font-normal">Recebido</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.month} className="border-t">
                <td className="py-1">{label(d.month)}</td>
                <td className="py-1 text-right tabular-nums">{formatCents(d.invoiced_cents)}</td>
                <td className="py-1 text-right tabular-nums">{formatCents(d.received_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
