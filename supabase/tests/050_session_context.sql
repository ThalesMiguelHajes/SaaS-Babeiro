-- Contexto da sessão e visão geral da plataforma.
begin;
select plan(9);

set client_min_messages = warning;
-- Isola o teste dos dados do seed (tudo é desfeito no rollback final).
truncate public.establishments, public.platform_admins, public.audit_logs cascade;
delete from auth.users;

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

select pg_temp.new_user('super@teste.dev') as super \gset
select pg_temp.new_user('multi@teste.dev') as multi \gset
insert into public.platform_admins (user_id) values (:'super');
insert into public.establishments (slug, name) values ('loja-a', 'Loja A') returning id as est_a \gset
insert into public.establishments (slug, name) values ('loja-b', 'Loja B') returning id as est_b \gset
insert into public.establishments (slug, name, status) values ('loja-c', 'Loja C', 'deactivated') returning id as est_c \gset
insert into public.establishment_members (establishment_id, user_id, role) values
  (:'est_a', :'multi', 'admin'), (:'est_b', :'multi', 'staff'), (:'est_c', :'multi', 'owner');

select pg_temp.login_as(:'multi');
select public.get_session_context() as ctx \gset
select is(:'ctx'::jsonb ->> 'full_name', 'Multi', 'contexto traz o nome do perfil');
select is(:'ctx'::jsonb ->> 'platform_role', null, 'usuário comum não tem papel na plataforma');
select is(jsonb_array_length(:'ctx'::jsonb -> 'memberships'), 2, 'vínculos ativos, sem estabelecimento desativado');
select is(
  (select array_agg(m ->> 'slug' order by m ->> 'slug') from jsonb_array_elements(:'ctx'::jsonb -> 'memberships') m),
  array['loja-a', 'loja-b'], 'vínculos corretos'
);
select throws_ok('select public.platform_overview()', 'P0001', 'FORBIDDEN', 'visão geral é exclusiva do Super Admin');
reset role;

select pg_temp.login_as(:'super');
select is(public.get_session_context() ->> 'platform_role', 'super_admin', 'Super Admin é identificado no contexto');
select is(public.platform_overview() ->> 'total', '3', 'total de estabelecimentos');
select is(public.platform_overview() ->> 'deactivated', '1', 'desativados contados');
reset role;

set local role anon;
select throws_ok('select public.get_session_context()', '42501', null, 'anon não executa get_session_context');
reset role;

select * from finish();
rollback;
