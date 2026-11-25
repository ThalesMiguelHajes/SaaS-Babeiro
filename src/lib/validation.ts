import type { ZodError } from "zod";

import { messageFor } from "@/lib/errors";
import { fail, type Result } from "@/lib/result";

/** Agrupa os erros do Zod por campo (primeiro nível do caminho). */
export function fieldErrorsOf(error: Pick<ZodError, "issues">): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export function validationFailure(error: Pick<ZodError, "issues">): Result<never> {
  return fail("VALIDATION_ERROR", messageFor("VALIDATION_ERROR"), fieldErrorsOf(error));
}
