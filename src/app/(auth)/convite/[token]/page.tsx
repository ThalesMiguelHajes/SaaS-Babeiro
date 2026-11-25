import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/authz";
import { signOut } from "@/modules/auth/actions";
import {
  AcceptInvitationButton,
  CreateAccountAndAcceptForm,
} from "@/modules/members/components/accept-invitation";
import { getInvitationPreview } from "@/modules/members/invitations.server";
import { MEMBER_ROLE_LABEL } from "@/modules/platform/rules";

export const metadata: Metadata = { title: "Convite", robots: { index: false, follow: false } };

const UNAVAILABLE: Record<string, { title: string; text: string }> = {
  invalid: {
    title: "Convite inválido",
    text: "Confira se o link foi copiado por completo ou peça um novo convite.",
  },
  expired: {
    title: "Convite expirado",
    text: "Este convite passou da validade de 7 dias. Peça um novo ao responsável.",
  },
  revoked: {
    title: "Convite cancelado",
    text: "Este convite foi cancelado. Peça um novo ao responsável, se for o caso.",
  },
  accepted: {
    title: "Convite já utilizado",
    text: "Este convite já foi aceito. Entre com seu e-mail e senha.",
  },
};

export default async function InvitationPage({ params }: PageProps<"/convite/[token]">) {
  const { token } = await params;
  const [preview, user] = await Promise.all([getInvitationPreview(token), getCurrentUser()]);

  if (preview.status !== "pending") {
    const info = UNAVAILABLE[preview.status] ?? UNAVAILABLE.invalid!;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{info.title}</CardTitle>
          <CardDescription>{info.text}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Ir para o login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const roleLabel = MEMBER_ROLE_LABEL[preview.role].toLowerCase();
  const header = (
    <CardHeader>
      <CardTitle className="text-xl">Convite para {preview.establishment_name}</CardTitle>
      <CardDescription>
        Você foi convidado(a) como <strong>{roleLabel}</strong>.
      </CardDescription>
    </CardHeader>
  );

  // Já autenticado
  if (user) {
    const sameEmail = user.email?.toLowerCase() === preview.email.toLowerCase();
    return (
      <Card>
        {header}
        <CardContent className="flex flex-col gap-4">
          {sameEmail ? (
            <AcceptInvitationButton token={token} />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Você está conectado como <strong>{user.email}</strong>, mas o convite foi enviado
                para <strong>{preview.email}</strong>. Saia e entre com a conta correta.
              </p>
              <form action={signOut}>
                <Button type="submit" variant="outline" className="w-full">
                  Sair desta conta
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // Já tem conta, mas não está logado
  if (preview.has_account) {
    return (
      <Card>
        {header}
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Já existe uma conta para <strong>{preview.email}</strong>. Entre com ela para aceitar o
            convite.
          </p>
          <Button asChild className="w-full">
            <Link href={`/login?next=${encodeURIComponent(`/convite/${token}`)}`}>
              Entrar para aceitar
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Primeira vez
  return (
    <Card>
      {header}
      <CardContent>
        <CreateAccountAndAcceptForm token={token} email={preview.email} />
      </CardContent>
    </Card>
  );
}
