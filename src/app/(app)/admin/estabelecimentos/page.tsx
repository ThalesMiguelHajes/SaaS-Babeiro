import { PlusIcon, SearchIcon, StoreIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PaginationLinks } from "@/components/shared/pagination-links";
import { EstablishmentStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePlatformAdmin } from "@/lib/authz";
import { formatDate } from "@/lib/dates";
import { listEstablishments } from "@/modules/platform/queries";
import { ESTABLISHMENT_STATUS_LABEL } from "@/modules/platform/rules";

export const metadata: Metadata = { title: "Estabelecimentos" };

const STATUSES = ["active", "suspended", "deactivated"] as const;

export default async function EstablishmentsPage({
  searchParams,
}: PageProps<"/admin/estabelecimentos">) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const status = STATUSES.find((s) => s === sp.status);
  const page = Number(sp.pagina) || 1;

  const { rows, total, pageCount } = await listEstablishments({ q, status, page });

  return (
    <>
      <PageHeader
        title="Estabelecimentos"
        description="Todos os estabelecimentos da plataforma."
        actions={
          <Button asChild>
            <Link href="/admin/estabelecimentos/novo">
              <PlusIcon aria-hidden /> Novo estabelecimento
            </Link>
          </Button>
        }
      />

      <form className="flex flex-col gap-2 sm:flex-row" role="search">
        <div className="relative sm:max-w-sm sm:flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome, endereço ou e-mail"
            className="pl-8"
            aria-label="Buscar"
          />
        </div>
        <NativeSelect
          name="status"
          defaultValue={status ?? ""}
          aria-label="Status"
          className="w-full sm:w-44"
        >
          <NativeSelectOption value="">Todos os status</NativeSelectOption>
          {STATUSES.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {ESTABLISHMENT_STATUS_LABEL[s]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={StoreIcon}
          title={
            q || status ? "Nenhum estabelecimento encontrado" : "Nenhum estabelecimento cadastrado"
          }
          description={
            q || status
              ? "Tente outros filtros."
              : "Cadastre o primeiro para gerar o convite do responsável."
          }
          action={
            !q && !status ? (
              <Button asChild>
                <Link href="/admin/estabelecimentos/novo">Cadastrar estabelecimento</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estabelecimento</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link
                      href={`/admin/estabelecimentos/${e.id}`}
                      className="font-medium hover:underline"
                    >
                      {e.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">/{e.slug}</span>
                  </TableCell>
                  <TableCell>
                    {e.owner_name ?? "—"}
                    {e.owner_email && (
                      <span className="block text-xs text-muted-foreground">{e.owner_email}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {e.address_city
                      ? `${e.address_city}${e.address_state ? `/${e.address_state}` : ""}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <EstablishmentStatusBadge status={e.status} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {formatDate(e.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PaginationLinks
        page={page}
        pageCount={pageCount}
        total={total}
        basePath="/admin/estabelecimentos"
        params={{ q: q || undefined, status }}
      />
    </>
  );
}
