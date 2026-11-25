"use client";

import { UserCheckIcon, UserXIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MEMBER_ROLE_LABEL } from "@/modules/platform/rules";

import { setMemberActiveAction, updateMemberRoleAction } from "../actions";

type Role = "owner" | "admin" | "staff";
type Member = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  role: Role;
  isActive: boolean;
};

/** Regras espelhadas da RPC (o banco decide; a tela só mostra o que é permitido). */
function canManage(viewer: { userId: string; role: Role }, member: Member) {
  if (member.userId === viewer.userId || member.role === "owner") return false;
  if (viewer.role === "owner") return true;
  return viewer.role === "admin" && member.role === "staff";
}

export function TeamTable({
  slug,
  viewer,
  members,
}: {
  slug: string;
  viewer: { userId: string; role: Role };
  members: Member[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead className="w-44">Papel</TableHead>
            <TableHead className="w-36 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => {
            const manageable = canManage(viewer, m);
            return (
              <TableRow key={m.id} className={m.isActive ? undefined : "text-muted-foreground"}>
                <TableCell>
                  <span className="font-medium">{m.name}</span>
                  {m.userId === viewer.userId && (
                    <Badge variant="secondary" className="ml-2">
                      Você
                    </Badge>
                  )}
                  {!m.isActive && (
                    <Badge variant="outline" className="ml-2">
                      Sem acesso
                    </Badge>
                  )}
                  {m.email && (
                    <span className="block text-xs text-muted-foreground">{m.email}</span>
                  )}
                </TableCell>
                <TableCell>
                  {manageable && m.isActive ? (
                    <NativeSelect
                      size="sm"
                      value={m.role}
                      disabled={pending}
                      aria-label={`Papel de ${m.name}`}
                      onChange={(e) =>
                        startTransition(async () => {
                          const result = await updateMemberRoleAction(slug, m.id, e.target.value);
                          if (!result.ok) toast.error(result.error.message);
                          else {
                            toast.success("Papel atualizado.");
                            router.refresh();
                          }
                        })
                      }
                    >
                      <NativeSelectOption value="admin">
                        {MEMBER_ROLE_LABEL.admin}
                      </NativeSelectOption>
                      <NativeSelectOption value="staff">
                        {MEMBER_ROLE_LABEL.staff}
                      </NativeSelectOption>
                    </NativeSelect>
                  ) : (
                    MEMBER_ROLE_LABEL[m.role]
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {manageable &&
                    (m.isActive ? (
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="sm">
                            <UserXIcon aria-hidden /> Remover acesso
                          </Button>
                        }
                        title={`Remover o acesso de ${m.name}?`}
                        description="A pessoa deixa de entrar no painel e, se atender clientes, o perfil profissional dela é desativado. O histórico é mantido e você pode reativar depois."
                        confirmLabel="Remover acesso"
                        destructive
                        onConfirm={async () => {
                          const result = await setMemberActiveAction(slug, m.id, false);
                          if (!result.ok) return result.error.message;
                          toast.success("Acesso removido.");
                          router.refresh();
                          return null;
                        }}
                      />
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await setMemberActiveAction(slug, m.id, true);
                            if (!result.ok) toast.error(result.error.message);
                            else {
                              toast.success("Acesso reativado.");
                              router.refresh();
                            }
                          })
                        }
                      >
                        <UserCheckIcon aria-hidden /> Reativar
                      </Button>
                    ))}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
