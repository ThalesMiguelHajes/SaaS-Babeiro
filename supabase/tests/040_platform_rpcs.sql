-- RPCs da plataforma: estabelecimentos, status, imagens e convites.
begin;
select plan(37);

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

select pg_temp.new_user('super@teste.dev')  as super \gset
select pg_temp.new_user('donoa@teste.dev')  as owner_a \gset
select pg_temp.new_user('staffa@teste.dev') as staff_a \gset
select pg_temp.new_user('donob@teste.dev')  as owner_b \gset
insert into public.platform_admins (user_id) values (:'super');

insert into public.establishments (slug, name) values ('barbearia-a', 'Barbearia A') returning id as est_a \gset
insert into public.establishments (slug, name) values ('barbearia-b', 'Barbearia B') returning id as est_b \gset
insert into public.establishment_members (establishment_id, user_id, role) values
  (:'est_a', :'owner_a', 'owner'), (:'est_a', :'staff_a', 'staff'), (:'est_b', :'owner_b', 'owner');

select is((select email::text from public.profiles where id = :'owner_a'), 'donoa@teste.dev', 'profile recebe o e-mail do Auth');

-- create_establishment ---------------------------------------------------------
select pg_temp.login_as(:'owner_a');
select throws_ok(
  $$select public.create_establishment('{"slug":"nova","name":"Nova"}')$$,
  'P0001', 'FORBIDDEN', 'somente o Super Admin cria estabelecimentos'
);
reset role;

select pg_temp.login_as(:'super');
select public.create_establishment(jsonb_build_object(
  'slug', 'Studio-Centro', 'name', 'Studio Centro', 'owner_name', 'Rita', 'owner_email', 'Rita@Teste.dev',
  'whatsapp_e164', '+5511988887777', 'address_state', 'sp'
)) as created \gset
reset role;

select is((:'created'::jsonb ->> 'slug'), 'studio-centro', 'slug é normalizado para minúsculas');
select is(char_length(:'created'::jsonb ->> 'invitation_token'), 43, 'convite do responsável é emitido com token de 256 bits');
select is(
  (select role::text from public.establishment_invitations
    where establishment_id = (:'created'::jsonb ->> 'id')::uuid and accepted_at is null and revoked_at is null),
  'owner', 'convite pendente para o responsável com papel owner'
);
select is(
  (select address_state from public.establishments where id = (:'created'::jsonb ->> 'id')::uuid), 'SP',
  'UF é normalizada'
);
select isnt_empty(
  format($$select 1 from public.establishment_settings where establishment_id = %L$$, :'created'::jsonb ->> 'id'),
  'configurações padrão criadas'
);
select is(
  (select array_agg(action order by id) from public.audit_logs where establishment_id = (:'created'::jsonb ->> 'id')::uuid),
  array['establishment.created', 'member.invited'], 'criação e convite são auditados'
);
select is(
  (select actor_type::text from public.audit_logs where action = 'establishment.created' limit 1),
  'platform_admin', 'ator da auditoria é o Super Admin'
);

select pg_temp.login_as(:'super');
select throws_ok($$select public.create_establishment('{"slug":"barbearia-a","name":"Outra"}')$$,
  'P0001', 'SLUG_TAKEN', 'slug duplicado é rejeitado com código de domínio');
select throws_ok($$select public.create_establishment('{"slug":"painel","name":"Outra"}')$$,
  'P0001', 'SLUG_RESERVED', 'slug reservado é rejeitado');
select lives_ok($$select public.create_establishment('{"slug":"sem-dono","name":"Sem Dono"}')$$,
  'estabelecimento sem e-mail do responsável não gera convite');

-- update_establishment / status ------------------------------------------------
select lives_ok(
  format($$select public.update_establishment(%L, '{"slug":"barbearia-a-centro","name":"Barbearia A Centro"}')$$, :'est_a'),
  'Super Admin altera dados cadastrais'
);
select throws_ok(
  format($$select public.set_establishment_status(%L, 'suspended')$$, :'est_a'),
  'P0001', 'REASON_REQUIRED', 'suspensão exige motivo'
);
select lives_ok(
  format($$select public.set_establishment_status(%L, 'suspended', 'Inadimplência')$$, :'est_a'),
  'Super Admin suspende com motivo'
);
reset role;

select is((select slug::text from public.establishments where id = :'est_a'), 'barbearia-a-centro', 'slug atualizado');
select is(
  (select metadata ->> 'slug_from' from public.audit_logs where action = 'establishment.updated' and establishment_id = :'est_a'),
  'barbearia-a', 'troca de slug fica registrada na auditoria'
);
select is(
  (select metadata ->> 'to' from public.audit_logs where action = 'establishment.status_changed' and establishment_id = :'est_a'),
  'suspended', 'mudança de status é auditada'
);

