"use server";

import { revalidatePath } from "next/cache";

import { getMembership } from "@/lib/authz";
import { messageFor, toDomainErrorCode } from "@/lib/errors";
import { fail, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import { validationFailure } from "@/lib/validation";

import {
  bookingSettingsSchema,
  publicProfileSchema,
  type BookingSettingsInput,
  type PublicProfileInput,
} from "./schemas";

const ADMIN_ROLES = ["owner", "admin"] as const;

export async function updatePublicProfileAction(
  slug: string,
  input: PublicProfileInput,
): Promise<Result<null>> {
  const ctx = await getMembership(slug, ADMIN_ROLES);
  if (!ctx) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = publicProfileSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;

  // Colunas cadastrais (nome, slug, fuso, status) são protegidas pelo banco.
  const supabase = await createClient();
  const { error } = await supabase
    .from("establishments")
    .update({
      description: d.description,
      whatsapp_e164: d.whatsapp,
      phone_e164: d.phone,
      instagram_handle: d.instagram,
      address_postal_code: d.postalCode,
      address_street: d.street,
      address_number: d.number,
      address_complement: d.complement,
      address_district: d.district,
      address_city: d.city,
      address_state: d.state,
      accent_color: d.accentColor,
    })
    .eq("id", ctx.establishment.id);
  if (error) {
    const code = toDomainErrorCode(error);
    return fail(code, messageFor(code));
  }
  revalidatePath(`/painel/${slug}`, "layout");
  return ok(null);
}

export async function updateBookingSettingsAction(
  slug: string,
  input: BookingSettingsInput,
): Promise<Result<null>> {
  const ctx = await getMembership(slug, ADMIN_ROLES);
  if (!ctx) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = bookingSettingsSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("establishment_settings")
    .update({
      slot_interval_minutes: d.slotIntervalMinutes,
      min_booking_notice_minutes: d.minBookingNoticeMinutes,
      max_booking_days_ahead: d.maxBookingDaysAhead,
      booking_requires_confirmation: d.bookingRequiresConfirmation,
      allow_customer_cancellation: d.allowCustomerCancellation,
      allow_customer_reschedule: d.allowCustomerReschedule,
      customer_change_notice_minutes: d.customerChangeNoticeMinutes,
      max_active_bookings_per_customer: d.maxActiveBookingsPerCustomer,
      staff_can_manage_own_blocks: d.staffCanManageOwnBlocks,
      staff_can_manage_own_hours: d.staffCanManageOwnHours,
      staff_can_record_payments: d.staffCanRecordPayments,
      public_booking_enabled: d.publicBookingEnabled,
      booking_policy_text: d.bookingPolicyText,
    })
    .eq("establishment_id", ctx.establishment.id);
  if (error) {
    const code = toDomainErrorCode(error);
    return fail(code, messageFor(code));
  }
  revalidatePath(`/painel/${slug}`, "layout");
  return ok(null);
}
