import type { Metadata } from "next";

import { CopyLinkField } from "@/components/shared/copy-link-field";
import { ImageUploadField } from "@/components/shared/image-upload-field";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMembership } from "@/lib/authz";
import { publicEnv } from "@/lib/env";
import { formatPhone } from "@/lib/phone";
import { publicAssetUrl } from "@/lib/storage";
import { PublicProfileForm } from "@/modules/establishments/components/public-profile-form";
import { getEstablishmentProfile } from "@/modules/establishments/queries";
import { uploadEstablishmentImageAction } from "@/modules/platform/actions";

export const metadata: Metadata = { title: "Página pública" };

export default async function PublicPageSettings({
  params,
}: PageProps<"/painel/[slug]/pagina-publica">) {
  const { slug } = await params;
  const { establishment } = await requireMembership(slug, ["owner", "admin"]);
  const profile = await getEstablishmentProfile(establishment.id);
  const bookingUrl = new URL(`/agendar/${profile.slug}`, publicEnv.NEXT_PUBLIC_APP_URL).toString();

  return (
    <>
      <PageHeader
        title="Página pública"
        description="Como seu estabelecimento aparece para o cliente que vai agendar."
      />

      <Card>
        <CardHeader>
          <CardTitle>Link de agendamento</CardTitle>
          <CardDescription>
            Este será o endereço para divulgar no Instagram e no WhatsApp. A página de agendamento
            entra no ar na próxima etapa do sistema; você já pode deixar tudo pronto aqui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CopyLinkField url={bookingUrl} label="Endereço da sua página" />
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <ImageUploadField
          action={uploadEstablishmentImageAction}
          fields={{ establishmentId: establishment.id, kind: "logo" }}
          label="Logo"
          hint="Quadrada, JPG/PNG/WebP até 5 MB."
          currentUrl={publicAssetUrl(profile.logo_path)}
        />
        <ImageUploadField
          action={uploadEstablishmentImageAction}
          fields={{ establishmentId: establishment.id, kind: "cover" }}
          shape="wide"
          label="Imagem de capa"
          hint="Horizontal (ex.: 1600×700), até 5 MB."
          currentUrl={publicAssetUrl(profile.cover_path)}
        />
      </div>

      <PublicProfileForm
        slug={establishment.slug}
        defaults={{
          description: profile.description ?? "",
          whatsapp: profile.whatsapp_e164 ? formatPhone(profile.whatsapp_e164) : "",
          phone: profile.phone_e164 ? formatPhone(profile.phone_e164) : "",
          instagram: profile.instagram_handle ?? "",
          postalCode: profile.address_postal_code ?? "",
          street: profile.address_street ?? "",
          number: profile.address_number ?? "",
          complement: profile.address_complement ?? "",
          district: profile.address_district ?? "",
          city: profile.address_city ?? "",
          state: profile.address_state ?? "",
          accentColor: profile.accent_color,
        }}
      />
      <p className="text-xs text-muted-foreground">
        Nome do estabelecimento e endereço da página são alterados pelo suporte da plataforma.
      </p>
    </>
  );
}
