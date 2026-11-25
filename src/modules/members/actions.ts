"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getMembership } from "@/lib/authz";
import { publicEnv } from "@/lib/env";
import { messageFor, toDomainErrorCode } from "@/lib/errors";
import { fail, ok, type Result } from "@/lib/result";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { validationFailure } from "@/lib/validation";

import { getInvitationPreview } from "./invitations.server";
import { homeAfterAccept } from "./rules";
import {
  acceptWithNewAccountSchema,
  createInvitationSchema,
  invitationTokenSchema,
  type AcceptWithNewAccountInput,
  type CreateInvitationInput,
} from "./schemas";

function inviteUrl(token: string) {
  return new URL(`/convite/${token}`, publicEnv.NEXT_PUBLIC_APP_URL).toString();
}

/** Cria (ou reenvia) um convite. Autorização no banco: Super Admin ou owner/admin do estabelecimento. */
export async function createInvitationAction(
  input: CreateInvitationInput,
): Promise<Result<{ url: string }>> {
  const parsed = createInvitationSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitation", {
    p_establishment_id: parsed.data.establishmentId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) {
    const code = toDomainErrorCode(error);
    return fail(code, messageFor(code));
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/painel", "layout");
  return ok({ url: inviteUrl((data as { token: string }).token) });
}

export async function revokeInvitationAction(invitationId: string): Promise<Result<null>> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: invitationId });
  if (error) {
    const code = toDomainErrorCode(error);
    return fail(code, messageFor(code));
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/painel", "layout");
  return ok(null);
}

const roleSchema = z.enum(["admin", "staff"]);

/** Altera o papel de um membro (regras de quem pode o quê ficam na RPC). */
export async function updateMemberRoleAction(
  slug: string,
  memberId: string,
  role: string,
): Promise<Result<null>> {
  const ctx = await getMembership(slug, ["owner", "admin"]);
  const parsedRole = roleSchema.safeParse(role);
  if (!ctx || !parsedRole.success || !z.uuid().safeParse(memberId).success) {
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_member_role", {
    p_member_id: memberId,
    p_role: parsedRole.data,
  });
  if (error) {
    const code = toDomainErrorCode(error);
    return fail(code, messageFor(code));
  }
  revalidatePath(`/painel/${slug}`, "layout");
  return ok(null);
}

/** Desativa (remove o acesso) ou reativa um membro. Desativar também desativa o perfil profissional. */
export async function setMemberActiveAction(
  slug: string,
  memberId: string,
  active: boolean,
): Promise<Result<null>> {
  const ctx = await getMembership(slug, ["owner", "admin"]);
  if (!ctx || !z.uuid().safeParse(memberId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_active", {
    p_member_id: memberId,
    p_active: active,
  });
  if (error) {
    const code = toDomainErrorCode(error);
    return fail(code, messageFor(code));
  }
  revalidatePath(`/painel/${slug}`, "layout");
  return ok(null);
}

async function acceptWithCurrentSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  token: string,
): Promise<Result<never>> {
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) {
    const code = toDomainErrorCode(error);
    return fail(code, messageFor(code));
  }
  redirect(homeAfterAccept(data as { slug: string; role: "owner" | "admin" | "staff" }));
}

/** Usuário já autenticado aceita o convite. */
export async function acceptInvitationAction(token: string): Promise<Result<never>> {
  if (!invitationTokenSchema.safeParse(token).success) {
    return fail("INVITATION_INVALID", messageFor("INVITATION_INVALID"));
  }
  const supabase = await createClient();
  return acceptWithCurrentSession(supabase, token);
}

/**
 * Convidado sem conta: o servidor cria a conta (cadastro público é desligado) somente
 * se o token for válido, usando o e-mail do próprio convite. Depois entra e aceita.
 */
export async function acceptWithNewAccountAction(
  input: AcceptWithNewAccountInput,
): Promise<Result<never>> {
  const parsed = acceptWithNewAccountSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const preview = await getInvitationPreview(parsed.data.token);
  if (preview.status !== "pending")
    return fail("INVITATION_INVALID", messageFor("INVITATION_INVALID"));
  if (preview.has_account) return fail("EMAIL_IN_USE", messageFor("EMAIL_IN_USE"));

  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({
    email: preview.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (created.error) {
    if (created.error.code === "email_exists" || created.error.status === 422) {
      return fail("EMAIL_IN_USE", messageFor("EMAIL_IN_USE"));
    }
    if (created.error.code === "weak_password")
      return fail("WEAK_PASSWORD", messageFor("WEAK_PASSWORD"));
    return fail("UNEXPECTED", messageFor("UNEXPECTED"));
  }

  const supabase = await createClient();
  const signIn = await supabase.auth.signInWithPassword({
    email: preview.email,
    password: parsed.data.password,
  });
  if (signIn.error) return fail("UNEXPECTED", messageFor("UNEXPECTED"));

  return acceptWithCurrentSession(supabase, parsed.data.token);
}
