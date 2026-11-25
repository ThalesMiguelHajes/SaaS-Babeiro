import { z } from "zod";

/** "Degradê, Barba" → ["Degradê", "Barba"] (máx. 10, até 40 caracteres cada). */
export const specialtiesSchema = z
  .string()
  .transform((v) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(z.string().max(40, "Cada especialidade pode ter até 40 caracteres."))
      .max(10, "No máximo 10 especialidades."),
  );

export const professionalFormSchema = z.object({
  displayName: z.string().trim().min(1, "Informe o nome.").max(80),
  bio: z
    .string()
    .trim()
    .max(500, "Máximo de 500 caracteres.")
    .transform((v) => (v === "" ? null : v)),
  specialties: specialtiesSchema,
  isBookable: z.boolean(),
  isActive: z.boolean(),
  serviceIds: z.array(z.uuid()).max(200),
});
export type ProfessionalFormInput = z.input<typeof professionalFormSchema>;
export type ProfessionalFormData = z.output<typeof professionalFormSchema>;

export const myProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Informe o nome.").max(80),
  bio: z.string().trim().max(500, "Máximo de 500 caracteres."),
  specialties: specialtiesSchema,
});
export type MyProfileInput = z.input<typeof myProfileSchema>;
export type MyProfileData = z.output<typeof myProfileSchema>;
