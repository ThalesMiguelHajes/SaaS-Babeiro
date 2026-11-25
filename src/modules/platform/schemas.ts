import { z } from "zod";

import { toE164 } from "@/lib/phone";

import { BRAZIL_STATES, SLUG_PATTERN } from "./rules";

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

export const establishmentFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do estabelecimento.").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Use pelo menos 3 caracteres.")
    .max(60, "Use no máximo 60 caracteres.")
    .regex(SLUG_PATTERN, "Use apenas letras minúsculas, números e hífens."),
  business_type: z.enum(["barbershop", "beauty_salon", "nail_studio", "aesthetics", "other"]),
  timezone: z.string().min(1),
  description: optionalText(1000),
  owner_name: optionalText(120),
  owner_email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .refine((v) => v === "" || z.email().safeParse(v).success, "E-mail inválido.")
    .transform((v) => (v === "" ? null : v)),
  phone: optionalPhone,
  whatsapp: optionalPhone,
  instagram_handle: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@/, ""))
    .refine((v) => v === "" || /^[A-Za-z0-9._]{1,30}$/.test(v), "Usuário do Instagram inválido.")
    .transform((v) => (v === "" ? null : v)),
  address_postal_code: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || v.length === 8, "CEP deve ter 8 dígitos.")
    .transform((v) => (v === "" ? null : v)),
  address_street: optionalText(160),
  address_number: optionalText(20),
  address_complement: optionalText(80),
  address_district: optionalText(80),
  address_city: optionalText(80),
  address_state: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || (BRAZIL_STATES as readonly string[]).includes(v), "UF inválida.")
    .transform((v) => (v === "" ? null : v)),
  accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida."),
});

export type EstablishmentFormInput = z.input<typeof establishmentFormSchema>;
export type EstablishmentFormData = z.output<typeof establishmentFormSchema>;

/** Converte os dados validados no payload esperado pelas RPCs. */
export function toEstablishmentPayload(data: EstablishmentFormData) {
  const { phone, whatsapp, ...rest } = data;
  return { ...rest, phone_e164: phone, whatsapp_e164: whatsapp };
}

export const statusChangeSchema = z.object({
  establishmentId: z.uuid(),
  status: z.enum(["active", "suspended", "deactivated"]),
  reason: z.string().trim().max(500).optional(),
});

export const establishmentIdSchema = z.uuid();
