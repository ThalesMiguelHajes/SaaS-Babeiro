import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Paginação por query string (?pagina=), preservando os demais filtros. */
export function PaginationLinks({
  page,
  pageCount,
  total,
  basePath,
  params,
}: {
  page: number;
  pageCount: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) {
    return (
      <p className="text-sm text-muted-foreground">
        {total} {total === 1 ? "registro" : "registros"}
      </p>
    );
  }
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("pagina", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <nav className="flex items-center justify-between gap-2" aria-label="Paginação">
      <p className="text-sm text-muted-foreground">
        Página {page} de {pageCount} · {total} registros
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild disabled={page <= 1} aria-disabled={page <= 1}>
          {page <= 1 ? (
            <span>
              <ChevronLeftIcon aria-hidden /> Anterior
            </span>
          ) : (
            <Link href={href(page - 1)}>
              <ChevronLeftIcon aria-hidden /> Anterior
            </Link>
          )}
        </Button>
        <Button variant="outline" size="sm" asChild aria-disabled={page >= pageCount}>
          {page >= pageCount ? (
            <span>
              Próxima <ChevronRightIcon aria-hidden />
            </span>
          ) : (
            <Link href={href(page + 1)}>
              Próxima <ChevronRightIcon aria-hidden />
            </Link>
          )}
        </Button>
      </div>
    </nav>
  );
}
