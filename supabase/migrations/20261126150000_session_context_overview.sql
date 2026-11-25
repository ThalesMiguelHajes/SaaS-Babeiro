-- =============================================================================
-- 08 · Desempenho: contexto da sessão e visão geral em uma única chamada
--
-- Antes: cada página autenticada fazia 3 consultas em sequência (perfil → Super Admin →
-- vínculos) e o painel do Super Admin mais 5 contagens. Agora: 1 chamada para o contexto
-- e 1 para as contagens. As regras de acesso continuam as mesmas (RLS / assert).
-- =============================================================================

-- Contexto do usuário logado: nome, papel na plataforma e vínculos ativos.
-- SECURITY INVOKER: tudo passa pelo RLS do próprio usuário.
create or replace function public.get_session_context()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case when (select auth.uid()) is null then null else
    jsonb_build_object(
      'user_id', (select auth.uid()),
      'full_name', (select p.full_name from public.profiles p where p.id = (select auth.uid())),
      'email', (select p.email from public.profiles p where p.id = (select auth.uid())),
      'platform_role', (
        select pa.platform_role from public.platform_admins pa where pa.user_id = (select auth.uid())
      ),
      'memberships', coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'establishment_id', e.id,
                   'slug', e.slug,
                   'name', e.name,
                   'status', e.status,
                   'role', m.role,
                   'accent_color', e.accent_color,
                   'timezone', e.timezone
                 )
                 order by m.created_at
               )
        from public.establishment_members m
        join public.establishments e on e.id = m.establishment_id
        where m.user_id = (select auth.uid())
          and m.is_active
          and e.status <> 'deactivated'
      ), '[]'::jsonb)
    )
  end;
$$;

-- Contagens do painel do Super Admin em uma consulta.
create or replace function public.platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.assert_platform_admin();

  select jsonb_build_object(
    'total', count(*),
    'active', count(*) filter (where status = 'active'),
    'suspended', count(*) filter (where status = 'suspended'),
    'deactivated', count(*) filter (where status = 'deactivated'),
    'new_last_30', count(*) filter (where created_at >= now() - interval '30 days')
  )
  into v_result
  from public.establishments;

  return v_result;
end;
$$;

revoke execute on function public.get_session_context() from public, anon;
revoke execute on function public.platform_overview() from public, anon;
grant execute on function public.get_session_context() to authenticated;
grant execute on function public.platform_overview() to authenticated;
