"use server";

import { revalidatePath } from "next/cache";

import { isPlatformAdmin } from "@/lib/authz";
import { publicEnv } from "@/lib/env";
import { messageFor, toDomainErrorCode } from "@/lib/errors";
import { readImageFile } from "@/lib/images.server";
import { fail, ok, type Result } from "@/lib/result";
import { ESTABLISHMENT_ASSETS_BUCKET } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { validationFailure } from "@/lib/validation";

import {
  establishmentFormSchema,
  establishmentIdSchema,
  statusChangeSchema,
  toEstablishmentPayload,
  type EstablishmentFormInput,
} from "./schemas";

function rpcFailure(error: { code?: string | null; message?: string | null }): Result<never> {
  const code = toDomainErrorCode(error);
  return fail(
    code,
    messageFor(code),
    code === "SLUG_TAKEN" || code === "SLUG_RESERVED" ? { slug: [messageFor(code)] } : undefined,
  );
}

async function forbiddenUnlessPlatformAdmin(): Promise<Result<never> | null> {
  return (await isPlatformAdmin()) ? null : fail("FORBIDDEN", messageFor("FORBIDDEN"));
}

export async function createEstablishmentAction(
  input: EstablishmentFormInput,
): Promise<Result<{ id: string; slug: string; inviteUrl: string | null }>> {
  const denied = await forbiddenUnlessPlatformAdmin();
  if (denied) return denied;

  const parsed = establishmentFormSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_establishment", {
    p_data: toEstablishmentPayload(parsed.data),
  });
  if (error) return rpcFailure(error);

  const result = data as { id: string; slug: string; invitation_token: string | null };
  revalidatePath("/admin", "layout");
  return ok({
    id: result.id,
    slug: result.slug,
    inviteUrl: result.invitation_token
      ? new URL(`/convite/${result.invitation_token}`, publicEnv.NEXT_PUBLIC_APP_URL).toString()
      : null,
  });
}

export async function updateEstablishmentAction(
  id: string,
  input: EstablishmentFormInput,
): Promise<Result<null>> {
  const denied = await forbiddenUnlessPlatformAdmin();
  if (denied) return denied;

  const idParsed = establishmentIdSchema.safeParse(id);
  const parsed = establishmentFormSchema.safeParse(input);
  if (!idParsed.success) return fail("NOT_FOUND", messageFor("NOT_FOUND"));
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_establishment", {
    p_id: idParsed.data,
    p_data: toEstablishmentPayload(parsed.data),
  });
  if (error) return rpcFailure(error);

  revalidatePath("/admin", "layout");
  return ok(null);
}

export async function setEstablishmentStatusAction(input: {
  establishmentId: string;
  status: "active" | "suspended" | "deactivated";
  reason?: string;
}): Promise<Result<null>> {
  const denied = await forbiddenUnlessPlatformAdmin();
  if (denied) return denied;

  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_establishment_status", {
    p_id: parsed.data.establishmentId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason ?? undefined,
  });
  if (error) return rpcFailure(error);

  revalidatePath("/admin", "layout");
  return ok(null);
}

/**
 * Upload de logo/capa. Usado pelo Super Admin e pelo owner/admin na personalização da página pública;
 * a permissão é conferida pela RPC set_establishment_image.
 */
export async function uploadEstablishmentImageAction(
  formData: FormData,
): Promise<Result<{ path: string | null }>> {
  const establishmentId = establishmentIdSchema.safeParse(formData.get("establishmentId"));
  const kind = formData.get("kind");
  const file = formData.get("file");
  const remove = formData.get("remove") === "1";

  if (!establishmentId.success || (kind !== "logo" && kind !== "cover")) {
    return fail("VALIDATION_ERROR", messageFor("VALIDATION_ERROR"));
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("establishments")
    .select("logo_path, cover_path")
    .eq("id", establishmentId.data)
    .maybeSingle();
  if (!current) return fail("NOT_FOUND", messageFor("NOT_FOUND"));
  const previousPath = kind === "logo" ? current.logo_path : current.cover_path;

  const admin = createAdminClient();
  let newPath: string | null = null;

  if (!remove) {
    const image = await readImageFile(file);
    if (!image) return fail("FILE_INVALID", messageFor("FILE_INVALID"));

    newPath = `${establishmentId.data}/${kind}/${crypto.randomUUID()}.${image.ext}`;
    const upload = await admin.storage
      .from(ESTABLISHMENT_ASSETS_BUCKET)
      .upload(newPath, image.bytes, {
        contentType: image.mime,
        cacheControl: "31536000",
        upsert: false,
      });
    if (upload.error) return fail("UNEXPECTED", messageFor("UNEXPECTED"));
  }

  // A RPC confere a permissão do usuário no banco; se negar, o arquivo enviado é descartado.
  const { error } = await supabase.rpc("set_establishment_image", {
    p_id: establishmentId.data,
    p_kind: kind,
    // null remove a imagem; o tipo gerado não expressa argumentos anuláveis.
    p_path: newPath as string,
  });
  if (error) {
    if (newPath) await admin.storage.from(ESTABLISHMENT_ASSETS_BUCKET).remove([newPath]);
    return rpcFailure(error);
  }

  if (previousPath) await admin.storage.from(ESTABLISHMENT_ASSETS_BUCKET).remove([previousPath]);

  revalidatePath("/admin", "layout");
  revalidatePath("/painel", "layout");
  return ok({ path: newPath });
}

/**
 * Gera um link de redefinição de senha para o Super Admin copiar e enviar manualmente
 * (enquanto não há SMTP próprio — MASTER_PLAN D18).
 */
export async function generatePasswordLinkAction(userId: string): Promise<Result<{ url: string }>> {
  const denied = await forbiddenUnlessPlatformAdmin();
  if (denied) return denied;

  const id = establishmentIdSchema.safeParse(userId);
  if (!id.success) return fail("NOT_FOUND", messageFor("NOT_FOUND"));

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", id.data)
    .maybeSingle();
  if (!profile?.email) return fail("NOT_FOUND", messageFor("NOT_FOUND"));

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: profile.email,
  });
  if (error || !data.properties?.hashed_token) return fail("UNEXPECTED", messageFor("UNEXPECTED"));

  const url = new URL("/auth/confirm", publicEnv.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("token_hash", data.properties.hashed_token);
  url.searchParams.set("type", "recovery");
  url.searchParams.set("next", "/redefinir-senha");

  const { data: claims } = await supabase.auth.getClaims();
  await admin.from("audit_logs").insert({
    action: "platform.password_link_generated",
    actor_type: "platform_admin",
    actor_user_id: claims?.claims?.sub ?? null,
    entity_type: "profile",
    entity_id: id.data,
  });

  return ok({ url: url.toString() });
}
