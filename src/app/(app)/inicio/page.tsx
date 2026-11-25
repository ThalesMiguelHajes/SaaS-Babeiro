import { ChevronRightIcon, StoreIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isPlatformAdmin, listMyMemberships, requireUser } from "@/lib/authz";
import { signOut } from "@/modules/auth/actions";

export const metadata: Metadata = { title: "Escolha o estabelecimento" };

const ROLE_LABEL = { owner: "Responsável", admin: "Administrador", staff: "Profissional" } as const;

export default async function ChooseEstablishmentPage() {
  const user = await requireUser();
  const [admin, memberships] = await Promise.all([isPlatformAdmin(), listMyMemberships()]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Olá, {user.fullName.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">Escolha onde você quer trabalhar agora.</p>
      </div>

      {admin && (
        <Link
          href="/admin"
          className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50"
        >
          <span className="font-medium">Administração da plataforma</span>
          <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      )}

      {memberships.length === 0 && !admin ? (
        <EmptyState
          icon={StoreIcon}
          title="Sua conta ainda não tem acesso a um estabelecimento"
          description="Peça ao responsável pelo estabelecimento um novo convite."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {memberships.map((m) => (
            <li key={m.id}>
              <Link
                href={m.role === "staff" ? `/profissional/${m.slug}` : `/painel/${m.slug}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-4 hover:bg-muted/50"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{m.name}</span>
                  <span className="text-xs text-muted-foreground">{ROLE_LABEL[m.role]}</span>
                </span>
                <span className="flex items-center gap-2">
                  {m.status === "suspended" && <Badge variant="outline">Suspenso</Badge>}
                  <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form action={signOut}>
        <Button type="submit" variant="ghost" className="w-full">
          Sair
        </Button>
      </form>
    </main>
  );
}
