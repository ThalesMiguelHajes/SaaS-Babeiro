import type { DomainErrorCode } from "@/lib/errors";

export type ResultError = {
  code: DomainErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type Result<T> = { ok: true; data: T } | { ok: false; error: ResultError };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });

export const fail = (
  code: DomainErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): Result<never> => ({
  ok: false,
  error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) },
});
