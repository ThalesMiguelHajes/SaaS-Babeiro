import "server-only";

import { createClient } from "@/lib/supabase/server";

import { groupWeeklyHours, normalizeTime, sortIntervals, type TimeInterval } from "./rules";

export type DateOverride = {
  date: string;
  kind: "closed" | "custom_hours";
  label: string | null;
  intervals: TimeInterval[];
};

export type AvailabilityBlock = {
  id: string;
  professionalId: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  kind: string;
  reason: string | null;
};

export type ScheduleConflict = {
  appointmentId: string;
  professionalId: string;
  professionalName: string;
  startsAt: string;
  endsAt: string;
  serviceName: string;
  customerName: string;
  reason: string;
};

/** Horário semanal do estabelecimento (professionalId nulo) ou do profissional. */
export async function getWeeklyHours(establishmentId: string, professionalId: string | null) {
  const supabase = await createClient();
  const { data } = professionalId
    ? await supabase
        .from("professional_working_hours")
        .select("weekday, start_time, end_time")
        .eq("professional_id", professionalId)
    : await supabase
        .from("establishment_working_hours")
        .select("weekday, start_time, end_time")
        .eq("establishment_id", establishmentId);
  const rows = data ?? [];
  return { configured: rows.length > 0, days: groupWeeklyHours(rows) };
}

/** Exceções por data a partir de hoje (data local), agrupadas por data. */
export async function listDateOverrides(
  establishmentId: string,
  professionalId: string | null,
  fromDate: string,
): Promise<DateOverride[]> {
  const supabase = await createClient();
  const { data } = professionalId
    ? await supabase
        .from("professional_date_overrides")
        .select("date, kind, label, start_time, end_time")
        .eq("professional_id", professionalId)
        .gte("date", fromDate)
        .order("date")
    : await supabase
        .from("establishment_date_overrides")
        .select("date, kind, label, start_time, end_time")
        .eq("establishment_id", establishmentId)
        .gte("date", fromDate)
        .order("date");

  const byDate = new Map<string, DateOverride>();
  for (const row of data ?? []) {
    const entry = byDate.get(row.date) ?? {
      date: row.date,
      kind: row.kind,
      label: row.label,
      intervals: [],
    };
    if (row.start_time && row.end_time) {
      entry.intervals.push({
        start: normalizeTime(row.start_time),
        end: normalizeTime(row.end_time),
      });
    }
    byDate.set(row.date, entry);
  }
  return [...byDate.values()].map((o) => ({ ...o, intervals: sortIntervals(o.intervals) }));
}

/** Bloqueios que ainda não terminaram. scope: "establishment" (da casa) ou o id do profissional. */
export async function listBlocks(
  establishmentId: string,
  scope: "establishment" | string,
): Promise<AvailabilityBlock[]> {
  const supabase = await createClient();
  let query = supabase
    .from("availability_blocks")
    .select("id, professional_id, period, all_day, kind, reason")
    .eq("establishment_id", establishmentId)
    .filter("period", "ov", `[${new Date().toISOString()},infinity)`)
    .order("period")
    .limit(100);
  query =
    scope === "establishment"
      ? query.is("professional_id", null)
      : query.eq("professional_id", scope);
  const { data } = await query;
  return (data ?? []).map((b) => {
    const [startsAt, endsAt] = parseRange(b.period as string);
    return {
      id: b.id,
      professionalId: b.professional_id,
      startsAt,
      endsAt,
      allDay: b.all_day,
      kind: b.kind,
      reason: b.reason,
    };
  });
}

/** `["2026-01-01 12:00:00+00","2026-01-01 13:00:00+00")` → [iso, iso] */
export function parseRange(range: string): [string, string] {
  const inner = range.slice(1, -1);
  const [a = "", b = ""] = inner.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
  return [new Date(a).toISOString(), new Date(b).toISOString()];
}

/** Agendamentos futuros que ficaram fora do horário ou em cima de bloqueios (DATABASE §7.6). */
export async function getScheduleConflicts(establishmentId: string): Promise<ScheduleConflict[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_schedule_conflicts", {
    p_establishment_id: establishmentId,
  });
  return (data ?? []).map((c) => ({
    appointmentId: c.appointment_id,
    professionalId: c.professional_id,
    professionalName: c.professional_name,
    startsAt: c.starts_at,
    endsAt: c.ends_at,
    serviceName: c.service_name,
    customerName: c.customer_name,
    reason: c.reason,
  }));
}

export async function getStaffPermissions(establishmentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("establishment_settings")
    .select("staff_can_manage_own_blocks, staff_can_manage_own_hours")
    .eq("establishment_id", establishmentId)
    .single();
  return {
    canManageBlocks: data?.staff_can_manage_own_blocks ?? false,
    canManageHours: data?.staff_can_manage_own_hours ?? false,
  };
}
