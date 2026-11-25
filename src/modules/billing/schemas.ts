import { z } from "zod";

import { parseBrlToCents } from "@/lib/money";
import { toE164 } from "@/lib/phone";

const money = z
  .string()
  .trim()
  .refine((v) => parseBrlToCents(v) !== null, "Valor inválido. Ex.: 99,90")
  .transform((v) => parseBrlToCents(v)!);

const optionalMoney = z
  .string()
  .trim()
  .refine((v) => v === "" || parseBrlToCents(v) !== null, "Valor inválido. Ex.: 99,90")
  .transform((v) => (v === "" ? null : parseBrlToCents(v)!));

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

export const assignSchema = z
  .object({
    planVersionId: z.uuid("Escolha o plano."),
    anchorDate: isoDate,
    useOffer: z.boolean(),
    setupMode: z.enum(["first_invoice", "waive", "separate"]),
    setupFee: optionalMoney,
    priceOverride: optionalMoney,
    overrideReason: z.string().trim().max(300),
    extraProfessionals: z.coerce.number().int().min(0).max(500),
    notes: z.string().trim().max(2000),
  })
  .refine((d) => d.priceOverride === null || d.overrideReason.length >= 3, {
    message: "Informe o motivo do preço negociado.",
    path: ["overrideReason"],
  });
export type AssignInput = z.input<typeof assignSchema>;

export const changePlanSchema = z.object({
  planVersionId: z.uuid(),
  extraProfessionals: z.coerce.number().int().min(0).max(500),
  reason: z.string().trim().max(300),
});
export type ChangePlanInput = z.input<typeof changePlanSchema>;

export const recordPaymentSchema = z.object({
  amount: money.refine((c) => c > 0, "O valor precisa ser maior que zero."),
  method: z.enum(["pix", "credit_card", "bank_transfer", "cash", "boleto", "other"]),
  receivedOn: isoDate,
  reference: z.string().trim().max(120),
});
export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;

export const addChargeSchema = z.object({
  addOnId: z.uuid().nullable(),
  description: z.string().trim().min(2, "Descreva a cobrança.").max(200),
  quantity: z.coerce.number().int().min(1).max(1000),
  unitPrice: money,
  standalone: z.boolean(),
});
export type AddChargeInput = z.input<typeof addChargeSchema>;

export const discountSchema = z
  .object({
    name: z.string().trim().min(2, "Dê um nome ao desconto.").max(120),
    kind: z.enum(["percent", "fixed", "free"]),
    percent: z.coerce.number().min(0).max(100),
    amount: optionalMoney,
    duration: z.enum(["once", "repeating", "forever"]),
    cycles: z.coerce.number().int().min(1).max(120).nullable(),
    reason: z.string().trim().min(3, "Informe o motivo.").max(300),
  })
  .refine((d) => d.kind !== "percent" || (d.percent > 0 && d.percent <= 100), {
    message: "Percentual entre 1 e 100.",
    path: ["percent"],
  })
  .refine((d) => d.kind !== "fixed" || (d.amount ?? 0) > 0, {
    message: "Informe o valor.",
    path: ["amount"],
  })
  .refine((d) => d.duration !== "repeating" || d.cycles !== null, {
    message: "Informe por quantos ciclos.",
    path: ["cycles"],
  })
  .transform((d) => ({
    ...d,
    value:
      d.kind === "percent" ? Math.round(d.percent * 100) : d.kind === "fixed" ? (d.amount ?? 0) : 0,
    cycles: d.duration === "repeating" ? d.cycles : null,
  }));
export type DiscountInput = z.input<typeof discountSchema>;

export const planVersionSchema = z.object({
  monthlyPrice: money,
  annualPrice: optionalMoney,
  includedProfessionals: z.coerce.number().int().min(1).max(1000),
  extraPrice: optionalMoney,
});
export type PlanVersionInput = z.input<typeof planVersionSchema>;

export const billingSettingsSchema = z.object({
  pixKeyType: z.enum(["", "cpf", "cnpj", "email", "phone", "random"]),
  pixKey: z.string().trim().max(140),
  pixReceiverName: z.string().trim().max(120),
  instructions: z.string().trim().max(1000),
  supportWhatsapp: z
    .string()
    .trim()
    .refine((v) => v === "" || toE164(v) !== null, "WhatsApp inválido.")
    .transform((v) => (v === "" ? null : toE164(v))),
  setupFee: money,
});
export type BillingSettingsInput = z.input<typeof billingSettingsSchema>;
