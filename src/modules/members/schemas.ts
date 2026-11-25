import { z } from "zod";

import { passwordSchema } from "@/modules/auth/schemas";

export const createInvitationSchema = z.object({
  establishmentId: z.uuid(),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Informe um e-mail válido.")),
  role: z.enum(["owner", "admin", "staff"]),
});
export type CreateInvitationInput = z.input<typeof createInvitationSchema>;

export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const acceptWithNewAccountSchema = z
  .object({
    token: invitationTokenSchema,
    fullName: z.string().trim().min(2, "Informe seu nome.").max(120),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });
export type AcceptWithNewAccountInput = z.input<typeof acceptWithNewAccountSchema>;

export type InvitationPreview =
  | { status: "invalid" }
  | {
      status: "pending" | "accepted" | "revoked" | "expired";
      email: string;
      role: "owner" | "admin" | "staff";
      establishment_name: string;
      has_account: boolean;
    };
