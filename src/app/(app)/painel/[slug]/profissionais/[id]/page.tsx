import { ClockIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ImageUploadField } from "@/components/shared/image-upload-field";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMembership } from "@/lib/authz";
import { publicAssetUrl } from "@/lib/storage";
import { uploadProfessionalPhotoAction } from "@/modules/professionals/actions";
import { LinkUserControl } from "@/modules/professionals/components/link-user-control";
import { ProfessionalForm } from "@/modules/professionals/components/professional-form";
import { getTeam } from "@/modules/members/queries";
import { getProfessional, listLinkableMembers } from "@/modules/professionals/queries";
import { listServices } from "@/modules/services/queries";

export const metadata: Metadata = { title: "Profissional" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProfessionalPage({
  params,
}: PageProps<"/painel/[slug]/profissionais/[id]">) {
  const { slug, id } = await params;
  const { establishment } = await requireMembership(slug, ["owner", "admin"]);
  if (!UUID.test(id)) notFound();

  const [pro, { services }, candidates, team] = await Promise.all([
    getProfessional(establishment.id, id),
    listServices(establishment.id),
    listLinkableMembers(establishment.id),
    getTeam(establishment.id),
  ]);
  if (!pro) notFound();

  const linked = pro.user_id
    ? (team.members.find((m) => m.userId === pro.user_id)?.name ?? "Conta vinculada")
    : null;

  return (
    <>
      <PageHeader
        title={pro.display_name}
        description="Dados exibidos ao cliente e serviços que realiza."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/painel/${establishment.slug}/profissionais/${pro.id}/horarios`}>
              <ClockIcon aria-hidden />
              Horários e folgas
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ProfessionalForm
          slug={establishment.slug}
          professionalId={pro.id}
          defaults={{
            displayName: pro.display_name,
            bio: pro.bio ?? "",
            specialties: pro.specialties.join(", "),
            isBookable: pro.is_bookable,
            isActive: pro.is_active,
            serviceIds: pro.serviceIds,
          }}
          services={services.filter(
            (s) => !s.archived_at && (s.is_active || pro.serviceIds.includes(s.id)),
          )}
        />
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Foto</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUploadField
                action={uploadProfessionalPhotoAction}
                fields={{ slug: establishment.slug, professionalId: pro.id }}
                shape="round"
                label="Foto do profissional"
                hint="Quadrada, JPG/PNG/WebP até 5 MB."
                currentUrl={publicAssetUrl(pro.photo_path)}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Acesso ao painel</CardTitle>
              <CardDescription>
                Vincule a conta da pessoa para ela ver a própria agenda e editar o perfil.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LinkUserControl
                slug={establishment.slug}
                professionalId={pro.id}
                linkedName={linked}
                candidates={candidates}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
