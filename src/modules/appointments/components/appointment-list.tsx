import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatInTimeZone } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import { STATUS_LABEL, STATUS_TONE, type AppointmentStatus } from "../rules";
import type { ListFilters } from "../schemas";

type Row = {
  id: string;
  starts_at: string;
  status: AppointmentStatus;
  service_name_snapshot: string;
  customer_name_snapshot: string;
  price_cents_snapshot: number;
  final_price_cents: number | null;
  professionals: { display_name: string } | null;
};

/** Visão "Lista": período, profissional e situação (filtros na URL, formulário GET). */
export function AppointmentList({
  basePath,
  rows,
  filters,
  professionals,
  timeZone,
}: {
  basePath: string;
  rows: Row[];
  filters: ListFilters;
  professionals: { id: string; display_name: string }[];
  timeZone: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="visao" value="lista" />
        <label className="flex flex-col gap-1 text-sm">
          De
          <Input type="date" name="de" defaultValue={filters.from} className="w-40" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Até
          <Input type="date" name="ate" defaultValue={filters.to} className="w-40" />
        </label>
        {professionals.length > 1 && (
          <label className="flex flex-col gap-1 text-sm">
            Profissional
            <NativeSelect name="profissional" defaultValue={filters.professionalId ?? ""}>
              <NativeSelectOption value="">Todos</NativeSelectOption>
              {professionals.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.display_name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Situação
          <NativeSelect name="status" defaultValue={filters.status ?? ""}>
            <NativeSelectOption value="">Todas</NativeSelectOption>
            {(Object.keys(STATUS_LABEL) as AppointmentStatus[]).map((s) => (
              <NativeSelectOption key={s} value={s}>
                {STATUS_LABEL[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum agendamento nesse período.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border text-sm">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`${basePath}?data=${formatInTimeZone(r.starts_at, "yyyy-MM-dd", timeZone)}&abrir=${r.id}`}
                className="flex flex-col gap-1 px-3 py-2.5 hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="w-36 shrink-0 font-medium capitalize tabular-nums">
                  {formatInTimeZone(r.starts_at, "EEE dd/MM HH:mm", timeZone)}
                </span>
                <span className="flex-1">
                  {r.customer_name_snapshot}
                  <span className="text-muted-foreground">
                    {" "}
                    · {r.service_name_snapshot} · {r.professionals?.display_name}
                  </span>
                </span>
                <span className="tabular-nums">
                  {formatCents(r.final_price_cents ?? r.price_cents_snapshot)}
                </span>
                <span
                  className={cn(
                    "w-fit rounded-full border px-2 py-0.5 text-xs",
                    STATUS_TONE[r.status],
                  )}
                >
                  {STATUS_LABEL[r.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {rows.length >= 500 && (
        <p className="text-sm text-muted-foreground">
          Mostrando os 500 primeiros. Reduza o período.
        </p>
      )}
    </div>
  );
}
