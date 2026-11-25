-- Isolamento entre estabelecimentos e proteção contra escalonamento de privilégios.
-- Cenários obrigatórios A1 (admin da Barbearia A não acessa B) e A2/A3 (sem auto-promoção).
begin;
select plan(30);

set client_min_messages = warning;
-- Isola o teste dos dados do seed (tudo é desfeito no rollback final).
truncate public.establishments, public.platform_admins, public.audit_logs cascade;
delete from auth.users;

-- Auxiliares ------------------------------------------------------------------
create function pg_temp.new_user(p_email text) returns uuid language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (gen_random_uuid(), p_email, jsonb_build_object('full_name', initcap(split_part(p_email, '@', 1))))
  returning id
$$;
create function pg_temp.login_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end
$$;

-- Dados (como postgres, contexto privilegiado) ---------------------------------
select pg_temp.new_user('super@teste.dev')  as super \gset
select pg_temp.new_user('donoa@teste.dev')  as owner_a \gset
select pg_temp.new_user('admina@teste.dev') as admin_a \gset
select pg_temp.new_user('staffa@teste.dev') as staff_a \gset
select pg_temp.new_user('donob@teste.dev')  as owner_b \gset
select pg_temp.new_user('fora@teste.dev')   as outsider \gset
insert into public.platform_admins (user_id) values (:'super');

insert into public.establishments (slug, name) values ('barbearia-a', 'Barbearia A') returning id as est_a \gset
insert into public.establishments (slug, name) values ('barbearia-b', 'Barbearia B') returning id as est_b \gset

insert into public.establishment_members (establishment_id, user_id, role) values
  (:'est_a', :'owner_a', 'owner'),
  (:'est_a', :'admin_a', 'admin'),
  (:'est_a', :'staff_a', 'staff'),
  (:'est_b', :'owner_b', 'owner');

insert into public.establishment_invitations (establishment_id, email, role, token_hash)
values (:'est_b', 'novo@teste.dev', 'staff', extensions.digest('token-b', 'sha256'));

select private.write_audit('establishment.updated', :'est_a'::uuid);
select private.write_audit('establishment.updated', :'est_b'::uuid);

-- Estrutura -------------------------------------------------------------------
select is((select count(*) from public.establishment_settings), 2::bigint, 'settings são criadas automaticamente');

select throws_ok(
  $$insert into public.establishments (slug, name) values ('admin', 'Teste')$$,
  'P0001', 'SLUG_RESERVED', 'slug reservado é rejeitado'
);
select throws_ok(
  $$insert into public.establishments (slug, name, timezone) values ('fuso-ruim', 'Teste', 'Marte/Olimpo')$$,
  'P0001', 'INVALID_TIMEZONE', 'fuso inválido é rejeitado'
);
select throws_ok(
  $$insert into public.establishments (slug, name) values ('Com Espaco', 'Teste')$$,
  '23514', null, 'slug com formato inválido é rejeitado'
);
select throws_ok(
  format($$insert into public.establishment_members (establishment_id, user_id, role) values (%L, %L, 'owner')$$, :'est_a', :'outsider'),
  '23505', null, 'apenas um owner ativo por estabelecimento'
);
select throws_ok(
  format($$update public.establishment_members set establishment_id = %L where user_id = %L$$, :'est_b', :'staff_a'),
  'P0001', 'TENANT_IMMUTABLE', 'establishment_id do vínculo é imutável'
);
select throws_ok(
  $$update public.audit_logs set action = 'x.y'$$,
  'P0001', 'APPEND_ONLY', 'audit_logs é append-only'
);

-- Owner da Barbearia A ----------------------------------------------------------
select pg_temp.login_as(:'owner_a');

select results_eq('select id from public.establishments', format('values (%L::uuid)', :'est_a'),
  'owner A vê somente o próprio estabelecimento');
select results_eq('select establishment_id from public.establishment_settings', format('values (%L::uuid)', :'est_a'),
  'owner A vê somente as próprias configurações');
select is((select count(*) from public.establishment_members), 3::bigint, 'owner A vê somente a equipe de A');
select is_empty('select id from public.establishment_invitations', 'owner A não vê convites de B');
select is((select count(*) from public.audit_logs), 1::bigint, 'owner A vê somente a auditoria de A');
select is((select count(*) from public.profiles), 3::bigint, 'owner A vê profiles apenas da própria equipe');

update public.establishments set description = 'Invadido' where id = :'est_b';
update public.establishment_settings set slot_interval_minutes = 5 where establishment_id = :'est_b';
update public.establishments set description = 'Cortes clássicos' where id = :'est_a';

select throws_ok(
  format($$update public.establishments set slug = 'nova-a' where id = %L$$, :'est_a'),
  'P0001', 'FORBIDDEN_COLUMN', 'owner não altera o slug'
);
select throws_ok(
  format($$update public.establishments set status = 'suspended' where id = %L$$, :'est_a'),
  'P0001', 'FORBIDDEN_COLUMN', 'owner não altera o status'
);
select throws_ok(
  format($$update public.establishment_members set role = 'admin' where user_id = %L$$, :'staff_a'),
  '42501', null, 'owner não altera papéis diretamente (somente via RPC)'
);
select throws_ok(
  format($$select token_hash from public.establishment_invitations where establishment_id = %L$$, :'est_a'),
  '42501', null, 'token_hash dos convites nunca é legível pela API'
);
reset role;

select is((select description from public.establishments where id = :'est_b'), null, 'owner A não altera dados de B');
select is((select slot_interval_minutes from public.establishment_settings where establishment_id = :'est_b'), 15::smallint,
  'owner A não altera configurações de B');
select is((select description from public.establishments where id = :'est_a'), 'Cortes clássicos', 'owner A altera o perfil público de A');

-- Staff da Barbearia A ----------------------------------------------------------
select pg_temp.login_as(:'staff_a');
select results_eq('select id from public.establishments', format('values (%L::uuid)', :'est_a'), 'staff A vê o próprio estabelecimento');
select is_empty('select id from public.establishment_invitations', 'staff não vê convites');
update public.establishments set description = 'Staff mudou' where id = :'est_a';
select throws_ok(
  format($$insert into public.establishment_members (establishment_id, user_id, role) values (%L, %L, 'admin')$$, :'est_a', :'staff_a'),
  '42501', null, 'staff não se atribui papel administrativo'
);
reset role;
select is((select description from public.establishments where id = :'est_a'), 'Cortes clássicos', 'staff não altera o perfil do estabelecimento');

-- Usuário sem vínculo e anon --------------------------------------------------------
select pg_temp.login_as(:'outsider');
select is_empty('select * from public.establishments', 'usuário sem vínculo não vê estabelecimentos');
select is_empty('select * from public.establishment_members', 'usuário sem vínculo não vê equipes');
reset role;

set local role anon;
select throws_ok('select * from public.establishments', '42501', null, 'anon não acessa establishments');
reset role;

-- Super Admin -----------------------------------------------------------------
select pg_temp.login_as(:'super');
select is((select count(*) from public.establishments), 2::bigint, 'Super Admin vê todos os estabelecimentos');
update public.establishments set slug = 'barbearia-a-centro' where id = :'est_a';
reset role;
select is((select slug::text from public.establishments where id = :'est_a'), 'barbearia-a-centro', 'Super Admin altera o slug');

-- Estabelecimento desativado ----------------------------------------------------
update public.establishments set status = 'deactivated' where id = :'est_a';
select pg_temp.login_as(:'owner_a');
select is_empty('select * from public.establishments', 'membros perdem acesso a estabelecimento desativado');
reset role;

select * from finish();
rollback;
