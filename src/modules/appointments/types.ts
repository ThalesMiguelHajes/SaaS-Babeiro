import type { AppointmentStatus } from "./rules";

export type AgendaProfessional = {
  id: string;
  display_name: string;
  photo_path: string | null;
  is_active: boolean;
  work: [string, string][];
};

export type AgendaBlock = {
  id: string;
  professional_id: string | null;
  starts_at: string;
  ends_at: string;
  kind: string;
  reason: string | null;
  all_day: boolean;
};

export type AgendaAppointment = {
  id: string;
  professional_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  service_name: string;
  customer_name: string;
  price_cents: number;
  source: "public_page" | "admin_panel" | "professional_panel";
  outside_working_hours: boolean;
  paid_cents: number;
};

export type AgendaDay = {
  timezone: string;
  professionals: AgendaProfessional[];
  blocks: AgendaBlock[];
  appointments: AgendaAppointment[];
};

export type AppointmentDetail = {
  id: string;
  reference_code: string;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string;
  version: number;
  source: string;
  professional_id: string;
  professional_name: string;
  service_id: string;
  service_name: string;
  price_cents: number;
  final_price_cents: number | null;
  duration_minutes: number;
  customer_name: string;
  customer_phone: string | null;
  customer_notes: string | null;
  internal_notes: string | null;
  cancellation_reason: string | null;
  outside_working_hours: boolean;
  professional_auto_assigned: boolean;
  payments: {
    id: string;
    amount_cents: number;
    method: string;
    received_at: string;
    notes: string | null;
    voided_at: string | null;
    void_reason: string | null;
  }[];
  events: {
    id: number;
    event_type: string;
    from_status: AppointmentStatus | null;
    to_status: AppointmentStatus | null;
    previous_starts_at: string | null;
    new_starts_at: string | null;
    actor_type: string;
    note: string | null;
    created_at: string;
  }[];
};
