import { z } from "zod";

import { toE164 } from "@/lib/phone";
import { Constants } from "@/types/database";

const shortText = (max: number) => z.string().trim().max(max, `Use até ${max} caracteres.`);

const optionalPhone = shortText(40).transform((value, ctx) => {
  if (!value) return "";
  const normalized = toE164(value);
  if (normalized) return normalized;
  ctx.addIssue({ code: "custom", message: "Informe um telefone válido com DDD." });
  return z.NEVER;
});

export const createEstablishmentSchema = z.object({
  name: shortText(120).min(2, "Informe um nome com pelo menos 2 caracteres."),
  slug: shortText(60)
    .min(3, "Use pelo menos 3 caracteres.")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens entre palavras."),
  business_type: z.enum(Constants.public.Enums.business_type),
  timezone: shortText(100).refine((value) => {
    try {
      return Boolean(value && new Intl.DateTimeFormat("pt-BR", { timeZone: value }));
    } catch {
      return false;
    }
  }, "Informe um fuso válido, como America/Sao_Paulo."),
  description: shortText(1000),
  owner_name: shortText(120),
  owner_email: shortText(254).pipe(z.email("Informe um e-mail válido.").or(z.literal(""))),
  phone_e164: optionalPhone,
  whatsapp_e164: optionalPhone,
  instagram_handle: shortText(31)
    .transform((value) => value.replace(/^@/, ""))
    .pipe(z.string().regex(/^[A-Za-z0-9._]{0,30}$/, "Informe um usuário válido do Instagram.")),
  address_street: shortText(160),
  address_number: shortText(20),
  address_complement: shortText(80),
  address_district: shortText(80),
  address_city: shortText(80),
  address_state: shortText(2)
    .toUpperCase()
    .regex(/^([A-Z]{2})?$/, "Use a sigla da UF."),
  address_postal_code: shortText(9)
    .regex(/^(\d{5}-?\d{3})?$/, "Informe um CEP com 8 dígitos.")
    .transform((value) => value.replace("-", "")),
});

export type EstablishmentInput = z.input<typeof createEstablishmentSchema>;
