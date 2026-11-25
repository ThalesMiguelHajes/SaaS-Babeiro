"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMembership } from "@/lib/authz";
import { messageFor, toDomainErrorCode } from "@/lib/errors";
import { readImageFile } from "@/lib/images.server";
import { fail, ok, type Result } from "@/lib/result";
import { ESTABLISHMENT_ASSETS_BUCKET } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { validationFailure } from "@/lib/validation";

import {
  myProfileSchema,
  professionalFormSchema,
  type MyProfileInput,
  type ProfessionalFormInput,
} from "./schemas";

const ADMIN_ROLES = ["owner", "admin"] as const;

function dbFailure(error: { code?: string | null; message?: string | null }): Result<never> {
  const code = toDomainErrorCode(error);
  return fail(code, messageFor(code));
}

function revalidate(slug: string) {
  revalidatePath(`/painel/${slug}`, "layout");
  revalidatePath(`/profissional/${slug}`, "layout");
}

async function syncProfessionalServices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  establishmentId: string,
  professionalId: string,
  serviceIds: string[],
) {
  const { data: current, error } = await supabase
    .from("professional_services")
    .select("service_id")
    .eq("establishment_id", establishmentId)
    .eq("professional_id", professionalId);
  if (error) return error;
  const wanted = new Set(serviceIds);
  const existing = new Set((current ?? []).map((c) => c.service_id));
  const toAdd = [...wanted].filter((id) => !existing.has(id));
  const toRemove = [...existing].filter((id) => !wanted.has(id));
  if (toRemove.length) {
    const del = await supabase
      .from("professional_services")
      .delete()
      .eq("establishment_id", establishmentId)
      .eq("professional_id", professionalId)
      .in("service_id", toRemove);
    if (del.error) return del.error;
  }
  if (toAdd.length) {
    const ins = await supabase.from("professional_services").insert(
      toAdd.map((service_id) => ({
        establishment_id: establishmentId,
        professional_id: professionalId,
        service_id,
      })),
    );
    if (ins.error) return ins.error;
  }
  return null;
}

export async function saveProfessionalAction(
  slug: string,
  professionalId: string | null,
  input: ProfessionalFormInput,
): Promise<Result<{ id: string }>> {
  const ctx = await getMembership(slug, ADMIN_ROLES);
  if (!ctx) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = professionalFormSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;

  const row = {
    display_name: d.displayName,
    bio: d.bio,
    specialties: d.specialties,
    is_bookable: d.isBookable,
    is_active: d.isActive,
  };
  const supabase = await createClient();
  let id = professionalId;
  if (id) {
    const { error } = await supabase
      .from("professionals")
      .update(row)
      .eq("establishment_id", ctx.establishment.id)
      .eq("id", id);
    if (error) return dbFailure(error);
  } else {
    const { data, error } = await supabase
      .from("professionals")
      .insert({ ...row, establishment_id: ctx.establishment.id })
      .select("id")
      .single();
    if (error) return dbFailure(error);
    id = data.id;
  }

  const linkError = await syncProfessionalServices(
    supabase,
    ctx.establishment.id,
    id,
    d.serviceIds,
  );
  if (linkError) return dbFailure(linkError);

  revalidate(slug);
  return ok({ id });
}

export async function linkProfessionalUserAction(
  slug: string,
  professionalId: string,
  userId: string | null,
): Promise<Result<null>> {
  const ctx = await getMembership(slug, ADMIN_ROLES);
  if (!ctx) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  if (
    !z.uuid().safeParse(professionalId).success ||
    (userId !== null && !z.uuid().safeParse(userId).success)
  ) {
    return fail("VALIDATION_ERROR", messageFor("VALIDATION_ERROR"));
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("link_professional_user", {
    p_professional_id: professionalId,
    // null desvincula; o tipo gerado não expressa argumentos anuláveis.
    p_user_id: userId as string,
  });
  if (error) return dbFailure(error);
  revalidate(slug);
  return ok(null);
}

/** Foto do profissional: owner/admin para qualquer um; o próprio profissional para si (RPC confere). */
export async function uploadProfessionalPhotoAction(formData: FormData): Promise<Result<null>> {
  const slug = String(formData.get("slug") ?? "");
  const professionalId = z.uuid().safeParse(formData.get("professionalId"));
  const remove = formData.get("remove") === "1";
  const ctx = await getMembership(slug);
  if (!ctx || !professionalId.success) return fail("FORBIDDEN", messageFor("FORBIDDEN"));

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("professionals")
    .select("photo_path")
    .eq("establishment_id", ctx.establishment.id)
    .eq("id", professionalId.data)
    .maybeSingle();
  if (!current) return fail("NOT_FOUND", messageFor("NOT_FOUND"));

  const admin = createAdminClient();
  let newPath: string | null = null;
  if (!remove) {
    const image = await readImageFile(formData.get("file"));
    if (!image) return fail("FILE_INVALID", messageFor("FILE_INVALID"));
    newPath = `${ctx.establishment.id}/professionals/${professionalId.data}/${crypto.randomUUID()}.${image.ext}`;
    const upload = await admin.storage
      .from(ESTABLISHMENT_ASSETS_BUCKET)
      .upload(newPath, image.bytes, {
        contentType: image.mime,
        cacheControl: "31536000",
        upsert: false,
      });
    if (upload.error) return fail("UNEXPECTED", messageFor("UNEXPECTED"));
  }

  const { error } = await supabase.rpc("set_professional_photo", {
    p_professional_id: professionalId.data,
    p_path: newPath as string,
  });
  if (error) {
    if (newPath) await admin.storage.from(ESTABLISHMENT_ASSETS_BUCKET).remove([newPath]);
    return dbFailure(error);
  }
  if (current.photo_path)
    await admin.storage.from(ESTABLISHMENT_ASSETS_BUCKET).remove([current.photo_path]);

  revalidate(slug);
  return ok(null);
}

/** O próprio profissional atualiza nome de exibição, bio e especialidades. */
export async function updateMyProfileAction(
  slug: string,
  input: MyProfileInput,
): Promise<Result<null>> {
  const ctx = await getMembership(slug);
  if (!ctx?.professionalId) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = myProfileSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_professional_profile", {
    p_establishment_id: ctx.establishment.id,
    p_display_name: parsed.data.displayName,
    p_bio: parsed.data.bio,
    p_specialties: parsed.data.specialties,
  });
  if (error) return dbFailure(error);
  revalidate(slug);
  return ok(null);
}
