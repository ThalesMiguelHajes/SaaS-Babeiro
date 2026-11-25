-- Identidade, Super Admin e configurações globais.
begin;
select plan(16);

set client_min_messages = warning;
-- Isola o teste dos dados do seed (tudo é desfeito no rollback final).
truncate public.establishments, public.platform_admins, public.audit_logs cascade;
delete from auth.users;

-- Auxiliares (sessão de teste) ------------------------------------------------
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

-- Dados -----------------------------------------------------------------------
select pg_temp.new_user('ana@teste.dev') as ana \gset
select pg_temp.new_user('bruno@teste.dev') as bruno \gset
select pg_temp.new_user('super@teste.dev') as super \gset
select pg_temp.new_user('financeiro@teste.dev') as fin \gset
insert into public.platform_admins (user_id) values (:'super');
insert into public.platform_admins (user_id, platform_role) values (:'fin', 'billing_manager');

-- Profiles --------------------------------------------------------------------
select is(
  (select full_name from public.profiles where id = :'ana'),
  'Ana',
  'profile é criado automaticamente a partir do auth.users'
);

select pg_temp.login_as(:'ana');

select results_eq(
  'select id from public.profiles',
  format('values (%L::uuid)', :'ana'),
  'usuário sem vínculos vê apenas o próprio profile'
);

update public.profiles set full_name = 'Ana Souza' where id = :'ana';
update public.profiles set full_name = 'Invasor' where id = :'bruno';

select throws_ok(
  format('update public.profiles set id = gen_random_uuid() where id = %L', :'ana'),
  '42501', null,
  'usuário não altera colunas fora da lista permitida'
);

select throws_ok(
  format('insert into public.platform_admins (user_id) values (%L)', :'ana'),
  '42501', null,
  'usuário não consegue se tornar Super Admin'
);

select is_empty('select * from public.platform_admins', 'usuário comum não vê registros de Super Admin');
select ok(not private.is_platform_admin(), 'is_platform_admin() é falso para usuário comum');
select is_empty('select * from public.platform_settings', 'usuário comum não lê configurações globais');

reset role;
select is((select full_name from public.profiles where id = :'ana'), 'Ana Souza', 'usuário atualiza o próprio nome');
select is((select full_name from public.profiles where id = :'bruno'), 'Bruno', 'usuário não altera o profile de outra pessoa');

-- Super Admin -----------------------------------------------------------------
select pg_temp.login_as(:'super');
select ok(private.is_platform_admin(), 'is_platform_admin() é verdadeiro para Super Admin');
select is((select count(*) from public.platform_admins), 2::bigint, 'Super Admin vê todos os administradores da plataforma');
select isnt_empty($$select 1 from public.platform_settings where key = 'reserved_slugs'$$, 'Super Admin lê configurações globais');
reset role;

-- billing_manager -------------------------------------------------------------
select pg_temp.login_as(:'fin');
select ok(not private.is_platform_admin(), 'billing_manager não é Super Admin');
select ok(private.has_platform_permission('billing.manage'), 'billing_manager tem billing.manage');
select ok(not private.has_platform_permission('platform.manage'), 'billing_manager não tem outras permissões de plataforma');
reset role;

-- anon ------------------------------------------------------------------------
set local role anon;
select throws_ok('select * from public.profiles', '42501', null, 'anon não acessa profiles');
reset role;

select * from finish();
rollback;
