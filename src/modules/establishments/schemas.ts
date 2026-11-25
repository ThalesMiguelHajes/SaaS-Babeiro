import { z } from "zod";

import { toE164 } from "@/lib/phone";
import { BRAZIL_STATES } from "@/modules/platform/rules";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v));

const optionalPhone = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const e164 = toE164(value);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "Telefone inválido. Use DDD + número." });
      return z.NEVER;
    }
    return e164;
  });

/** Perfil público editável pelo owner/admin (nome, endereço da página e fuso ficam com o Super Admin). */
export const publicProfileSchema = z.object({
  description: optionalText(1000),
  whatsapp: optionalPhone,
  phone: optionalPhone,
  instagram: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@/, ""))
    .refine((v) => v === "" || /^[A-Za-z0-9._]{1,30}$/.test(v), "Usuário do Instagram inválido.")
    .transform((v) => (v === "" ? null : v)),
  postalCode: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || v.length === 8, "CEP deve ter 8 dígitos.")
    .transform((v) => (v === "" ? null : v)),
  street: optionalText(160),
  number: optionalText(20),
  complement: optionalText(80),
  district: optionalText(80),
  city: optionalText(80),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || (BRAZIL_STATES as readonly string[]).includes(v), "UF inválida.")
    .transform((v) => (v === "" ? null : v)),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida."),
});
export type PublicProfileInput = z.input<typeof publicProfileSchema>;
export type PublicProfileData = z.output<typeof publicProfileSchema>;

export const SLOT_INTERVALS = [5, 10, 15, 20, 30, 60] as const;

/** Regras de agendamento (DATABASE.md §5.5). */
export const bookingSettingsSchema = z.object({
  slotIntervalMinutes: z.coerce
    .number()
    .int()
    .refine(
      (n) => SLOT_INTERVALS.includes(n as (typeof SLOT_INTERVALS)[number]),
      "Intervalo inválido.",
    ),
  minBookingNoticeMinutes: z.coerce.number().int().min(0).max(10080),
  maxBookingDaysAhead: z.coerce
    .number()
    .int()
    .min(1, "Mínimo de 1 dia.")
    .max(365, "Máximo de 365 dias."),
  bookingRequiresConfirmation: z.boolean(),
  allowCustomerCancellation: z.boolean(),
  allowCustomerReschedule: z.boolean(),
  customerChangeNoticeMinutes: z.coerce.number().int().min(0).max(10080),
  maxActiveBookingsPerCustomer: z.coerce
    .number()
    .int()
    .min(1, "Mínimo de 1.")
    .max(50, "Máximo de 50."),
  staffCanManageOwnBlocks: z.boolean(),
  staffCanManageOwnHours: z.boolean(),
  staffCanRecordPayments: z.boolean(),
  publicBookingEnabled: z.boolean(),
  bookingPolicyText: optionalText(2000),
});
export type BookingSettingsInput = z.input<typeof bookingSettingsSchema>;
export type BookingSettingsData = z.output<typeof bookingSettingsSchema>;
