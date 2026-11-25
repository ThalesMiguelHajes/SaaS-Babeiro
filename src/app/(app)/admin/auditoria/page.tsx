import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { PaginationLinks } from "@/components/shared/pagination-links";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { requirePlatformAdmin } from "@/lib/authz";
import { AuditTable } from "@/modules/audit/components/audit-table";
import { AUDIT_ACTION_LABEL } from "@/modules/audit/labels";
import { listAuditLogs } from "@/modules/audit/queries";

export const metadata: Metadata = { title: "Auditoria" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Início do dia em horário de Brasília (UTC-3, sem horário de verão desde 2019). */
function brtStartOfDay(date: string) {
  return `${date}T00:00:00-03:00`;
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/auditoria">) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const action = typeof sp.acao === "string" && sp.acao in AUDIT_ACTION_LABEL ? sp.acao : undefined;
  const from = typeof sp.de === "string" && DATE.test(sp.de) ? sp.de : undefined;
  const to = typeof sp.ate === "string" && DATE.test(sp.ate) ? sp.ate : undefined;
  const page = Number(sp.pagina) || 1;

  const toExclusive = to
    ? new Date(new Date(brtStartOfDay(to)).getTime() + 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  const { rows, total, pageCount } = await listAuditLogs({
    action,
    from: from ? brtStartOfDay(from) : undefined,
    to: toExclusive,
    page,
  });

  return (
    <>
      <PageHeader title="Auditoria" description="Registro permanente das ações administrativas." />
      <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <Field>
          <FieldLabel htmlFor="acao">Ação</FieldLabel>
          <NativeSelect id="acao" name="acao" defaultValue={action ?? ""} className="w-full">
            <NativeSelectOption value="">Todas</NativeSelectOption>
            {Object.entries(AUDIT_ACTION_LABEL).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="de">De</FieldLabel>
          <Input id="de" name="de" type="date" defaultValue={from} />
        </Field>
        <Field>
          <FieldLabel htmlFor="ate">Até</FieldLabel>
          <Input id="ate" name="ate" type="date" defaultValue={to} />
        </Field>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>
      <AuditTable rows={rows} />
      <PaginationLinks
        page={page}
        pageCount={pageCount}
        total={total}
        basePath="/admin/auditoria"
        params={{ acao: action, de: from, ate: to }}
      />
    </>
  );
}
