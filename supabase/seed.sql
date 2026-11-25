-- =============================================================================
-- Seed de DESENVOLVIMENTO (supabase db reset). Nunca executar em produção.
-- Senha de todos os usuários: Senha123  (apenas local)
--
--   super@local.dev    → Super Administrador
--   dono.a@local.dev   → owner da Barbearia A
--   admin.a@local.dev  → admin da Barbearia A
--   staff.a@local.dev  → profissional (staff) da Barbearia A
--   dono.b@local.dev   → owner da Barbearia B
--   multi@local.dev    → admin em A e staff em B (testa o seletor /inicio)
-- Os dados de catálogo, horários e agendamentos entram com as migrations das próximas fases.
-- =============================================================================

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-4000-a000-000000000001'::uuid, 'super@local.dev',   'Super Admin'),
      ('00000000-0000-4000-a000-000000000002'::uuid, 'dono.a@local.dev',  'Carlos Dono A'),
      ('00000000-0000-4000-a000-000000000003'::uuid, 'admin.a@local.dev', 'Ana Admin A'),
      ('00000000-0000-4000-a000-000000000004'::uuid, 'staff.a@local.dev', 'Bruno Barbeiro A'),
      ('00000000-0000-4000-a000-000000000005'::uuid, 'dono.b@local.dev',  'Diana Dona B'),
      ('00000000-0000-4000-a000-000000000006'::uuid, 'multi@local.dev',   'Marcos Multi')
    ) as t(id, email, full_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('Senha123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), u.id, u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;
end
$$;

insert into public.platform_admins (user_id) values ('00000000-0000-4000-a000-000000000001');

insert into public.establishments (id, slug, name, description, owner_name, owner_email, whatsapp_e164, address_city, address_state, accent_color)
values
  ('10000000-0000-4000-a000-00000000000a', 'barbearia-a', 'Barbearia A', 'Cortes clássicos e barba na régua.',
   'Carlos Dono A', 'dono.a@local.dev', '+5511912345678', 'São Paulo', 'SP', '#18181B'),
  ('10000000-0000-4000-a000-00000000000b', 'barbearia-b', 'Barbearia B', 'Barbearia de bairro desde 2010.',
   'Diana Dona B', 'dono.b@local.dev', '+5521998765432', 'Rio de Janeiro', 'RJ', '#B08D57');

insert into public.establishment_members (establishment_id, user_id, role) values
  ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-000000000002', 'owner'),
  ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-000000000003', 'admin'),
  ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-000000000004', 'staff'),
  ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-000000000006', 'admin'),
  ('10000000-0000-4000-a000-00000000000b', '00000000-0000-4000-a000-000000000005', 'owner'),
  ('10000000-0000-4000-a000-00000000000b', '00000000-0000-4000-a000-000000000006', 'staff');
