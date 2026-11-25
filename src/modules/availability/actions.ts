"use server";

import { z } from "zod";

import { getMembership } from "@/lib/authz";
import { messageFor, toDomainErrorCode } from "@/lib/errors";
import { fail, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import { validationFailure } from "@/lib/validation";

import type { Slot } from "./rules";

const slotQuerySchema = z.object({
  serviceId: z.uuid("Escolha um serviço."),
  professionalId: z.uuid().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha uma data."),
});
export type SlotQueryInput = z.input<typeof slotQuerySchema>;

/** Horários livres para a equipe (modo painel): ignora antecedência mínima e limite de dias. */
export async function getAvailableSlotsAction(
  slug: string,
  input: SlotQueryInput,
): Promise<Result<Slot[]>> {
  const ctx = await getMembership(slug);
  if (!ctx) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = slotQuerySchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_establishment_id: ctx.establishment.id,
    p_service_id: d.serviceId,
    p_professional_id: d.professionalId as string,
    p_date: d.date,
  });
  if (error) {
    const code = toDomainErrorCode(error);
    return fail(code, messageFor(code));
  }
  return ok(
    (data ?? []).map((s) => ({ startsAt: s.starts_at, professionalIds: s.professional_ids })),
  );
}
