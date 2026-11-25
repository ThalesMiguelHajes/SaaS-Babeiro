import { z } from "zod";

import { parseBrlToCents } from "@/lib/money";

const minutes = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `Informe ${label}.` })
    .int(`${label[0]!.toUpperCase()}${label.slice(1)} deve ser um número inteiro de minutos.`)
    .min(min, `Mínimo de ${min} minutos.`)
    .max(max, `Máximo de ${max} minutos.`);

export const serviceFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do serviço.").max(80),
  description: z
    .string()
    .trim()
    .max(500, "Máximo de 500 caracteres.")
    .transform((v) => (v === "" ? null : v)),
  categoryId: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid().nullable()),
  price: z.string().transform((value, ctx) => {
    const cents = parseBrlToCents(value);
    if (cents === null || cents > 10_000_000) {
      ctx.addIssue({ code: "custom", message: "Preço inválido. Ex.: 40,00" });
      return z.NEVER;
    }
    return cents;
  }),
  durationMinutes: minutes("a duração", 5, 720),
  bufferBeforeMinutes: minutes("o intervalo antes", 0, 120),
  bufferAfterMinutes: minutes("o intervalo depois", 0, 120),
  isPublic: z.boolean(),
  isActive: z.boolean(),
  professionalIds: z.array(z.uuid()).max(100),
});

export type ServiceFormInput = z.input<typeof serviceFormSchema>;
export type ServiceFormData = z.output<typeof serviceFormSchema>;

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome.")
  .max(60, "Máximo de 60 caracteres.");
