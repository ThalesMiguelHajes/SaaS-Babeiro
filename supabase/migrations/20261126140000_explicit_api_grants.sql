-- =============================================================================
-- 07 · Permissões explícitas para os papéis da API
--
-- Projetos Supabase novos podem ser criados SEM os privilégios padrão que davam acesso
-- automático a toda tabela nova de public para anon/authenticated/service_role
-- ("Automatically expose new tables" desligado). As migrations anteriores dependiam desses
-- padrões para o SELECT — no projeto hospedado, o usuário logado não conseguia ler o próprio
-- perfil nem ser reconhecido como Super Admin.
--
-- A partir daqui, toda tabela recebe grants explícitos na própria migration (CLAUDE.md §5).
-- O RLS continua sendo a barreira por linha; os grants definem o que cada papel pode tentar.
-- Idempotente: pode ser aplicada em bancos que já tinham os privilégios padrão.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- Servidor (chave secreta): acesso completo às tabelas, como no padrão do Supabase.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Usuários autenticados (sempre filtrados por RLS) --------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, phone_e164, avatar_path) on public.profiles to authenticated;

grant select on public.platform_admins to authenticated;

grant select, insert, update on public.platform_settings to authenticated;

grant select on public.audit_logs to authenticated;

grant select, update on public.establishments to authenticated;

grant select on public.establishment_settings to authenticated;
grant update (slot_interval_minutes, min_booking_notice_minutes, max_booking_days_ahead,
              booking_requires_confirmation, allow_customer_cancellation, allow_customer_reschedule,
              customer_change_notice_minutes, max_active_bookings_per_customer,
              staff_can_manage_own_blocks, staff_can_manage_own_hours, staff_can_record_payments,
              public_booking_enabled, booking_policy_text)
  on public.establishment_settings to authenticated;

grant select on public.establishment_members to authenticated;

-- token_hash nunca é legível pela API.
grant select (id, establishment_id, email, role, expires_at, accepted_at, accepted_by,
              revoked_at, invited_by, created_at)
  on public.establishment_invitations to authenticated;

-- anon não acessa nenhuma tabela diretamente (rotas públicas usam RPCs pelo servidor).
