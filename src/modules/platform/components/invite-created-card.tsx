"use client";

import { CheckCircle2Icon } from "lucide-react";
import Link from "next/link";

import { CopyLinkField } from "@/components/shared/copy-link-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { invitationMessage } from "../rules";

export function InviteCreatedCard({
  establishmentId,
  establishmentName,
  inviteUrl,
  whatsappTo,
}: {
  establishmentId: string;
  establishmentName: string;
  inviteUrl: string | null;
  whatsappTo: string | null;
}) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2Icon className="size-5 text-green-600" aria-hidden />
          {establishmentName} cadastrado
        </CardTitle>
        <CardDescription>
          {inviteUrl
            ? "Envie o link abaixo ao responsável. Ele cria a senha e já entra no painel. O link vale por 7 dias e só aparece agora — se perder, gere outro na aba Equipe."
            : "Nenhum e-mail de responsável foi informado. Você pode convidar alguém pela aba Equipe."}
        </CardDescription>
      </CardHeader>
      {inviteUrl && (
        <CardContent>
          <CopyLinkField
            url={inviteUrl}
            label="Convite do responsável"
            whatsappTo={whatsappTo}
            whatsappText={invitationMessage({
              establishmentName,
              roleLabel: "Responsável",
              url: inviteUrl,
            })}
          />
        </CardContent>
      )}
      <CardFooter className="gap-2">
        <Button asChild>
          <Link href={`/admin/estabelecimentos/${establishmentId}`}>Abrir estabelecimento</Link>
        </Button>
        {/* recarrega a página para começar um formulário limpo */}
        <Button variant="outline" onClick={() => window.location.reload()}>
          Cadastrar outro
        </Button>
      </CardFooter>
    </Card>
  );
}
