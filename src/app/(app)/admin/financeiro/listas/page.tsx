import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { requirePlatformAdmin } from "@/lib/authz";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { todayInTimeZone } from "@/modules/availability/rules";
import { InvoiceStatusBadge } from "@/modules/billing/components/invoice-status-badge";
import {
  PAGE_SIZE,
  listInvoicesPage,
  listPaymentsPage,
  listSubscriptionsPage,
} from "@/modules/billing/queries";
import {
  INVOICE_STATUS_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  billingMethodLabel,
  effectiveInvoiceStatus,
  type SubscriptionStatus,
} from "@/modules/billing/rules";

export const metadata: Metadata = { title: "Listas do financeiro" };

const TABS = [
  { value: "assinaturas", label: "Assinaturas" },
  { value: "faturas", label: "Faturas" },
  { value: "pagamentos", label: "Pagamentos" },
] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const br = (d: string | null | undefined) =>
  d ? d.slice(0, 10).split("-").reverse().join("/") : "—";

export default async function BillingListsPage({
  searchParams,
}: PageProps<"/admin/financeiro/listas">) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.value === one(sp.aba))?.value ?? "assinaturas";
  const status = one(sp.status) || undefined;
  const from = DATE.test(one(sp.de) ?? "") ? one(sp.de) : undefined;
  const to = DATE.test(one(sp.ate) ?? "") ? one(sp.ate) : undefined;
  const page = Math.max(0, Number(one(sp.pagina) ?? 0) || 0);
  const today = todayInTimeZone("America/Sao_Paulo");
  const qs = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ aba: tab, status, de: from, ate: to, ...extra }))
      if (v !== undefined && v !== "") p.set(k, String(v));
    return `?${p}`;
  };

  const result =
    tab === "assinaturas"
      ? { kind: tab, ...(await listSubscriptionsPage({ status, page })) }
      : tab === "faturas"
        ? { kind: tab, ...(await listInvoicesPage({ status, from, to, page })) }
        : { kind: tab, ...(await listPaymentsPage({ from, to, page })) };
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Assinaturas, faturas e pagamentos"
        actions={
          <Button variant="outline" asChild>
            <a
              href={`/admin/financeiro/exportar?tipo=${tab}${from ? `&de=${from}` : ""}${to ? `&ate=${to}` : ""}`}
            >
              <DownloadIcon aria-hidden />
              Exportar CSV
            </a>
          </Button>
        }
      />
      <nav className="flex w-fit rounded-lg border p-0.5 text-sm" aria-label="Lista">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`?aba=${t.value}`}
            aria-current={tab === t.value ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1",
              tab === t.value
                ? "bg-muted font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="aba" value={tab} />
        {tab !== "pagamentos" && (
          <label className="flex flex-col gap-1 text-sm">
            Situação
            <NativeSelect name="status" defaultValue={status ?? ""}>
              <NativeSelectOption value="">Todas</NativeSelectOption>
              {tab === "assinaturas"
                ? Object.entries(SUBSCRIPTION_STATUS_LABEL).map(([v, l]) => (
                    <NativeSelectOption key={v} value={v}>
                      {l}
                    </NativeSelectOption>
                  ))
                : [
                    <NativeSelectOption key="overdue_any" value="overdue_any">
                      Vencidas (inadimplência)
                    </NativeSelectOption>,
                    ...Object.entries(INVOICE_STATUS_LABEL)
                      .filter(([v]) => v !== "draft")
                      .map(([v, l]) => (
                        <NativeSelectOption key={v} value={v}>
                          {l}
                        </NativeSelectOption>
                      )),
                  ]}
            </NativeSelect>
          </label>
        )}
        {tab !== "assinaturas" && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              De
              <Input type="date" name="de" defaultValue={from} className="w-40" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Até
              <Input type="date" name="ate" defaultValue={to} className="w-40" />
            </label>
          </>
        )}
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      <ul className="flex flex-col divide-y rounded-lg border text-sm" data-testid="billing-list">
        {result.rows.length === 0 && (
          <li className="px-3 py-4 text-muted-foreground">Nada encontrado.</li>
        )}
        {result.kind === "assinaturas" &&
          result.rows.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/estabelecimentos/${s.establishment_id}`}
                className="flex flex-wrap items-center gap-3 px-3 py-2 hover:bg-muted/50"
              >
                <span className="flex-1 font-medium">{s.establishments?.name}</span>
                <span>{s.subscription_plan_versions?.subscription_plans?.name}</span>
                <span className="tabular-nums">
                  {formatCents(
                    s.price_override_cents ??
                      s.subscription_plan_versions?.monthly_price_cents ??
                      0,
                  )}
                </span>
                <span className="text-muted-foreground">
                  desde {br(s.activated_at ?? s.contracted_at)}
                </span>
                <span className="rounded-full border px-2 py-0.5 text-xs">
                  {SUBSCRIPTION_STATUS_LABEL[s.status as SubscriptionStatus]}
                </span>
              </Link>
            </li>
          ))}
        {result.kind === "faturas" &&
          result.rows.map((i) => (
            <li key={i.id}>
              <Link
                href={`/admin/financeiro/faturas/${i.id}`}
                className="flex flex-wrap items-center gap-3 px-3 py-2 hover:bg-muted/50"
              >
                <span className="w-36 font-medium">{i.number}</span>
                <span className="flex-1">{i.establishments?.name}</span>
                <span className="text-muted-foreground">vence {br(i.due_date)}</span>
                <span className="tabular-nums">{formatCents(i.total_cents)}</span>
                <InvoiceStatusBadge status={effectiveInvoiceStatus(i.status, i.due_date, today)} />
              </Link>
            </li>
          ))}
        {result.kind === "pagamentos" &&
          result.rows.map((p) => (
            <li
              key={p.id}
              className={cn(
                "flex flex-wrap items-center gap-3 px-3 py-2",
                p.status === "reversed" && "text-muted-foreground line-through",
              )}
            >
              <span className="w-24">{br(p.received_on)}</span>
              <span className="flex-1">{p.establishments?.name}</span>
              <span>{billingMethodLabel(p.method)}</span>
              <span className="tabular-nums">{formatCents(p.amount_cents)}</span>
              {p.reference && <span className="text-muted-foreground">{p.reference}</span>}
            </li>
          ))}
      </ul>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {result.total} registro(s) · página {page + 1} de {pages}
        </span>
        <div className="flex gap-2">
          {page > 0 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={qs({ pagina: page - 1 })}>Anterior</Link>
            </Button>
          )}
          {page + 1 < pages && (
            <Button variant="outline" size="sm" asChild>
              <Link href={qs({ pagina: page + 1 })}>Próxima</Link>
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
