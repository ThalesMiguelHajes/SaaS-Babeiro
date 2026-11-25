import { AppShell } from "@/components/shared/app-shell";
import { EstablishmentStatusBanner } from "@/components/shared/establishment-status-banner";
import { requireMembership } from "@/lib/authz";

// Até a Fase 3 (tabela professionals), a área exige apenas vínculo ativo com o estabelecimento.
// Depois passa a usar requireProfessional(slug) — ver BACKLOG E3-4.
export default async function ProfessionalLayout({
  children,
  params,
}: LayoutProps<"/profissional/[slug]">) {
  const { slug } = await params;
  const { user, establishment } = await requireMembership(slug);
  const base = `/profissional/${establishment.slug}`;

  return (
    <AppShell
      title={establishment.name}
      subtitle="Área do profissional"
      groupLabel="Minha área"
      items={[{ href: base, label: "Minha agenda", icon: "dashboard", exact: true }]}
      user={{ name: user.fullName, email: user.email }}
      banner={<EstablishmentStatusBanner status={establishment.status} />}
    >
      {children}
    </AppShell>
  );
}
