"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePlatformAdmin } from "@/lib/authz";
import { messageFor, toDomainErrorCode } from "@/lib/errors";
import { fail, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import { createEstablishmentSchema, type EstablishmentInput } from "./establishment-schema";

export async function createEstablishment(input: EstablishmentInput): Promise<Result<never>> {
  await requirePlatformAdmin();
  const parsed = createEstablishmentSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      messageFor("VALIDATION_ERROR"),
      z.flattenError(parsed.error).fieldErrors,
    );
  }

  const payload = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== ""),
  );
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_establishment", { payload });
  if (error) {
    const code = error.code === "23505" ? "SLUG_TAKEN" : toDomainErrorCode(error);
    const message = messageFor(code);
    if (code === "SLUG_RESERVED" || code === "SLUG_TAKEN")
      return fail(code, message, { slug: [message] });
    if (code === "INVALID_TIMEZONE") return fail(code, message, { timezone: [message] });
    return fail(code, message);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/estabelecimentos");
  redirect("/admin/estabelecimentos");
}
