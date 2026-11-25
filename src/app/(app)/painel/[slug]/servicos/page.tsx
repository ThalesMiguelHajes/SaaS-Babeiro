import { PlusIcon, ScissorsIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMembership } from "@/lib/authz";
import { formatCents } from "@/lib/money";
import { ArchiveServiceButton } from "@/modules/services/components/archive-service-button";
import { CategoryManager } from "@/modules/services/components/category-manager";
import { listServices } from "@/modules/services/queries";

export const metadata: Metadata = { title: "Serviços" };

export default async function ServicesPage({ params }: PageProps<"/painel/[slug]/servicos">) {
  const { slug } = await params;
  const { establishment } = await requireMembership(slug, ["owner", "admin"]);
  const { services, categories } = await listServices(establishment.id);
  const base = `/painel/${establishment.slug}/servicos`;
  const visible = services.filter((s) => !s.archived_at);

  const groups = [
    ...categories.map((c) => ({
      id: c.id,
      name: c.name,
      items: visible.filter((s) => s.category_id === c.id),
    })),
    { id: "none", name: "Sem categoria", items: visible.filter((s) => !s.category_id) },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader
        title="Serviços"
        description="O que o cliente pode agendar, com preço e duração."
        actions={
          <Button asChild>
            <Link href={`${base}/novo`}>
              <PlusIcon aria-hidden /> Novo serviço
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-6">
          {visible.length === 0 ? (
            <EmptyState
              icon={ScissorsIcon}
              title="Nenhum serviço cadastrado"
              description="Ex.: Corte masculino — 30 min — R$ 40,00."
              action={
                <Button asChild>
                  <Link href={`${base}/novo`}>Cadastrar serviço</Link>
                </Button>
              }
            />
          ) : (
            groups.map((g) => (
              <section key={g.id} className="flex flex-col gap-2">
                <h2 className="text-sm font-medium text-muted-foreground">{g.name}</h2>
                <ul className="flex flex-col divide-y rounded-lg border">
                  {g.items.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <Link
                        href={`${base}/${s.id}`}
                        className="flex min-w-0 flex-1 flex-col gap-0.5 hover:underline"
                      >
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">{s.name}</span>
                          {!s.is_active && <Badge variant="outline">Inativo</Badge>}
                          {s.is_active && !s.is_public && (
                            <Badge variant="secondary">Só pelo painel</Badge>
                          )}
                          {s.professionalCount === 0 && (
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 text-amber-700 dark:text-amber-400"
                            >
                              Sem profissional
                            </Badge>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {s.duration_minutes} min
                          {(s.buffer_before_minutes > 0 || s.buffer_after_minutes > 0) &&
                            ` (+${s.buffer_before_minutes + s.buffer_after_minutes} min de preparo/limpeza)`}
                        </span>
                      </Link>
                      <span className="font-medium tabular-nums">{formatCents(s.price_cents)}</span>
                      <ArchiveServiceButton
                        slug={establishment.slug}
                        serviceId={s.id}
                        name={s.name}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryManager slug={establishment.slug} categories={categories} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
