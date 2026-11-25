import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Dashboard = {
  expected_cents: number;
  realized_cents: number;
  received_cents: number;
  appointments: number;
  by_status: Record<string, number>;
  by_method: Record<string, number>;
  completed_without_payment: number;
  by_professional: {
    id: string;
    display_name: string;
    appointments: number;
    realized_cents: number;
    received_cents: number;
  }[];
};

/** Previsto × Realizado × Recebido no período (D19). O banco aplica o escopo do papel. */
export async function getDashboard(
  establishmentId: string,
  from: string,
  to: string,
): Promise<Dashboard> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_dashboard", {
    p_establishment_id: establishmentId,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return data as unknown as Dashboard;
}
