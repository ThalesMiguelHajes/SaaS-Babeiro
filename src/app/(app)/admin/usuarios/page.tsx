import { SearchIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PaginationLinks } from "@/components/shared/pagination-links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PasswordLinkButton } from "@/modules/platform/components/password-link-button";
import { listUsers } from "@/modules/platform/queries";
import { MEMBER_ROLE_LABEL } from "@/modules/platform/rules";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/usuarios">) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Number(sp.pagina) || 1;
  const { rows, total, pageCount } = await listUsers({ q, page });

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Contas com acesso à plataforma. Novas contas são criadas pelos convites."
      />
      <form className="flex gap-2" role="search">
        <div className="relative max-w-sm flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome ou e-mail"
            className="pl-8"
            aria-label="Buscar"
          />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Nenhum usuário encontrado" />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Acessos</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <span className="font-medium">{u.name}</span>
                    <span className="block text-xs text-muted-foreground">{u.email ?? "—"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.platformRole && (
                        <Badge>
                          {u.platformRole === "super_admin" ? "Super Admin" : "Financeiro"}
                        </Badge>
                      )}
                      {u.memberships.map((m) => (
                        <Badge key={m.slug} variant="outline">
                          {m.name} · {MEMBER_ROLE_LABEL[m.role]}
                        </Badge>
                      ))}
                      {!u.platformRole && u.memberships.length === 0 && (
                        <span className="text-sm text-muted-foreground">Sem acesso</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatDate(u.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <PasswordLinkButton userId={u.id} name={u.name} />
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
        basePath="/admin/usuarios"
        params={{ q: q || undefined }}
      />
      <p className="text-xs text-muted-foreground">
        Para dar acesso a alguém, abra o estabelecimento e use a aba{" "}
        <Link href="/admin/estabelecimentos" className="underline underline-offset-4">
          Equipe
        </Link>
        .
      </p>
    </>
  );
}
