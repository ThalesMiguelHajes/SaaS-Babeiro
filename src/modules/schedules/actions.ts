"use server";

import { revalidatePath } from "next/cache";

import { getMembership } from "@/lib/authz";
import { messageFor, toDomainErrorCode } from "@/lib/errors";
import { fail, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import { validationFailure } from "@/lib/validation";
import { localToInstant } from "@/modules/availability/rules";

import { toWeeklyPayload } from "./rules";
import {
  blockSchema,
  dateOverrideSchema,
  weeklyHoursSchema,
  type BlockInput,
  type DateOverrideInput,
  type WeeklyHoursInput,
} from "./schemas";

export type ConflictPreview = {
  appointmentId: string;
  professionalName: string;
  startsAt: string;
  serviceName: string;
  customerName: string;
  reason: string;
};

export type SaveScheduleResult = { saved: boolean; conflicts: ConflictPreview[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Autorização fina (admin x staff, permissões da casa) fica nas RPCs; aqui só conferimos o
 * vínculo com o estabelecimento do slug para obter o id real (o slug não é autorização).
 */
async function context(slug: string, professionalId: string | null) {
  if (professionalId !== null && !UUID.test(professionalId)) return null;
  return getMembership(slug);
}

function toResult(data: unknown): SaveScheduleResult {
  const raw = (data ?? {}) as { saved?: boolean; conflicts?: Record<string, string>[] };
  return {
    saved: Boolean(raw.saved),
    conflicts: (raw.conflicts ?? []).map((c) => ({
      appointmentId: c.appointment_id ?? "",
      professionalName: c.professional_name ?? "",
      startsAt: c.starts_at ?? "",
      serviceName: c.service_name ?? "",
      customerName: c.customer_name ?? "",
      reason: c.reason ?? "",
    })),
  };
}

function revalidate(slug: string) {
  revalidatePath(`/painel/${slug}`, "layout");
  revalidatePath(`/profissional/${slug}`, "layout");
}

export async function saveWeeklyHoursAction(
  slug: string,
  professionalId: string | null,
  input: WeeklyHoursInput,
  confirm: boolean,
): Promise<Result<SaveScheduleResult>> {
  const ctx = await context(slug, professionalId);
  if (!ctx) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = weeklyHoursSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_weekly_hours", {
    p_establishment_id: ctx.establishment.id,
    p_professional_id: professionalId as string,
    p_intervals: toWeeklyPayload(parsed.data.days),
    p_confirm: confirm,
  });
  if (error) {
    const code = toDomainErrorCode(error);
    return fail(code, messageFor(code));
  }
  revalidate(slug);
  return ok(toResult(data));
}

export async function saveDateOverrideAction(
  slug: string,
  professionalId: string | null,
  input: DateOverrideInput,
  confirm: boolean,
): Promise<Result<SaveScheduleResult>> {
  const ctx = await context(slug, professionalId);
  if (!ctx) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = dateOverrideSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_date_override", {
    p_establishment_id: ctx.establishment.id,
    p_professional_id: professionalId as string,
    p_date: d.date,
    p_kind: d.kind,
    p_intervals: d.kind === "closed" ? [] : d.intervals,
    p_label: d.label,
    p_confirm: confirm,
  });
  if (error) {
    const code = toDomainErrorCode(error);
    return fail(code, messageFor(code));
  }
  revalidate(slug);
  return ok(toResult(data));
}

export async function deleteDateOverrideAction(
  slug: string,
  professionalId: string | null,
  date: string,
): Promise<Result<null>> {
  const ctx = await context(slug, professionalId);
  if (!ctx || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_date_override", {
    p_establishment_id: ctx.establishment.id,
    p_professional_id: professionalId as string,
    p_date: date,
  });
  if (error) {
    const code = toDomainErrorCode(error);
    return fail(code, messageFor(code));
  }
  revalidate(slug);
  return ok(null);
}

export async function saveBlockAction(
  slug: string,
  blockId: string | null,
  input: BlockInput,
  confirm: boolean,
): Promise<Result<SaveScheduleResult>> {
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;
  const ctx = await context(slug, d.professionalId);
  if (!ctx || (blockId !== null && !UUID.test(blockId))) {
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  }

  // Datas e horas locais → instantes no fuso do estabelecimento.
  const tz = ctx.establishment.timezone;
  const startsAt = localToInstant(d.startDate, d.allDay ? "00:00" : d.startTime, tz);
  const endsAt = localToInstant(d.endDate, d.allDay ? "24:00" : d.endTime, tz);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_availability_block", {
    p_establishment_id: ctx.establishment.id,
    p_block_id: blockId as string,
    p_professional_id: d.professionalId as string,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_all_day: d.allDay,
    p_kind: d.kind as "other",
    p_reason: d.reason,
    p_confirm: confirm,
  });
  if (error) {
    const code = toDomainErrorCode(error);
    return fail(code, messageFor(code));
  }
  revalidate(slug);
  return ok(toResult(data));
}

export async function deleteBlockAction(slug: string, blockId: string): Promise<Result<null>> {
  const ctx = await getMembership(slug);
  if (!ctx || !UUID.test(blockId)) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_availability_block", { p_block_id: blockId });
  if (error) {
    const code = toDomainErrorCode(error);
    return fail(code, messageFor(code));
  }
  revalidate(slug);
  return ok(null);
}
