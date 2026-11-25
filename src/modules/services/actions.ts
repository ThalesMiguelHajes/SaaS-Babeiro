"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMembership } from "@/lib/authz";
import { messageFor, toDomainErrorCode } from "@/lib/errors";
import { fail, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import { validationFailure } from "@/lib/validation";

import { categoryNameSchema, serviceFormSchema, type ServiceFormInput } from "./schemas";

const ADMIN_ROLES = ["owner", "admin"] as const;

async function adminContext(slug: string) {
  return getMembership(slug, ADMIN_ROLES);
}

function dbFailure(error: { code?: string | null; message?: string | null }): Result<never> {
  if (error.code === "23505") return fail("VALIDATION_ERROR", "Já existe um item com esse nome.");
  const code = toDomainErrorCode(error);
  return fail(code, messageFor(code));
}

function revalidate(slug: string) {
  revalidatePath(`/painel/${slug}`, "layout");
}

/** Sincroniza quais profissionais realizam o serviço (somente profissionais do mesmo estabelecimento). */
async function syncServiceProfessionals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  establishmentId: string,
  serviceId: string,
  professionalIds: string[],
) {
  const { data: current, error } = await supabase
    .from("professional_services")
    .select("professional_id")
    .eq("establishment_id", establishmentId)
    .eq("service_id", serviceId);
  if (error) return error;

  const wanted = new Set(professionalIds);
  const existing = new Set((current ?? []).map((c) => c.professional_id));
  const toAdd = [...wanted].filter((id) => !existing.has(id));
  const toRemove = [...existing].filter((id) => !wanted.has(id));

  if (toRemove.length) {
    const del = await supabase
      .from("professional_services")
      .delete()
      .eq("establishment_id", establishmentId)
      .eq("service_id", serviceId)
      .in("professional_id", toRemove);
    if (del.error) return del.error;
  }
  if (toAdd.length) {
    // As FKs compostas garantem que profissional e serviço são do mesmo estabelecimento.
    const ins = await supabase.from("professional_services").insert(
      toAdd.map((professional_id) => ({
        establishment_id: establishmentId,
        professional_id,
        service_id: serviceId,
      })),
    );
    if (ins.error) return ins.error;
  }
  return null;
}

export async function saveServiceAction(
  slug: string,
  serviceId: string | null,
  input: ServiceFormInput,
): Promise<Result<{ id: string }>> {
  const ctx = await adminContext(slug);
  if (!ctx) return fail("FORBIDDEN", messageFor("FORBIDDEN"));

  const parsed = serviceFormSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;

  const row = {
    name: d.name,
    description: d.description,
    category_id: d.categoryId,
    price_cents: d.price,
    duration_minutes: d.durationMinutes,
    buffer_before_minutes: d.bufferBeforeMinutes,
    buffer_after_minutes: d.bufferAfterMinutes,
    is_public: d.isPublic,
    is_active: d.isActive,
  };

  const supabase = await createClient();
  let id = serviceId;
  if (id) {
    const { error } = await supabase
      .from("services")
      .update(row)
      .eq("establishment_id", ctx.establishment.id)
      .eq("id", id)
      .is("archived_at", null);
    if (error) return dbFailure(error);
  } else {
    const { data, error } = await supabase
      .from("services")
      .insert({ ...row, establishment_id: ctx.establishment.id })
      .select("id")
      .single();
    if (error) return dbFailure(error);
    id = data.id;
  }

  const linkError = await syncServiceProfessionals(
    supabase,
    ctx.establishment.id,
    id,
    d.professionalIds,
  );
  if (linkError) return dbFailure(linkError);

  revalidate(slug);
  return ok({ id });
}

/** Arquiva (some do agendamento e da lista principal; histórico preservado). */
export async function archiveServiceAction(slug: string, serviceId: string): Promise<Result<null>> {
  const ctx = await adminContext(slug);
  if (!ctx) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  if (!z.uuid().safeParse(serviceId).success) return fail("NOT_FOUND", messageFor("NOT_FOUND"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq("establishment_id", ctx.establishment.id)
    .eq("id", serviceId);
  if (error) return dbFailure(error);
  revalidate(slug);
  return ok(null);
}

export async function createCategoryAction(
  slug: string,
  name: string,
): Promise<Result<{ id: string }>> {
  const ctx = await adminContext(slug);
  if (!ctx) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = categoryNameSchema.safeParse(name);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_categories")
    .insert({ establishment_id: ctx.establishment.id, name: parsed.data })
    .select("id")
    .single();
  if (error) return dbFailure(error);
  revalidate(slug);
  return ok({ id: data.id });
}

export async function renameCategoryAction(
  slug: string,
  categoryId: string,
  name: string,
): Promise<Result<null>> {
  const ctx = await adminContext(slug);
  if (!ctx) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = categoryNameSchema.safeParse(name);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("service_categories")
    .update({ name: parsed.data })
    .eq("establishment_id", ctx.establishment.id)
    .eq("id", categoryId);
  if (error) return dbFailure(error);
  revalidate(slug);
  return ok(null);
}

/** Exclui a categoria; os serviços dela ficam "Sem categoria". */
export async function deleteCategoryAction(
  slug: string,
  categoryId: string,
): Promise<Result<null>> {
  const ctx = await adminContext(slug);
  if (!ctx) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_categories")
    .delete()
    .eq("establishment_id", ctx.establishment.id)
    .eq("id", categoryId);
  if (error) return dbFailure(error);
  revalidate(slug);
  return ok(null);
}
