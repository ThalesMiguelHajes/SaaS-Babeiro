import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/authz";
import { LoginForm } from "@/modules/auth/components/login-form";
import { safeNextPath } from "@/modules/auth/rules";

export const metadata: Metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  "link-invalido": "O link é inválido ou expirou. Solicite um novo.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(params.next) ?? undefined;

  if (await getCurrentUser()) redirect(next ?? "/");

  const errorKey = typeof params.erro === "string" ? params.erro : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Entrar</CardTitle>
        <CardDescription>Acesse o painel do seu estabelecimento.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm next={next} initialError={ERRORS[errorKey] ?? null} />
      </CardContent>
    </Card>
  );
}
