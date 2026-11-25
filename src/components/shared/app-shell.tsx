import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { AppSidebar, type NavItem } from "./app-sidebar";

/** Layout base dos painéis (DESIGN_SYSTEM.md §5.1). */
export function AppShell({
  title,
  subtitle,
  groupLabel,
  items,
  user,
  banner,
  children,
}: {
  title: string;
  subtitle?: string;
  groupLabel: string;
  items: NavItem[];
  user: { name: string; email: string | null };
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar
        title={title}
        subtitle={subtitle}
        groupLabel={groupLabel}
        items={items}
        user={user}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <span className="truncate text-sm text-muted-foreground">{title}</span>
        </header>
        {banner}
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
