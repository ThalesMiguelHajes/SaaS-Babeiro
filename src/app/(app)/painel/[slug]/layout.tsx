import { AppShell } from "@/components/shared/app-shell";
import { EstablishmentStatusBanner } from "@/components/shared/establishment-status-banner";
import { requireMembership } from "@/lib/authz";
import { BillingBanner } from "@/modules/billing/components/billing-banner";
import { getBillingStatus } from "@/modules/billing/queries";

export default async function EstablishmentPanelLayout({
  children,
  params,
}: LayoutProps<"/painel/[slug]">) {
  const { slug } = await params;
  const { user, establishment } = await requireMembership(slug, ["owner", "admin"]);
  const base = `/painel/${establishment.slug}`;
  const billing = await getBillingStatus(establishment.id);

  return (
    <AppShell
      title={establishment.name}
      subtitle="Painel do estabelecimento"
      groupLabel="Estabelecimento"
      items={[
        { href: base, label: "Visão geral", icon: "dashboard", exact: true },
        { href: `${base}/agenda`, label: "Agenda", icon: "agenda" },
        { href: `${base}/profissionais`, label: "Profissionais", icon: "professionals" },
        { href: `${base}/servicos`, label: "Serviços", icon: "services" },
        { href: `${base}/horarios`, label: "Horários", icon: "hours" },
        { href: `${base}/equipe`, label: "Equipe", icon: "team" },
        { href: `${base}/pagina-publica`, label: "Página pública", icon: "publicPage" },
        { href: `${base}/configuracoes`, label: "Configurações", icon: "settings" },
        ...(billing.subscription_status
          ? [{ href: `${base}/assinatura`, label: "Assinatura", icon: "billing" as const }]
          : []),
      ]}
      user={{ name: user.fullName, email: user.email }}
      banner={
        <>
          <EstablishmentStatusBanner status={establishment.status} />
          {establishment.status === "active" && (
            <BillingBanner
              mode={billing.mode}
              status={billing.subscription_status}
              href={billing.subscription_status ? `${base}/assinatura` : null}
              nextInvoice={billing.next_invoice}
            />
          )}
        </>
      }
    >
      {children}
    </AppShell>
  );
}
