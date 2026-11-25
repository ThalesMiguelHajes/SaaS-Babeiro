import { AppShell } from "@/components/shared/app-shell";
import { requirePlatformAdmin } from "@/lib/authz";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requirePlatformAdmin();
  return (
    <AppShell
      title="Administração"
      subtitle="Plataforma"
      groupLabel="Plataforma"
      items={[
        { href: "/admin", label: "Visão geral", icon: "dashboard", exact: true },
        { href: "/admin/estabelecimentos", label: "Estabelecimentos", icon: "establishments" },
        { href: "/admin/financeiro", label: "Financeiro", icon: "billing" },
        { href: "/admin/usuarios", label: "Usuários", icon: "users" },
        { href: "/admin/auditoria", label: "Auditoria", icon: "audit" },
      ]}
      user={{ name: user.fullName, email: user.email }}
    >
      {children}
    </AppShell>
  );
}
