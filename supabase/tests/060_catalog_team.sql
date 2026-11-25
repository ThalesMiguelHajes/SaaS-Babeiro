-- Catálogo (profissionais, serviços, habilitações) e gestão da equipe.
begin;
select plan(30);

set client_min_messages = warning;
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

select pg_temp.new_user('dono@a.dev')   as owner_a \gset
select pg_temp.new_user('admin@a.dev')  as admin_a \gset
select pg_temp.new_user('admin2@a.dev') as admin2_a \gset
select pg_temp.new_user('staff@a.dev')  as staff_a \gset
select pg_temp.new_user('dono@b.dev')   as owner_b \gset
select pg_temp.new_user('fora@x.dev')   as outsider \gset

insert into public.establishments (slug, name) values ('loja-a', 'Loja A') returning id as est_a \gset
insert into public.establishments (slug, name) values ('loja-b', 'Loja B') returning id as est_b \gset
insert into public.establishment_members (establishment_id, user_id, role) values
  (:'est_a', :'owner_a', 'owner'), (:'est_a', :'admin_a', 'admin'), (:'est_a', :'admin2_a', 'admin'),
  (:'est_a', :'staff_a', 'staff'), (:'est_b', :'owner_b', 'owner');
select id as staff_member from public.establishment_members where user_id = :'staff_a' \gset
select id as admin2_member from public.establishment_members where user_id = :'admin2_a' \gset
select id as owner_member from public.establishment_members where user_id = :'owner_a' \gset

insert into public.service_categories (establishment_id, name) values (:'est_b', 'Cabelo B') returning id as cat_b \gset
insert into public.services (establishment_id, name, price_cents, duration_minutes)
values (:'est_b', 'Corte B', 4000, 30) returning id as svc_b \gset

-- Cadastro pelo admin ---------------------------------------------------------------
select pg_temp.login_as(:'admin_a');
insert into public.professionals (establishment_id, display_name, specialties)
values (:'est_a', 'Bruno', array['Degradê', 'Barba']) returning id as prof_a \gset
insert into public.professionals (establishment_id, display_name) values (:'est_a', 'Carla') returning id as prof_a2 \gset
insert into public.service_categories (establishment_id, name) values (:'est_a', 'Cabelo') returning id as cat_a \gset
insert into public.services (establishment_id, category_id, name, price_cents, duration_minutes, buffer_after_minutes)
values (:'est_a', :'cat_a', 'Corte masculino', 4000, 30, 5) returning id as svc_a \gset
insert into public.professional_services (establishment_id, professional_id, service_id) values (:'est_a', :'prof_a', :'svc_a');

select is((select count(*) from public.professionals), 2::bigint, 'admin cadastra e vê os profissionais do próprio estabelecimento');
select throws_ok(
  format($$insert into public.professionals (establishment_id, display_name) values (%L, 'Invasor')$$, :'est_b'),
  '42501', null, 'admin de A não cadastra profissional em B'
);
select throws_ok(
  format($$insert into public.professionals (establishment_id, display_name, user_id) values (%L, 'X', %L)$$, :'est_a', :'staff_a'),
  'P0001', 'FORBIDDEN_COLUMN', 'vínculo com usuário não é definido direto na tabela'
);
select throws_ok(
  format($$update public.professionals set user_id = %L where id = %L$$, :'staff_a', :'prof_a'),
  '42501', null, 'user_id não é editável pela API'
);
select throws_ok(
  format($$insert into public.services (establishment_id, category_id, name, price_cents, duration_minutes) values (%L, %L, 'X', 100, 30)$$, :'est_a', :'cat_b'),
  '23503', null, 'serviço não usa categoria de outro estabelecimento'
);
select throws_ok(
  format($$insert into public.professional_services (establishment_id, professional_id, service_id) values (%L, %L, %L)$$, :'est_a', :'prof_a', :'svc_b'),
  '23503', null, 'profissional de A não é habilitado em serviço de B'
);
select throws_ok(
  format($$insert into public.services (establishment_id, name, price_cents, duration_minutes) values (%L, 'Grátis negativo', -1, 30)$$, :'est_a'),
  '23514', null, 'preço negativo é rejeitado'
);
select throws_ok(
  format($$delete from public.services where id = %L$$, :'svc_a'),
  '42501', null, 'serviços não são apagados (somente arquivados)'
);

update public.services set price_cents = 4500 where id = :'svc_a';
update public.professionals set is_active = false where id = :'prof_a2';
reset role;

