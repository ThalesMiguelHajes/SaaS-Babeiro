"use server";

import { redirect } from "next/navigation";

import { messageFor } from "@/lib/errors";
import { publicEnv } from "@/lib/env";
import { fail, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

import { safeNextPath } from "./rules";
import {
  loginSchema,
  recoverPasswordSchema,
  resetPasswordSchema,
  type LoginInput,
  type RecoverPasswordInput,
  type ResetPasswordInput,
} from "./schemas";

function fieldErrorsOf(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export async function signIn(input: LoginInput): Promise<Result<never>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", messageFor("VALIDATION_ERROR"), fieldErrorsOf(parsed.error));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.status === 429) return fail("RATE_LIMITED", messageFor("RATE_LIMITED"));
    // Mensagem neutra: não revela se o e-mail existe.
    return fail("INVALID_CREDENTIALS", messageFor("INVALID_CREDENTIALS"));
  }

  redirect(safeNextPath(parsed.data.next) ?? "/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(input: RecoverPasswordInput): Promise<Result<null>> {
  const parsed = recoverPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", messageFor("VALIDATION_ERROR"), fieldErrorsOf(parsed.error));
  }

  const supabase = await createClient();
  const redirectTo = new URL("/auth/confirm", publicEnv.NEXT_PUBLIC_APP_URL);
  redirectTo.searchParams.set("next", "/redefinir-senha");

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: redirectTo.toString(),
  });

  if (error?.status === 429) return fail("RATE_LIMITED", messageFor("RATE_LIMITED"));
  // Sempre a mesma resposta, exista ou não a conta.
  return ok(null);
}

export async function updatePassword(input: ResetPasswordInput): Promise<Result<never>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", messageFor("VALIDATION_ERROR"), fieldErrorsOf(parsed.error));
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return fail("UNAUTHENTICATED", messageFor("UNAUTHENTICATED"));

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "weak_password") return fail("WEAK_PASSWORD", messageFor("WEAK_PASSWORD"));
    if (error.status === 429) return fail("RATE_LIMITED", messageFor("RATE_LIMITED"));
    return fail("UNEXPECTED", messageFor("UNEXPECTED"));
  }

  // Encerra sessões em outros dispositivos após trocar a senha.
  await supabase.auth.signOut({ scope: "others" });
  redirect("/");
}
