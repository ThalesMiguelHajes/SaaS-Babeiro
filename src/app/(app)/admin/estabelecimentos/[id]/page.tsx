import { UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { EstablishmentStatusBadge } from "@/components/shared/status-badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requirePlatformAdmin } from "@/lib/authz";
import { formatDate, formatDateTime } from "@/lib/dates";
import { publicAssetUrl } from "@/lib/storage";
import { AuditTable } from "@/modules/audit/components/audit-table";
import { listAuditLogs } from "@/modules/audit/queries";
import { InviteMemberForm } from "@/modules/members/components/invite-member-form";
import { RevokeInvitationButton } from "@/modules/members/components/revoke-invitation-button";
import { EstablishmentForm } from "@/modules/platform/components/establishment-form";
import { ImageUploadField } from "@/components/shared/image-upload-field";
import { uploadEstablishmentImageAction } from "@/modules/platform/actions";
import { StatusActions } from "@/modules/platform/components/status-actions";
import { getEstablishment, getEstablishmentTeam } from "@/modules/platform/queries";
import { MEMBER_ROLE_LABEL } from "@/modules/platform/rules";
import { todayInTimeZone } from "@/modules/availability/rules";
import { EstablishmentBillingTab } from "@/modules/billing/components/establishment-billing-tab";

export const metadata: Metadata = { title: "Estabelecimento" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EstablishmentDetailPage({
  params,
}: PageProps<"/admin/estabelecimentos/[id]">) {
  await requirePlatformAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const establishment = await getEstablishment(id);
  if (!establishment) notFound();

  const [team, audit] = await Promise.all([
    getEstablishmentTeam(id),
    listAuditLogs({ establishmentId: id, pageSize: 50 }),
  ]);
  const hasOwner = team.members.some((m) => m.role === "owner" && m.isActive);

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{establishment.name}</h1>
            <EstablishmentStatusBadge status={establishment.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Página de agendamento: /agendar/{establishment.slug}
          </p>
          <p className="text-xs text-muted-foreground">
            Cadastrado em {formatDate(establishment.created_at)}
            {establishment.status_changed_at &&
              ` · status alterado em ${formatDateTime(establishment.status_changed_at)}`}
          </p>
        </div>
        <StatusActions
          establishmentId={establishment.id}
          name={establishment.name}
          status={establishment.status}
        />
      </div>

      <Tabs defaultValue="dados" className="gap-6">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="equipe">
            Equipe
            {team.invitations.length > 0 && (
              <Badge variant="secondary">{team.invitations.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="flex flex-col gap-8">
          <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
            <ImageUploadField
              action={uploadEstablishmentImageAction}
              fields={{ establishmentId: establishment.id, kind: "logo" }}
              label="Logo"
              hint="Quadrada, JPG/PNG/WebP até 5 MB."
              currentUrl={publicAssetUrl(establishment.logo_path)}
            />
            <ImageUploadField
              action={uploadEstablishmentImageAction}
              fields={{ establishmentId: establishment.id, kind: "cover" }}
              shape="wide"
              label="Imagem de capa"
              hint="Horizontal (ex.: 1600×700), até 5 MB."
              currentUrl={publicAssetUrl(establishment.cover_path)}
            />
          </div>
          <EstablishmentForm defaults={establishment} />
        </TabsContent>

        <TabsContent value="equipe" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Convidar para a equipe</CardTitle>
              <CardDescription>
                Gere um link e envie pelo WhatsApp ou e-mail. Quem receber cria a senha e já entra
                no painel.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InviteMemberForm
                establishmentId={establishment.id}
                establishmentName={establishment.name}
                allowedRoles={hasOwner ? ["admin", "staff"] : ["owner", "admin", "staff"]}
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
                    {team.invitations.map((inv) => {
                      const expired = new Date(inv.expires_at) <= new Date();
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.email}</TableCell>
                          <TableCell>{MEMBER_ROLE_LABEL[inv.role]}</TableCell>
                          <TableCell className="tabular-nums">
                            {expired ? (
                              <Badge variant="outline">Expirado</Badge>
                            ) : (
                              formatDateTime(inv.expires_at)
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <RevokeInvitationButton invitationId={inv.id} email={inv.email} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                Por segurança, o link de um convite só aparece quando é gerado. Para reenviar, gere
                um novo convite para o mesmo e-mail — o anterior é revogado automaticamente.
              </p>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Membros</h2>
            {team.members.length === 0 ? (
              <EmptyState
                icon={UsersIcon}
                title="Ninguém na equipe ainda"
                description="Os convites aceitos aparecem aqui."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead className="text-right">Desde</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team.members.map((m) => (
                      <TableRow
                        key={m.id}
                        className={m.isActive ? undefined : "text-muted-foreground"}
                      >
                        <TableCell>
                          <span className="font-medium">{m.name}</span>
                          {m.email && (
                            <span className="block text-xs text-muted-foreground">{m.email}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {MEMBER_ROLE_LABEL[m.role]}
                          {!m.isActive && " (inativo)"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDate(m.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="financeiro">
          <EstablishmentBillingTab
            establishmentId={establishment.id}
            today={todayInTimeZone("America/Sao_Paulo")}
          />
        </TabsContent>

        <TabsContent value="historico">
          <AuditTable rows={audit.rows} showEstablishment={false} />
        </TabsContent>
      </Tabs>
    </>
  );
}
