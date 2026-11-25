import { StoreIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requirePlatformAdmin } from "@/lib/authz";
import { listFilters, listUrl, PAGE_SIZE } from "@/modules/platform/establishment-list";
import { listEstablishments } from "@/modules/platform/list-establishments";
import type { Enums } from "@/types/database";

export const metadata: Metadata = { title: "Estabelecimentos" };

const statuses = {
  active: {
    label: "Ativo",
    color: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  },
  suspended: {
    label: "Suspenso",
    color: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  deactivated: { label: "Desativado", color: "bg-muted text-muted-foreground" },
} satisfies Record<Enums<"establishment_status">, { label: string; color: string }>;

export default async function EstablishmentsPage({
  searchParams,
}: PageProps<"/admin/estabelecimentos">) {
  await requirePlatformAdmin();
  const filters = listFilters.parse(await searchParams);
  const { data, error, count } = await listEstablishments(filters);
  const pageCount = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  if (
    filters.pagina > 1 &&
    (error?.code === "PGRST103" || (!error && filters.pagina > pageCount))
  ) {
    redirect(listUrl({ ...filters, pagina: 1 }));
  }

  return (
    <>
      <PageHeader
        title="Estabelecimentos"
        actions={
          <Button asChild>
            <Link href="/admin/estabelecimentos/novo">Novo estabelecimento</Link>
          </Button>
        }
      />
      <form
        method="get"
        action="/admin/estabelecimentos"
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="grid gap-2 sm:w-72">
          <Label htmlFor="name-search">Buscar por nome</Label>
          <Input id="name-search" type="search" name="q" maxLength={120} defaultValue={filters.q} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={filters.status ?? ""}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">Todos</option>
            {Object.entries(statuses).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
        {(filters.q || filters.status) && (
          <Button asChild variant="ghost">
            <Link href="/admin/estabelecimentos">Limpar filtros</Link>
          </Button>
        )}
      </form>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar os estabelecimentos. Tente novamente.</AlertTitle>
        </Alert>
      ) : !data?.length ? (
        <EmptyState
          icon={StoreIcon}
          title={
            filters.q || filters.status
              ? "Nenhum resultado para os filtros selecionados"
              : "Nenhum estabelecimento cadastrado"
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Estabelecimentos encontrados</caption>
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  {["Estabelecimento", "Cidade", "Status"].map((label) => (
                    <th scope="col" key={label} className="px-4 py-2 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map((row) => (
                  <tr key={row.id}>
                    <th scope="row" className="px-4 py-2 font-medium">
                      {row.name}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {row.slug}
                      </span>
                    </th>
                    <td className="px-4 py-2">
                      {[row.address_city, row.address_state].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-4 py-2">
                      <Badge className={statuses[row.status].color}>
                        {statuses[row.status].label}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="Paginação" className="flex flex-wrap items-center gap-3 text-sm">
            <span className="mr-auto text-muted-foreground">
              Página {filters.pagina} de {pageCount}
            </span>
            {filters.pagina > 1 && (
              <Button asChild variant="outline">
                <Link href={listUrl({ ...filters, pagina: filters.pagina - 1 })}>Anterior</Link>
              </Button>
            )}
            {filters.pagina < pageCount && (
              <Button asChild variant="outline">
                <Link href={listUrl({ ...filters, pagina: filters.pagina + 1 })}>Próxima</Link>
              </Button>
            )}
          </nav>
        </>
      )}
    </>
  );
}
