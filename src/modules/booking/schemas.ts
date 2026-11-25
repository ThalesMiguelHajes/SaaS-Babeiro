import { z } from "zod";

import { toE164 } from "@/lib/phone";

/** Tempo mínimo de preenchimento (anti-bot, SECURITY §8). */
export const MIN_FILL_MS = 3000;

export const customerFormSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120, "No máximo 120 caracteres."),
  phone: z
    .string()
    .trim()
    .refine((v) => toE164(v) !== null, "Informe um WhatsApp válido com DDD."),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === "" || z.email().safeParse(v).success, "E-mail inválido."),
  notes: z.string().trim().max(500, "No máximo 500 caracteres."),
});
export type CustomerFormInput = z.input<typeof customerFormSchema>;

export const createBookingSchema = customerFormSchema.extend({
  serviceId: z.uuid(),
  professionalId: z.uuid().nullable(),
  startsAt: z.iso.datetime({ offset: true }),
  // Honeypot: campo invisível que pessoas não preenchem.
  website: z.string().max(0),
  startedAt: z.number().int().positive(),
  turnstileToken: z.string().max(2048).nullable(),
});
export type CreateBookingInput = z.input<typeof createBookingSchema>;

export const bookingTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
