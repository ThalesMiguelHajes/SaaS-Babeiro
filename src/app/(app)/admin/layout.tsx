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
      ]}
      user={{ name: user.fullName, email: user.email }}
    >
      {children}
    </AppShell>
  );
}
