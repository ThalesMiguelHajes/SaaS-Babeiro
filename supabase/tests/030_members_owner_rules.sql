-- Regras de titularidade (owner) do estabelecimento.
begin;
select plan(3);

set client_min_messages = warning;
-- Isola o teste dos dados do seed (tudo é desfeito no rollback final).
truncate public.establishments, public.platform_admins, public.audit_logs cascade;
delete from auth.users;

create function pg_temp.new_user(p_email text) returns uuid language sql as $$
  insert into auth.users (id, email) values (gen_random_uuid(), p_email) returning id
$$;

select pg_temp.new_user('dono@teste.dev') as owner \gset
select pg_temp.new_user('gerente@teste.dev') as manager \gset
insert into public.establishments (slug, name) values ('studio-x', 'Studio X') returning id as est \gset
insert into public.establishment_members (establishment_id, user_id, role) values
  (:'est', :'owner', 'owner'),
  (:'est', :'manager', 'admin');

-- A verificação é adiada para o COMMIT; aqui forçamos a checagem imediata.
set constraints all immediate;

select throws_ok(
  format($$update public.establishment_members set is_active = false where user_id = %L$$, :'owner'),
  'P0001', 'LAST_OWNER', 'não é possível desativar o único owner'
);
select throws_ok(
  format($$update public.establishment_members set role = 'admin' where user_id = %L$$, :'owner'),
  'P0001', 'LAST_OWNER', 'não é possível rebaixar o único owner'
);

-- Transferência de titularidade dentro de uma transação (checagem adiada).
set constraints all deferred;
update public.establishment_members set role = 'admin' where user_id = :'owner';
update public.establishment_members set role = 'owner' where user_id = :'manager';
set constraints all immediate;

select is(
  (select user_id from public.establishment_members where establishment_id = :'est' and role = 'owner'),
  :'manager'::uuid,
  'titularidade pode ser transferida na mesma transação'
);

select * from finish();
rollback;
