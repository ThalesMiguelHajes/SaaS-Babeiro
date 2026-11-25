/** DTOs devolvidos pelas RPCs públicas (DATABASE §10.4). Apenas dados públicos. */

export type PublicEstablishment = {
  slug: string;
  name: string;
  description: string | null;
  logo_path: string | null;
  cover_path: string | null;
  accent_color: string;
  timezone: string;
  whatsapp_e164: string | null;
  phone_e164: string | null;
  instagram_handle: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  booking_enabled: boolean;
};

export type PublicService = {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  price_cents: number;
  duration_minutes: number;
};

export type PublicProfessional = {
  id: string;
  display_name: string;
  photo_path: string | null;
  specialties: string[];
  service_ids: string[];
};

export type BookingPage = {
  establishment: PublicEstablishment;
  settings: {
    slot_interval_minutes: number;
    min_booking_notice_minutes: number;
    max_booking_days_ahead: number;
    booking_requires_confirmation: boolean;
    allow_customer_cancellation: boolean;
    allow_customer_reschedule: boolean;
    customer_change_notice_minutes: number;
    booking_policy_text: string | null;
  };
  categories: { id: string; name: string }[];
  services: PublicService[];
  professionals: PublicProfessional[];
  hours: { weekday: number; start: string; end: string }[];
};

export type PublicBooking = {
  reference_code: string;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
  starts_at: string;
  ends_at: string;
  service_id: string;
  service_name: string;
  price_cents: number;
  duration_minutes: number;
  professional_id: string;
  professional_name: string;
  professional_photo_path: string | null;
  customer_name: string;
  customer_notes: string | null;
  cancellation_reason: string | null;
  can_cancel: boolean;
  can_reschedule: boolean;
  change_notice_minutes: number;
  establishment: Pick<
    PublicEstablishment,
    | "slug"
    | "name"
    | "timezone"
    | "accent_color"
    | "logo_path"
    | "whatsapp_e164"
    | "phone_e164"
    | "address_street"
    | "address_number"
    | "address_district"
    | "address_city"
    | "address_state"
  > & { status: "active" | "suspended" | "deactivated" };
};

export type CreatedBooking = {
  token: string;
  reference_code: string;
  starts_at: string;
  ends_at: string;
  status: "pending" | "confirmed";
};
