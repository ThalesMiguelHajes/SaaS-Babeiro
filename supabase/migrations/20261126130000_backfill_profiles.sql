-- =============================================================================
-- 06 · Perfis para usuários criados antes do trigger on_auth_user_created
-- Caso real: conta criada no painel do Supabase antes de as migrations serem aplicadas.
-- Sem o profile, a pessoa aparece como "Usuário" e não pode virar Super Admin
-- (platform_admins.user_id referencia profiles). Idempotente.
-- =============================================================================

insert into public.profiles (id, full_name, email)
select
  u.id,
  left(
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'Usuário'
    ),
    120
  ),
  u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
