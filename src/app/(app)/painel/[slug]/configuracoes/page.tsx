import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { requireMembership } from "@/lib/authz";
import { BookingSettingsForm } from "@/modules/establishments/components/booking-settings-form";
import { getBookingSettings } from "@/modules/establishments/queries";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage({ params }: PageProps<"/painel/[slug]/configuracoes">) {
  const { slug } = await params;
  const { establishment } = await requireMembership(slug, ["owner", "admin"]);
  const s = await getBookingSettings(establishment.id);

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Regras de agendamento. Elas ficam salvas agora e passam a valer quando a agenda e a página de agendamento entrarem no ar."
      />
      <BookingSettingsForm
        slug={establishment.slug}
        defaults={{
          slotIntervalMinutes: s.slot_interval_minutes,
          minBookingNoticeMinutes: s.min_booking_notice_minutes,
          maxBookingDaysAhead: s.max_booking_days_ahead,
          bookingRequiresConfirmation: s.booking_requires_confirmation,
          allowCustomerCancellation: s.allow_customer_cancellation,
          allowCustomerReschedule: s.allow_customer_reschedule,
          customerChangeNoticeMinutes: s.customer_change_notice_minutes,
          maxActiveBookingsPerCustomer: s.max_active_bookings_per_customer,
          staffCanManageOwnBlocks: s.staff_can_manage_own_blocks,
          staffCanManageOwnHours: s.staff_can_manage_own_hours,
          staffCanRecordPayments: s.staff_can_record_payments,
          publicBookingEnabled: s.public_booking_enabled,
          bookingPolicyText: s.booking_policy_text ?? "",
        }}
      />
    </>
  );
}
