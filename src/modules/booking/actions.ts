"use server";

import { z } from "zod";

import { messageFor, toDomainErrorCode } from "@/lib/errors";
import { toE164 } from "@/lib/phone";
import { clientIpHash } from "@/lib/rate-limit";
import { fail, ok, type Result } from "@/lib/result";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { validationFailure } from "@/lib/validation";

import {
  bookingTokenSchema,
  createBookingSchema,
  MIN_FILL_MS,
  type CreateBookingInput,
} from "./schemas";
import type { CreatedBooking } from "./types";

/*
 * Ações da página pública: sem login. Toda regra (status do estabelecimento, disponibilidade,
 * limites por IP/telefone, política de cancelamento) é aplicada pelas RPCs públicas no banco,
 * que só a service_role executa (SECURITY §7–§8).
 */

const slugSchema = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const querySchema = z.object({
  slug: slugSchema,
  serviceId: z.uuid(),
  professionalId: z.uuid().nullable(),
});

function failFrom(error: { code?: string; message?: string }): Result<never> {
  const code = toDomainErrorCode(error);
  return fail(code, messageFor(code));
}

export async function getAvailableDatesAction(input: {
  slug: string;
  serviceId: string;
  professionalId: string | null;
  from: string;
  to: string;
}): Promise<Result<string[]>> {
  const parsed = querySchema.extend({ from: dateSchema, to: dateSchema }).safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;
  const { data, error } = await createAdminClient().rpc("public_get_available_dates", {
    p_slug: d.slug,
    p_service_id: d.serviceId,
    p_professional_id: d.professionalId as string,
    p_from: d.from,
    p_to: d.to,
    p_ip_hash: (await clientIpHash()) as string,
  });
  if (error) return failFrom(error);
  return ok((data ?? []) as string[]);
}

export async function getAvailableSlotsAction(input: {
  slug: string;
  serviceId: string;
  professionalId: string | null;
  date: string;
}): Promise<Result<string[]>> {
  const parsed = querySchema.extend({ date: dateSchema }).safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;
  const { data, error } = await createAdminClient().rpc("public_get_available_slots", {
    p_slug: d.slug,
    p_service_id: d.serviceId,
    p_professional_id: d.professionalId as string,
    p_date: d.date,
    p_ip_hash: (await clientIpHash()) as string,
  });
  if (error) return failFrom(error);
  return ok(((data ?? []) as string[]).map((t) => new Date(t).toISOString()));
}

export async function createBookingAction(
  slug: string,
  input: CreateBookingInput,
): Promise<Result<CreatedBooking>> {
  if (!slugSchema.safeParse(slug).success) return fail("NOT_FOUND", messageFor("NOT_FOUND"));
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;

  // Anti-bot: honeypot já validado pelo schema; tempo mínimo de preenchimento; Turnstile.
  if (Date.now() - d.startedAt < MIN_FILL_MS)
    return fail("RATE_LIMITED", messageFor("RATE_LIMITED"));
  if (!(await verifyTurnstile(d.turnstileToken))) {
    return fail("VALIDATION_ERROR", "Confirme que você não é um robô e tente de novo.");
  }

  const { data, error } = await createAdminClient().rpc("public_create_booking", {
    p_slug: slug,
    p_service_id: d.serviceId,
    p_professional_id: d.professionalId as string,
    p_starts_at: d.startsAt,
    p_customer_name: d.name,
    p_customer_phone: toE164(d.phone)!,
    p_customer_email: d.email as string,
    p_customer_notes: d.notes,
    p_ip_hash: (await clientIpHash()) as string,
  });
  if (error) return failFrom(error);
  return ok(data as unknown as CreatedBooking);
}

export async function cancelBookingAction(token: string, reason: string): Promise<Result<null>> {
  if (!bookingTokenSchema.safeParse(token).success)
    return fail("NOT_FOUND", messageFor("NOT_FOUND"));
  const r = z.string().trim().max(300).safeParse(reason);
  if (!r.success) return validationFailure(r.error);
  const { error } = await createAdminClient().rpc("public_cancel_booking", {
    p_token: token,
    p_reason: r.data,
    p_ip_hash: (await clientIpHash()) as string,
  });
  if (error) return failFrom(error);
  return ok(null);
}

export async function rescheduleBookingAction(
  token: string,
  startsAt: string,
): Promise<Result<null>> {
  if (!bookingTokenSchema.safeParse(token).success)
    return fail("NOT_FOUND", messageFor("NOT_FOUND"));
  if (!z.iso.datetime({ offset: true }).safeParse(startsAt).success) {
    return fail("VALIDATION_ERROR", messageFor("VALIDATION_ERROR"));
  }
  const { error } = await createAdminClient().rpc("public_reschedule_booking", {
    p_token: token,
    p_starts_at: startsAt,
    p_ip_hash: (await clientIpHash()) as string,
  });
  if (error) return failFrom(error);
  return ok(null);
}