select is(
  (select metadata ->> 'price_to' from public.audit_logs where action = 'service.price_changed' and entity_id = :'svc_a'),
  '4500', 'mudança de preço fica na auditoria'
);
select isnt((select deactivated_at from public.professionals where id = :'prof_a2'), null, 'desativar registra a data');

-- Outro estabelecimento e usuário sem vínculo ----------------------------------------
select pg_temp.login_as(:'owner_b');
select is_empty('select id from public.professionals where establishment_id = ''' || :'est_a' || '''', 'owner de B não vê profissionais de A');
select is_empty('select id from public.services where establishment_id = ''' || :'est_a' || '''', 'owner de B não vê serviços de A');
reset role;

select pg_temp.login_as(:'outsider');
select is_empty('select id from public.professionals', 'usuário sem vínculo não vê profissionais');
reset role;

-- Staff ------------------------------------------------------------------------------
select pg_temp.login_as(:'staff_a');
select is((select count(*) from public.services), 1::bigint, 'staff vê os serviços do estabelecimento');
select throws_ok(
  format($$insert into public.services (establishment_id, name, price_cents, duration_minutes) values (%L, 'X', 100, 30)$$, :'est_a'),
  '42501', null, 'staff não cadastra serviços'
);
update public.services set price_cents = 1 where id = :'svc_a';
select throws_ok(
  format($$select public.update_my_professional_profile(%L, 'Eu', 'bio', '{}')$$, :'est_a'),
  'P0001', 'FORBIDDEN', 'staff sem perfil profissional vinculado não edita perfil'
);
reset role;
select is((select price_cents from public.services where id = :'svc_a'), 4500, 'staff não altera preço');

-- Vínculo usuário ↔ profissional ---------------------------------------------------------
select pg_temp.login_as(:'admin_a');
select throws_ok(
  format($$select public.link_professional_user(%L, %L)$$, :'prof_a', :'outsider'),
  'P0001', 'NOT_A_MEMBER', 'só vincula quem é membro da equipe'
);
select lives_ok(
  format($$select public.link_professional_user(%L, %L)$$, :'prof_a', :'staff_a'),
  'admin vincula a conta do profissional'
);
reset role;

select pg_temp.login_as(:'staff_a');
select is(
  (select m ->> 'professional_id' from jsonb_array_elements(public.get_session_context() -> 'memberships') m),
  :'prof_a'::text, 'contexto da sessão traz o profissional vinculado'
);
select lives_ok(
  format($$select public.update_my_professional_profile(%L, 'Bruno Silva', 'Especialista em degradê', array['Degradê'])$$, :'est_a'),
  'profissional edita o próprio perfil'
);
select throws_ok(
  format($$select public.link_professional_user(%L, null)$$, :'prof_a'),
  'P0001', 'FORBIDDEN', 'staff não altera vínculos'
);
reset role;
select is((select display_name from public.professionals where id = :'prof_a'), 'Bruno Silva', 'perfil atualizado');

-- Papéis e desativação -----------------------------------------------------------------------
select pg_temp.login_as(:'admin_a');
select throws_ok(
  format($$select public.update_member_role(%L, 'staff')$$, :'admin2_member'),
  'P0001', 'FORBIDDEN', 'admin não altera outro admin'
);
select throws_ok(
  format($$select public.set_member_active(%L, false)$$, :'owner_member'),
  'P0001', 'FORBIDDEN', 'admin não desativa o responsável'
);
select throws_ok(
  format($$select public.update_member_role((select id from public.establishment_members where user_id = %L), 'staff')$$, :'admin_a'),
  'P0001', 'CANNOT_CHANGE_SELF', 'ninguém altera o próprio vínculo'
);
select lives_ok(
  format($$select public.set_member_active(%L, false)$$, :'staff_member'),
  'admin desativa um profissional da equipe'
);
reset role;
select is((select is_active from public.professionals where id = :'prof_a'), false,
  'perfil profissional de quem saiu da equipe é desativado');

select pg_temp.login_as(:'owner_a');
select lives_ok(
  format($$select public.update_member_role(%L, 'staff')$$, :'admin2_member'),
  'owner rebaixa um admin para profissional'
);
select throws_ok(
  format($$select public.update_member_role(%L, 'owner')$$, :'admin2_member'),
  'P0001', 'FORBIDDEN', 'ninguém vira owner por esta RPC'
);
reset role;

select * from finish();
rollback;
