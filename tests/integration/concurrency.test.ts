import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/types/database";

/**
 * Concorrência de reservas contra o Supabase local (DATABASE §8, BACKLOG E4-8).
 * Executar com: INTEGRATION_DB=1 pnpm test:integration (requer `supabase start` com o seed).
 */
const enabled = Boolean(process.env.INTEGRATION_DB);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

const EST = "10000000-0000-4000-a000-00000000000a";
const SEED_PRO = "20000000-0000-4000-a000-00000000000a";
const TZ_OFFSET = "-03:00"; // Barbearia A usa America/Sao_Paulo (sem horário de verão)

type Client = SupabaseClient<Database>;

/** Próxima terça-feira com pelo menos 7 dias de distância (o seed abre seg–sáb). */
function testDate(weeksAhead: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7 * weeksAhead + ((2 - d.getUTCDay() + 7) % 7) + 7);
  return d.toISOString().slice(0, 10);
}
const at = (date: string, time: string) => `${date}T${time}:00${TZ_OFFSET}`;

describe.skipIf(!enabled)("reservas concorrentes", () => {
  let owner: Client;
  let admin: Client;
  let serviceId: string;
  let secondPro: string;
  const date = testDate(Math.floor(Math.random() * 20) + 1);

  async function create(professionalId: string | null, time: string, name = "Cliente") {
    return owner.rpc("create_appointment", {
      p_establishment_id: EST,
      p_service_id: serviceId,
      p_professional_id: professionalId as string,
      p_starts_at: at(date, time),
      p_customer_id: null as unknown as string,
      p_customer_name: name,
      p_customer_phone: null as unknown as string,
      p_customer_email: null as unknown as string,
      p_customer_notes: null as unknown as string,
      p_internal_notes: null as unknown as string,
    });
  }

  beforeAll(async () => {
    admin = createClient<Database>(url, secretKey, { auth: { persistSession: false } });
    owner = createClient<Database>(url, publishableKey, { auth: { persistSession: false } });
    const { error } = await owner.auth.signInWithPassword({
      email: "dono.a@local.dev",
      password: "Senha123",
    });
    if (error) throw error;

    // Serviço e segundo profissional exclusivos desta execução.
    const suffix = Math.random().toString(36).slice(2, 8);
    const svc = await admin
      .from("services")
      .insert({
        establishment_id: EST,
        name: `Concorrência ${suffix}`,
        price_cents: 1000,
        duration_minutes: 30,
      })
      .select("id")
      .single();
    if (svc.error) throw svc.error;
    serviceId = svc.data.id;
    const pro = await admin
      .from("professionals")
      .insert({ establishment_id: EST, display_name: `Paralelo ${suffix}` })
      .select("id")
      .single();
    if (pro.error) throw pro.error;
    secondPro = pro.data.id;
    const links = await admin.from("professional_services").insert([
      { establishment_id: EST, professional_id: SEED_PRO, service_id: serviceId },
      { establishment_id: EST, professional_id: secondPro, service_id: serviceId },
    ]);
    if (links.error) throw links.error;
  });

  afterAll(async () => {
    if (!admin) return;
    // Histórico de agendamentos é permanente: cancela e arquiva em vez de apagar.
    await admin
      .from("appointments")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("service_id", serviceId)
      .neq("status", "cancelled");
    await admin
      .from("services")
      .update({ is_active: false, archived_at: new Date().toISOString() })
      .eq("id", serviceId);
    await admin.from("professionals").update({ is_active: false }).eq("id", secondPro);
  });

  it("20 reservas simultâneas no mesmo horário → exatamente 1 sucesso", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => create(SEED_PRO, "09:00", `Cliente ${i}`)),
    );
    const ok = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);
    expect(ok).toHaveLength(1);
    expect(failed.every((r) => r.error?.message === "SLOT_UNAVAILABLE")).toBe(true);
  });

  it("horários parcialmente sobrepostos em paralelo → só um vence", async () => {
    const results = await Promise.all(
      ["10:00", "10:15", "10:00", "10:15", "10:00", "10:15"].map((t) => create(SEED_PRO, t)),
    );
    expect(results.filter((r) => !r.error)).toHaveLength(1);
  });

  it('"qualquer profissional" em paralelo → no máximo um por profissional', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => create(null, "14:00")));
    const ok = results.filter((r) => !r.error);
    expect(ok).toHaveLength(2);
    const pros = new Set(ok.map((r) => (r.data as { professional_id: string }).professional_id));
    expect(pros).toEqual(new Set([SEED_PRO, secondPro]));
  });

  it("reagendamentos cruzados simultâneos não geram sobreposição nem deadlock", async () => {
    const a = await create(SEED_PRO, "16:00");
    const b = await create(secondPro, "16:00");
    expect(a.error ?? b.error).toBeNull();
    const idA = (a.data as { id: string }).id;
    const idB = (b.data as { id: string }).id;

    // A vai para o profissional de B e B para o de A, no mesmo horário, ao mesmo tempo.
    const [ra, rb] = await Promise.all([
      owner.rpc("reschedule_appointment", {
        p_appointment_id: idA,
        p_starts_at: at(date, "16:00"),
        p_professional_id: secondPro,
        p_expected_version: 1,
      }),
      owner.rpc("reschedule_appointment", {
        p_appointment_id: idB,
        p_starts_at: at(date, "16:00"),
        p_professional_id: SEED_PRO,
        p_expected_version: 1,
      }),
    ]);
    // Cada um encontra o horário ocupado pelo outro: ambos falham e nada muda.
    expect(ra.error?.message).toBe("SLOT_UNAVAILABLE");
    expect(rb.error?.message).toBe("SLOT_UNAVAILABLE");
    const { data } = await admin
      .from("appointments")
      .select("id, professional_id")
      .in("id", [idA, idB]);
    expect(new Map(data?.map((r) => [r.id, r.professional_id]))).toEqual(
      new Map([
        [idA, SEED_PRO],
        [idB, secondPro],
      ]),
    );
  });

  it("cancelamento libera o horário na hora", async () => {
    const first = await create(SEED_PRO, "17:00");
    expect(first.error).toBeNull();
    const id = (first.data as { id: string }).id;
    expect((await create(SEED_PRO, "17:00")).error?.message).toBe("SLOT_UNAVAILABLE");
    const cancel = await owner.rpc("update_appointment_status", {
      p_appointment_id: id,
      p_status: "cancelled",
      p_note: "teste",
      p_expected_version: 1,
    });
    expect(cancel.error).toBeNull();
    expect((await create(SEED_PRO, "17:00")).error).toBeNull();
  });
});
