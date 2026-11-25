import { z } from "zod";

import { parseBrlToCents } from "@/lib/money";
import { toE164 } from "@/lib/phone";

import { PAYMENT_METHODS } from "./rules";

const money = (message: string) =>
  z
    .string()
    .trim()
    .refine((v) => parseBrlToCents(v) !== null, message)
    .transform((v) => parseBrlToCents(v)!);

const methods = PAYMENT_METHODS.map((m) => m.value) as [string, ...string[]];

export const newAppointmentSchema = z
  .object({
    serviceId: z.uuid("Escolha o serviço."),
    professionalId: z.uuid().nullable(),
    startsAt: z.iso.datetime({ offset: true, message: "Escolha o horário." }),
    outsideWorkingHours: z.boolean(),
    customerId: z.uuid().nullable(),
    customerName: z.string().trim().max(120),
    customerPhone: z
      .string()
      .trim()
      .refine((v) => v === "" || toE164(v) !== null, "WhatsApp inválido."),
    notes: z.string().trim().max(1000, "No máximo 1000 caracteres."),
  })
  .refine((d) => d.customerId || d.customerName.length >= 2, {
    message: "Informe o nome do cliente.",
    path: ["customerName"],
  });
export type NewAppointmentInput = z.input<typeof newAppointmentSchema>;

export const paymentLineSchema = z.object({
  amount: money("Valor inválido. Ex.: 40,00").refine(
    (c) => c > 0,
    "O valor precisa ser maior que zero.",
  ),
  method: z.enum(methods),
  notes: z.string().trim().max(300),
});

export const completeSchema = z.object({
  finalPrice: money("Valor inválido. Ex.: 40,00"),
  payments: z.array(paymentLineSchema).max(5),
});
export type CompleteInput = z.input<typeof completeSchema>;
export type CompleteData = z.output<typeof completeSchema>;

export const recordPaymentSchema = paymentLineSchema;
export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;

export const listFiltersSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  professionalId: z.uuid().nullable(),
  status: z
    .enum(["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"])
    .nullable(),
});
export type ListFilters = z.output<typeof listFiltersSchema>;
