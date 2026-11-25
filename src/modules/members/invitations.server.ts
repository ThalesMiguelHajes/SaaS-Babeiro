import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { invitationTokenSchema, type InvitationPreview } from "./schemas";

/**
 * Leitura privilegiada do convite pelo token (a RPC só é executável pela service_role).
 * Usada pela página pública /convite/[token] e pelo aceite com criação de conta.
 */
export async function getInvitationPreview(token: string): Promise<InvitationPreview> {
  if (!invitationTokenSchema.safeParse(token).success) return { status: "invalid" };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_invitation_by_token", { p_token: token });
  if (error || !data) return { status: "invalid" };
  return data as InvitationPreview;
}
