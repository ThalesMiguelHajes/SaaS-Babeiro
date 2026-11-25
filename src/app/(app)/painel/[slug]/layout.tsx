import { AppShell } from "@/components/shared/app-shell";
import { EstablishmentStatusBanner } from "@/components/shared/establishment-status-banner";
import { requireMembership } from "@/lib/authz";

export default async function EstablishmentPanelLayout({
  children,
  params,
}: LayoutProps<"/painel/[slug]">) {
  const { slug } = await params;
  const { user, establishment } = await requireMembership(slug, ["owner", "admin"]);
  const base = `/painel/${establishment.slug}`;

  return (
    <AppShell
      title={establishment.name}
      subtitle="Painel do estabelecimento"
      groupLabel="Estabelecimento"
      items={[{ href: base, label: "Visão geral", icon: "dashboard", exact: true }]}
      user={{ name: user.fullName, email: user.email }}
      banner={<EstablishmentStatusBanner status={establishment.status} />}
    >
      {children}
    </AppShell>
  );
}
