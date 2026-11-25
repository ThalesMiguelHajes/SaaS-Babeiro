import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function listServices(establishmentId: string) {
  const supabase = await createClient();
  const [services, categories, links] = await Promise.all([
    supabase
      .from("services")
      .select(
        "id, name, description, category_id, price_cents, duration_minutes, buffer_before_minutes, buffer_after_minutes, is_active, is_public, archived_at, sort_order",
      )
      .eq("establishment_id", establishmentId)
      .order("sort_order")
      .order("name"),
    supabase
      .from("service_categories")
      .select("id, name, sort_order")
      .eq("establishment_id", establishmentId)
      .order("sort_order")
      .order("name"),
    supabase
      .from("professional_services")
      .select("service_id")
      .eq("establishment_id", establishmentId),
  ]);
  if (services.error) throw services.error;
  if (categories.error) throw categories.error;
  if (links.error) throw links.error;

  const professionalCount = new Map<string, number>();
  for (const l of links.data ?? [])
    professionalCount.set(l.service_id, (professionalCount.get(l.service_id) ?? 0) + 1);

  return {
    services: (services.data ?? []).map((s) => ({
      ...s,
      professionalCount: professionalCount.get(s.id) ?? 0,
    })),
    categories: categories.data ?? [],
  };
}

export async function getService(establishmentId: string, serviceId: string) {
  const supabase = await createClient();
  const [service, links] = await Promise.all([
    supabase
      .from("services")
      .select("*")
      .eq("establishment_id", establishmentId)
      .eq("id", serviceId)
      .maybeSingle(),
    supabase
      .from("professional_services")
      .select("professional_id")
      .eq("establishment_id", establishmentId)
      .eq("service_id", serviceId),
  ]);
  if (service.error) throw service.error;
  if (!service.data) return null;
  return { ...service.data, professionalIds: (links.data ?? []).map((l) => l.professional_id) };
}
