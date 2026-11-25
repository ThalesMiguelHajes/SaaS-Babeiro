"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatInTimeZone } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { localToInstant } from "@/modules/availability/rules";

function shift(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Navegação por dia e troca entre as visões Dia e Lista (estado na URL). */
export function AgendaToolbar({
  basePath,
  date,
  today,
  timeZone,
  view,
}: {
  basePath: string;
  date: string;
  today: string;
  timeZone: string;
  view: "dia" | "lista";
}) {
  const router = useRouter();
  const href = (d: string) => `${basePath}?data=${d}`;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {view === "dia" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href={href(shift(date, -1))} aria-label="Dia anterior">
              <ChevronLeftIcon aria-hidden />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={href(today)}>Hoje</Link>
          </Button>
          <Button variant="outline" size="icon" asChild>
            <Link href={href(shift(date, 1))} aria-label="Próximo dia">
              <ChevronRightIcon aria-hidden />
            </Link>
          </Button>
          <Input
            type="date"
            aria-label="Ir para a data"
            className="w-40"
            value={date}
            onChange={(e) => e.target.value && router.push(href(e.target.value))}
          />
          <span className="text-sm font-medium first-letter:uppercase">
            {formatInTimeZone(
              localToInstant(date, "12:00", timeZone),
              "EEEE, d 'de' MMMM",
              timeZone,
            )}
          </span>
        </div>
      ) : (
        <span />
      )}
      <nav className="flex rounded-lg border p-0.5 text-sm" aria-label="Visão da agenda">
        {(["dia", "lista"] as const).map((v) => (
          <Link
            key={v}
            href={v === "dia" ? href(date) : `${basePath}?visao=lista`}
            aria-current={view === v ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1",
              view === v ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v === "dia" ? "Dia" : "Lista"}
          </Link>
        ))}
      </nav>
    </div>
  );
}
