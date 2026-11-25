import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { requirePlatformAdmin } from "@/lib/authz";
import { EstablishmentForm } from "@/modules/platform/components/establishment-form";

export const metadata: Metadata = { title: "Novo estabelecimento" };

export default async function NewEstablishmentPage() {
  await requirePlatformAdmin();
  return (
    <>
      <PageHeader
        title="Novo estabelecimento"
        description="Cadastre o estabelecimento e gere o convite do responsável."
      />
      <EstablishmentForm />
    </>
  );
}
