"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMembership } from "@/lib/authz";
import { messageFor, toDomainErrorCode } from "@/lib/errors";
import { toE164 } from "@/lib/phone";
import { fail, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import { validationFailure } from "@/lib/validation";

import { getAppointmentDetail, searchCustomers } from "./queries";
import type { AppointmentStatus } from "./rules";
import {
  completeSchema,
  newAppointmentSchema,
  recordPaymentSchema,
  type CompleteInput,
  type NewAppointmentInput,
  type RecordPaymentInput,
} from "./schemas";
import type { AppointmentDetail } from "./types";

/*
 * Autorização fina (admin x profissional responsável, encaixe, permissão de registrar pagamentos)
 * é feita pelas RPCs. Aqui conferimos o vínculo com o estabelecimento do slug.
 */

const id = z.uuid();
const version = z.number().int().positive();

function failFrom(error: { code?: string; message?: string }): Result<never> {
  const code = toDomainErrorCode(error);
  return fail(code, messageFor(code));
}

function revalidate(slug: string) {
  revalidatePath(`/painel/${slug}`, "layout");
  revalidatePath(`/profissional/${slug}`, "layout");
}

export async function getAppointmentDetailAction(
  slug: string,
  appointmentId: string,
): Promise<Result<AppointmentDetail>> {
  const ctx = await getMembership(slug);
  if (!ctx || !id.safeParse(appointmentId).success)
    return fail("NOT_FOUND", messageFor("NOT_FOUND"));
  const detail = await getAppointmentDetail(appointmentId);
  if (!detail) return fail("NOT_FOUND", messageFor("NOT_FOUND"));
  return ok(detail);
}

export async function searchCustomersAction(slug: string, term: string) {
  const ctx = await getMembership(slug, ["owner", "admin"]);
  if (!ctx || typeof term !== "string" || term.length > 60) return [];
  return searchCustomers(ctx.establishment.id, term);
}

export async function createAppointmentAction(
  slug: string,
  input: NewAppointmentInput,
): Promise<Result<{ id: string }>> {
  const ctx = await getMembership(slug);
  if (!ctx) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = newAppointmentSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_appointment", {
    p_establishment_id: ctx.establishment.id,
    p_service_id: d.serviceId,
    p_professional_id: d.professionalId as string,
    p_starts_at: d.startsAt,
    p_customer_id: d.customerId as string,
    p_customer_name: d.customerName,
    p_customer_phone: (d.customerPhone ? toE164(d.customerPhone) : null) as string,
    p_customer_email: null as unknown as string,
    p_customer_notes: null as unknown as string,
    p_internal_notes: d.notes,
    p_outside_working_hours: d.outsideWorkingHours,
  });
  if (error) return failFrom(error);
  revalidate(slug);
  return ok({ id: (data as { id: string }).id });
}

export async function updateStatusAction(
  slug: string,
  appointmentId: string,
  status: AppointmentStatus,
  note: string,
  expectedVersion: number,
): Promise<Result<null>> {
  const ctx = await getMembership(slug);
  const parsed = z
    .object({
      appointmentId: id,
      status: z.enum(["confirmed", "in_progress", "cancelled", "no_show"]),
      note: z.string().trim().max(300),
      expectedVersion: version,
    })
    .safeParse({ appointmentId, status, note, expectedVersion });
  if (!ctx) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_appointment_status", {
    p_appointment_id: parsed.data.appointmentId,
    p_status: parsed.data.status,
    p_note: parsed.data.note,
    p_expected_version: parsed.data.expectedVersion,
  });
  if (error) return failFrom(error);
  revalidate(slug);
  return ok(null);
}

export async function rescheduleAction(
  slug: string,
  appointmentId: string,
  startsAt: string,
  professionalId: string | null,
  expectedVersion: number,
  outsideWorkingHours: boolean,
): Promise<Result<null>> {
  const ctx = await getMembership(slug);
  const parsed = z
    .object({
      appointmentId: id,
      startsAt: z.iso.datetime({ offset: true }),
      professionalId: id.nullable(),
      expectedVersion: version,
      outsideWorkingHours: z.boolean(),
    })
    .safeParse({ appointmentId, startsAt, professionalId, expectedVersion, outsideWorkingHours });
  if (!ctx) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("reschedule_appointment", {
    p_appointment_id: d.appointmentId,
    p_starts_at: d.startsAt,
    p_professional_id: d.professionalId as string,
    p_expected_version: d.expectedVersion,
    p_outside_working_hours: d.outsideWorkingHours,
  });
  if (error) return failFrom(error);
  revalidate(slug);
  return ok(null);
}

export async function completeAction(
  slug: string,
  appointmentId: string,
  input: CompleteInput,
  expectedVersion: number,
): Promise<Result<null>> {
  const ctx = await getMembership(slug);
  if (!ctx || !id.safeParse(appointmentId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  if (!version.safeParse(expectedVersion).success)
    return fail("STALE_VERSION", messageFor("STALE_VERSION"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_appointment", {
    p_appointment_id: appointmentId,
    p_final_price_cents: parsed.data.finalPrice,
    p_payments: parsed.data.payments.map((p) => ({
      amount_cents: p.amount,
      method: p.method,
      notes: p.notes,
    })),
    p_expected_version: expectedVersion,
  });
  if (error) return failFrom(error);
  revalidate(slug);
  return ok(null);
}

export async function recordPaymentAction(
  slug: string,
  appointmentId: string,
  input: RecordPaymentInput,
): Promise<Result<null>> {
  const ctx = await getMembership(slug);
  if (!ctx || !id.safeParse(appointmentId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_appointment_payment", {
    p_appointment_id: appointmentId,
    p_amount_cents: parsed.data.amount,
    p_method: parsed.data.method as "pix",
    p_notes: parsed.data.notes,
  });
  if (error) return failFrom(error);
  revalidate(slug);
  return ok(null);
}

export async function voidPaymentAction(
  slug: string,
  paymentId: string,
  reason: string,
): Promise<Result<null>> {
  const ctx = await getMembership(slug);
  if (!ctx || !id.safeParse(paymentId).success) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_appointment_payment", {
    p_payment_id: paymentId,
    p_reason: String(reason).slice(0, 300),
  });
  if (error) return failFrom(error);
  revalidate(slug);
  return ok(null);
}

/** Horários livres para a equipe (modo painel) — usados no novo agendamento e na remarcação. */
export async function getPanelSlotsAction(
  slug: string,
  input: { serviceId: string; professionalId: string | null; date: string },
): Promise<Result<string[]>> {
  const ctx = await getMembership(slug);
  const parsed = z
    .object({
      serviceId: id,
      professionalId: id.nullable(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse(input);
  if (!ctx) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  if (!parsed.success) return validationFailure(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_establishment_id: ctx.establishment.id,
    p_service_id: parsed.data.serviceId,
    p_professional_id: parsed.data.professionalId as string,
    p_date: parsed.data.date,
  });
  if (error) return failFrom(error);
  return ok((data ?? []).map((s) => new Date(s.starts_at).toISOString()));
}
