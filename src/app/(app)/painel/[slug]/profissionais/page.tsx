/* eslint-disable @next/next/no-img-element -- fotos do Storage sem otimização (cota da Vercel) */
import { PlusIcon, UserRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireMembership } from "@/lib/authz";
import { publicAssetUrl } from "@/lib/storage";
import { getBillingStatus } from "@/modules/billing/queries";
import { listProfessionals } from "@/modules/professionals/queries";

export const metadata: Metadata = { title: "Profissionais" };

export default async function ProfessionalsPage({
  params,
}: PageProps<"/painel/[slug]/profissionais">) {
  const { slug } = await params;
  const { establishment } = await requireMembership(slug, ["owner", "admin"]);
  const [pros, billing] = await Promise.all([
    listProfessionals(establishment.id),
    getBillingStatus(establishment.id),
  ]);
  const limit = billing.professional_limit;
  const base = `/painel/${establishment.slug}/profissionais`;

  return (
    <>
      <PageHeader
        title="Profissionais"
        description={
          limit === null
            ? "Quem atende os clientes. Cada profissional tem a própria agenda."
            : `Quem atende os clientes. ${billing.active_professionals} de ${limit} vagas do plano em uso.`
        }
        actions={
          <Button asChild>
            <Link href={`${base}/novo`}>
              <PlusIcon aria-hidden /> Novo profissional
            </Link>
          </Button>
        }
      />
      {pros.length === 0 ? (
        <EmptyState
          icon={UserRoundIcon}
          title="Nenhum profissional cadastrado"
          description="Se você também atende, cadastre-se como profissional."
          action={
            <Button asChild>
              <Link href={`${base}/novo`}>Cadastrar profissional</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pros.map((p) => {
            const photo = publicAssetUrl(p.photo_path);
            return (
              <li key={p.id}>
                <Link
                  href={`${base}/${p.id}`}
                  className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                    {photo ? (
                      <img src={photo} alt="" className="size-full object-cover" />
                    ) : (
                      <UserRoundIcon className="size-5 text-muted-foreground" aria-hidden />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{p.display_name}</span>
                      {!p.is_active && <Badge variant="outline">Inativo</Badge>}
                      {p.is_active && !p.is_bookable && (
                        <Badge variant="secondary">Só pelo painel</Badge>
                      )}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {p.serviceCount === 0
                        ? "Nenhum serviço"
                        : `${p.serviceCount} ${p.serviceCount === 1 ? "serviço" : "serviços"}`}
                      {p.specialties.length > 0 && ` · ${p.specialties.join(", ")}`}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
