import { AppShell } from "@/components/shared/app-shell";
import { EstablishmentStatusBanner } from "@/components/shared/establishment-status-banner";
import { requireMembership } from "@/lib/authz";

// A área do profissional exige vínculo ativo; páginas que dependem do perfil profissional
// (agenda, perfil) usam requireProfessional(slug).
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
      items={[
        { href: base, label: "Minha agenda", icon: "agenda", exact: true },
        { href: `${base}/resumo`, label: "Meu resumo", icon: "dashboard" },
        { href: `${base}/disponibilidade`, label: "Disponibilidade", icon: "hours" },
        { href: `${base}/perfil`, label: "Meu perfil", icon: "professionals" },
      ]}
      user={{ name: user.fullName, email: user.email }}
      banner={<EstablishmentStatusBanner status={establishment.status} />}
    >
      {children}
    </AppShell>
  );
}
