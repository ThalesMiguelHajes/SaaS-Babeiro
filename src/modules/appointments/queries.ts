import "server-only";

import { createClient } from "@/lib/supabase/server";
import { localToInstant } from "@/modules/availability/rules";

import type { ListFilters } from "./schemas";
import type { AgendaDay, AppointmentDetail } from "./types";

/** Agenda do dia (colunas, trabalho, bloqueios, agendamentos) — o banco aplica o escopo do papel. */
export async function getAgendaDay(establishmentId: string, date: string): Promise<AgendaDay> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_agenda_day", {
    p_establishment_id: establishmentId,
    p_date: date,
  });
  if (error) throw error;
  return data as unknown as AgendaDay;
}

/** Detalhe com pagamentos e histórico (RLS: admin vê todos; profissional, os próprios). */
export async function getAppointmentDetail(id: string): Promise<AppointmentDetail | null> {
  const supabase = await createClient();
  const [appt, payments, events] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, reference_code, status, starts_at, ends_at, version, source, professional_id, service_id, service_name_snapshot, price_cents_snapshot, final_price_cents, duration_minutes_snapshot, customer_name_snapshot, customer_phone_snapshot, customer_notes, internal_notes, cancellation_reason, outside_working_hours, professional_auto_assigned, professionals!appointments_professional_fk(display_name)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("appointment_payments")
      .select("id, amount_cents, method, received_at, notes, voided_at, void_reason")
      .eq("appointment_id", id)
      .order("received_at"),
    supabase
      .from("appointment_events")
      .select(
        "id, event_type, from_status, to_status, previous_starts_at, new_starts_at, actor_type, note, created_at",
      )
      .eq("appointment_id", id)
      .order("id"),
  ]);
  if (!appt.data) return null;
  const a = appt.data;
  return {
    id: a.id,
    reference_code: a.reference_code,
    status: a.status,
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    version: a.version,
    source: a.source,
    professional_id: a.professional_id,
    professional_name: a.professionals?.display_name ?? "",
    service_id: a.service_id,
    service_name: a.service_name_snapshot,
    price_cents: a.price_cents_snapshot,
    final_price_cents: a.final_price_cents,
    duration_minutes: a.duration_minutes_snapshot,
    customer_name: a.customer_name_snapshot,
    customer_phone: a.customer_phone_snapshot,
    customer_notes: a.customer_notes,
    internal_notes: a.internal_notes,
    cancellation_reason: a.cancellation_reason,
    outside_working_hours: a.outside_working_hours,
    professional_auto_assigned: a.professional_auto_assigned,
    payments: payments.data ?? [],
    events: events.data ?? [],
  };
}

/** Lista filtrável (visão "Lista" da agenda). */
export async function listAppointments(
  establishmentId: string,
  timeZone: string,
  filters: ListFilters,
) {
  const supabase = await createClient();
  let query = supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, status, service_name_snapshot, customer_name_snapshot, price_cents_snapshot, final_price_cents, professional_id, professionals!appointments_professional_fk(display_name)",
    )
    .eq("establishment_id", establishmentId)
    .gte("starts_at", localToInstant(filters.from, "00:00", timeZone))
    .lt("starts_at", localToInstant(filters.to, "24:00", timeZone))
    .order("starts_at")
    .limit(500);
  if (filters.professionalId) query = query.eq("professional_id", filters.professionalId);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Busca de clientes para o agendamento manual (somente owner/admin leem clientes). */
export async function searchCustomers(establishmentId: string, term: string) {
  const supabase = await createClient();
  const clean = term.replace(/[%_,()]/g, " ").trim();
  if (clean.length < 2) return [];
  const digits = clean.replace(/\D/g, "");
  const { data } = await supabase
    .from("customers")
    .select("id, full_name, phone_e164")
    .eq("establishment_id", establishmentId)
    .is("anonymized_at", null)
    .or(
      digits.length >= 4
        ? `full_name.ilike.%${clean}%,phone_e164.ilike.%${digits}%`
        : `full_name.ilike.%${clean}%`,
    )
    .order("full_name")
    .limit(8);
  return data ?? [];
}

/** Serviços agendáveis pelo painel, com quem realiza cada um (diálogo de novo agendamento). */
export async function listServicesForBooking(establishmentId: string) {
  const supabase = await createClient();
  const [services, links] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("establishment_id", establishmentId)
      .eq("is_active", true)
      .is("archived_at", null)
      .order("sort_order")
      .order("name"),
    supabase
      .from("professional_services")
      .select("service_id, professional_id")
      .eq("establishment_id", establishmentId),
  ]);
  return (services.data ?? []).map((s) => ({
    ...s,
    professionalIds: (links.data ?? [])
      .filter((l) => l.service_id === s.id)
      .map((l) => l.professional_id),
  }));
}

export async function canStaffRecordPayments(establishmentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("establishment_settings")
    .select("staff_can_record_payments")
    .eq("establishment_id", establishmentId)
    .single();
  return data?.staff_can_record_payments ?? false;
}
