begin;
select plan(13);

insert into auth.users (email) values ('criador@teste.dev') returning id as super_id \gset
insert into auth.users (email) values ('financeiro@teste.dev') returning id as billing_id \gset
insert into public.platform_admins (user_id, platform_role)
values (:'super_id', 'super_admin'), (:'billing_id', 'billing_manager');

set local role anon;
select throws_ok($$select public.create_establishment('{}')$$, '42501', null, 'anon não executa o cadastro');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'billing_id')::text, true);
select throws_ok($$select public.create_establishment('{}')$$, 'P0001', 'FORBIDDEN',
  'a permissão financeira não concede poderes de Super Admin');
select set_config('request.jwt.claims', json_build_object('sub', :'super_id')::text, true);

select public.create_establishment('{"name":"Salão Centro","slug":"salao-centro","business_type":"beauty_salon","address_city":"Recife","owner_email":"proprietario@teste.dev"}') as est_id \gset
select results_eq(
  format('select slug::text, business_type::text, address_city, status::text, timezone, created_by from public.establishments where id = %L', :'est_id'),
  format($$values ('salao-centro'::text, 'beauty_salon'::text, 'Recife'::text, 'active'::text, 'America/Sao_Paulo'::text, %L::uuid)$$, :'super_id'),
  'cria no tenant correto, com os dados fornecidos, os padrões e o ator da sessão');
select is((select slot_interval_minutes from public.establishment_settings where establishment_id = :'est_id'), 15::smallint,
  'o cadastro inicializa uma configuração padrão');
select results_eq(
  format('select action, actor_type::text, actor_user_id, entity_id from public.audit_logs where establishment_id = %L', :'est_id'),
  format($$values ('establishment.created'::text, 'platform_admin'::text, %L::uuid, %L::uuid)$$, :'super_id', :'est_id'),
  'registra exatamente uma ação de criação com ator e entidade');
select throws_ok($$select public.create_establishment('{"name":"Teste","slug":"salao-centro"}')$$,
  '23505', null, 'slug duplicado é recusado');
select throws_ok($$select public.create_establishment('{"name":"Teste","slug":"admin"}')$$,
  'P0001', 'SLUG_RESERVED', 'slug reservado é recusado');
select throws_ok($$select public.create_establishment('{"name":"Teste","slug":"Com Espaço"}')$$,
  '23514', null, 'slug fora do formato é recusado');
select throws_ok($$select public.create_establishment('{"name":"Teste","slug":"fuso","timezone":"Marte/Olimpo"}')$$,
  'P0001', 'INVALID_TIMEZONE', 'fuso inexistente é recusado');
select throws_ok($$select public.create_establishment('{"name":"Teste","slug":"telefone","phone_e164":"123"}')$$,
  '23514', null, 'telefone fora de E.164 é recusado');
select throws_ok($$select public.create_establishment('{"name":"Teste","slug":"status","status":"suspended"}')$$,
  '22023', 'INVALID_PAYLOAD', 'campos gerenciados pelo banco não podem ser fornecidos');
select throws_ok($$select public.create_establishment('{"name":"Teste","slug":"email","owner_email":"invalido"}')$$,
  '22023', 'INVALID_OWNER_EMAIL', 'e-mail do responsável inválido é recusado');
select is((select count(*) from public.audit_logs where action = 'establishment.created'), 1::bigint,
  'cadastros recusados não geram registros de criação');

select * from finish();
rollback;
