import { UserRoundIcon } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/shared/empty-state";
import { ImageUploadField } from "@/components/shared/image-upload-field";
import { PageHeader } from "@/components/shared/page-header";
import { requireMembership } from "@/lib/authz";
import { publicAssetUrl } from "@/lib/storage";
import { uploadProfessionalPhotoAction } from "@/modules/professionals/actions";
import { MyProfileForm } from "@/modules/professionals/components/my-profile-form";
import { getProfessional } from "@/modules/professionals/queries";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function MyProfessionalProfilePage({
  params,
}: PageProps<"/profissional/[slug]/perfil">) {
  const { slug } = await params;
  const { establishment, professionalId } = await requireMembership(slug);

  if (!professionalId) {
    return (
      <>
        <PageHeader title="Meu perfil" />
        <EmptyState
          icon={UserRoundIcon}
          title="Seu acesso ainda não está ligado a um perfil profissional"
          description="Peça ao responsável para abrir seu cadastro em Profissionais e clicar em Vincular acesso."
        />
      </>
    );
  }

  const pro = await getProfessional(establishment.id, professionalId);
  if (!pro) return null;

  return (
    <>
      <PageHeader
        title="Meu perfil"
        description="É assim que os clientes veem você na página de agendamento."
      />
      <div className="grid gap-8 sm:grid-cols-[auto_1fr]">
        <ImageUploadField
          action={uploadProfessionalPhotoAction}
          fields={{ slug: establishment.slug, professionalId: pro.id }}
          shape="round"
          label="Sua foto"
          hint="Quadrada, até 5 MB."
          currentUrl={publicAssetUrl(pro.photo_path)}
        />
        <MyProfileForm
          slug={establishment.slug}
          defaults={{
            displayName: pro.display_name,
            bio: pro.bio ?? "",
            specialties: pro.specialties.join(", "),
          }}
        />
      </div>
    </>
  );
}
