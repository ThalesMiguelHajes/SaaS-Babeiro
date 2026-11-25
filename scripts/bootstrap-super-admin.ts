/**
 * Cria (ou confirma) um Super Administrador — SECURITY.md §5.
 *
 *   pnpm bootstrap:super-admin voce@exemplo.com
 *
 * Requisitos: o usuário já existe no Supabase Auth (criado pelo Studio/Dashboard) e as variáveis
 * NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY apontam para o ambiente alvo (.env.local).
 * Idempotente: executar de novo não duplica nada.
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!email || !email.includes("@")) throw new Error("Uso: pnpm bootstrap:super-admin <email>");
  if (!url || !secret)
    throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY (.env.local).");

  const supabase = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId: string | undefined;
  for (let page = 1; !userId; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (data.users.length < 200) break;
  }
  if (!userId) {
    throw new Error(
      `Usuário ${email} não encontrado no Auth. Crie-o primeiro (Authentication → Users).`,
    );
  }

  const { data: existing, error: readError } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) {
    console.log(`✓ ${email} já é Super Administrador.`);
    return;
  }

  const { error: insertError } = await supabase.from("platform_admins").insert({ user_id: userId });
  if (insertError) throw insertError;

  const { error: auditError } = await supabase.from("audit_logs").insert({
    action: "platform.super_admin_created",
    actor_type: "system",
    entity_type: "profile",
    entity_id: userId,
    metadata: { via: "bootstrap-script" },
  });
  if (auditError) throw auditError;

  console.log(`✓ ${email} agora é Super Administrador.`);
}

main().catch((error: unknown) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