select pg_temp.login_as(:'owner_a');
select throws_ok(
  format($$select public.update_establishment(%L, '{"slug":"x-y-z","name":"X"}')$$, :'est_a'),
  'P0001', 'FORBIDDEN', 'owner não altera dados cadastrais pela RPC'
);
select throws_ok(
  format($$select public.set_establishment_status(%L, 'active')$$, :'est_a'),
  'P0001', 'FORBIDDEN', 'owner não reativa o próprio estabelecimento'
);

-- Imagens ------------------------------------------------------------------------
select throws_ok(
  format($$select public.set_establishment_image(%L, 'logo', %L)$$, :'est_a', :'est_b' || '/logo/x.png'),
  'P0001', 'VALIDATION_ERROR', 'caminho de imagem precisa estar na pasta do próprio estabelecimento'
);
select lives_ok(
  format($$select public.set_establishment_image(%L, 'logo', %L)$$, :'est_a', :'est_a' || '/logo/x.png'),
  'owner define a logo do próprio estabelecimento'
);
select throws_ok(
  format($$select public.set_establishment_image(%L, 'logo', %L)$$, :'est_b', :'est_b' || '/logo/x.png'),
  'P0001', 'FORBIDDEN', 'owner de A não altera imagens de B'
);

-- Convites -----------------------------------------------------------------------
select lives_ok(
  format($$select public.create_invitation(%L, 'novo@teste.dev', 'admin')$$, :'est_a'),
  'owner convida um admin'
);
select throws_ok(
  format($$select public.create_invitation(%L, 'outro@teste.dev', 'owner')$$, :'est_a'),
  'P0001', 'FORBIDDEN', 'owner não convida outro owner'
);
select throws_ok(
  format($$select public.create_invitation(%L, 'x@teste.dev', 'staff')$$, :'est_b'),
  'P0001', 'FORBIDDEN', 'owner de A não convida para B'
);
select throws_ok(
  format($$select public.create_invitation(%L, 'staffa@teste.dev', 'staff')$$, :'est_a'),
  'P0001', 'ALREADY_MEMBER', 'não convida quem já é membro ativo'
);
select (public.create_invitation(:'est_a', 'novo@teste.dev', 'staff') ->> 'token') as token_novo \gset
reset role;

select is(
  (select count(*) from public.establishment_invitations
    where establishment_id = :'est_a' and email = 'novo@teste.dev' and accepted_at is null and revoked_at is null),
  1::bigint, 'reenviar convite revoga o anterior (um pendente por e-mail)'
);

select pg_temp.login_as(:'staff_a');
select throws_ok(
  format($$select public.create_invitation(%L, 'y@teste.dev', 'staff')$$, :'est_a'),
  'P0001', 'FORBIDDEN', 'staff não convida'
);
select throws_ok(
  format($$select public.get_invitation_by_token(%L)$$, :'token_novo'),
  '42501', null, 'usuários da API não leem convites por token (somente o servidor)'
);
reset role;

select pg_temp.login_as(:'super');
select throws_ok(
  format($$select public.create_invitation(%L, 'segundo-dono@teste.dev', 'owner')$$, :'est_a'),
  'P0001', 'OWNER_EXISTS', 'não convida owner quando já existe um ativo'
);
reset role;

set local role service_role;
select is(public.get_invitation_by_token(:'token_novo') ->> 'status', 'pending', 'servidor consulta o convite pelo token');
select is(public.get_invitation_by_token('token-inexistente') ->> 'status', 'invalid', 'token desconhecido é inválido');
reset role;

-- Aceite -------------------------------------------------------------------------
select pg_temp.new_user('intruso@teste.dev') as intruder \gset
select pg_temp.new_user('novo@teste.dev') as novo \gset

select pg_temp.login_as(:'intruder');
select throws_ok(
  format($$select public.accept_invitation(%L)$$, :'token_novo'),
  'P0001', 'INVITATION_EMAIL_MISMATCH', 'convite só é aceito pelo e-mail convidado'
);
reset role;

select pg_temp.login_as(:'novo');
select is(public.accept_invitation(:'token_novo') ->> 'role', 'staff', 'convidado aceita e recebe o papel do convite');
select throws_ok(
  format($$select public.accept_invitation(%L)$$, :'token_novo'),
  'P0001', 'INVITATION_INVALID', 'convite é de uso único'
);
reset role;

select is(
  (select role::text from public.establishment_members where establishment_id = :'est_a' and user_id = :'novo'),
  'staff', 'vínculo criado no estabelecimento correto'
);

select * from finish();
rollback;
