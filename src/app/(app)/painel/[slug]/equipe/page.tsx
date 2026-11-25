import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireMembership } from "@/lib/authz";
import { formatDateTime } from "@/lib/dates";
import { InviteMemberForm } from "@/modules/members/components/invite-member-form";
import { RevokeInvitationButton } from "@/modules/members/components/revoke-invitation-button";
import { TeamTable } from "@/modules/members/components/team-table";
import { getTeam } from "@/modules/members/queries";
import { MEMBER_ROLE_LABEL } from "@/modules/platform/rules";

export const metadata: Metadata = { title: "Equipe" };

export default async function TeamPage({ params }: PageProps<"/painel/[slug]/equipe">) {
  const { slug } = await params;
  const { establishment, user, role } = await requireMembership(slug, ["owner", "admin"]);
  const team = await getTeam(establishment.id);

  return (
    <>
      <PageHeader
        title="Equipe"
        description="Quem acessa o painel. Administradores gerenciam o estabelecimento; profissionais veem a própria agenda."
      />

      <Card>
        <CardHeader>
          <CardTitle>Convidar para a equipe</CardTitle>
          <CardDescription>
            Gere um link e envie pelo WhatsApp. Quem receber cria a senha e já entra.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteMemberForm
            establishmentId={establishment.id}
            establishmentName={establishment.name}
            allowedRoles={["staff", "admin"]}
          />
        </CardContent>
      </Card>

      {team.invitations.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Convites pendentes</h2>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>{MEMBER_ROLE_LABEL[inv.role]}</TableCell>
                    <TableCell className="tabular-nums">
                      {new Date(inv.expires_at) <= new Date() ? (
                        <Badge variant="outline">Expirado</Badge>
                      ) : (
                        formatDateTime(inv.expires_at)
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {(role === "owner" || inv.role !== "owner") && (
                        <RevokeInvitationButton invitationId={inv.id} email={inv.email} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Pessoas</h2>
        <TeamTable
          slug={establishment.slug}
          viewer={{ userId: user.id, role }}
          members={team.members}
        />
      </section>
    </>
  );
}
