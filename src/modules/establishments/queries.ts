import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getEstablishmentProfile(establishmentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("establishments")
    .select(
      "id, slug, name, description, phone_e164, whatsapp_e164, instagram_handle, address_street, address_number, address_complement, address_district, address_city, address_state, address_postal_code, accent_color, logo_path, cover_path",
    )
    .eq("id", establishmentId)
    .single();
  if (error) throw error;
  return data;
}

export async function getBookingSettings(establishmentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("establishment_settings")
    .select("*")
    .eq("establishment_id", establishmentId)
    .single();
  if (error) throw error;
  return data;
}

/** Contagens para o checklist de configuração do painel. */
export async function getSetupStatus(establishmentId: string) {
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };
  const [pros, services, links, team, profile, hours] = await Promise.all([
    supabase
      .from("professionals")
      .select("id", head)
      .eq("establishment_id", establishmentId)
      .eq("is_active", true),
    supabase
      .from("services")
      .select("id", head)
      .eq("establishment_id", establishmentId)
      .eq("is_active", true),
    supabase
      .from("professional_services")
      .select("service_id", head)
      .eq("establishment_id", establishmentId),
    supabase
      .from("establishment_members")
      .select("id", head)
      .eq("establishment_id", establishmentId)
      .eq("is_active", true),
    supabase
      .from("establishments")
      .select("description, logo_path, whatsapp_e164")
      .eq("id", establishmentId)
      .single(),
    supabase
      .from("establishment_working_hours")
      .select("id", head)
      .eq("establishment_id", establishmentId),
  ]);
  return {
    professionals: pros.count ?? 0,
    services: services.count ?? 0,
    serviceLinks: links.count ?? 0,
    teamMembers: team.count ?? 0,
    hasProfile: Boolean(profile.data?.description && profile.data?.whatsapp_e164),
    hasLogo: Boolean(profile.data?.logo_path),
    hasHours: (hours.count ?? 0) > 0,
  };
}
