-- Rotina diária de cobrança (BILLING §11, §16): idempotência, ciclos atrasados, régua, inadimplência.
begin;
select plan(24);

set client_min_messages = warning;
truncate public.establishments, public.platform_admins, public.audit_logs cascade;
delete from auth.users;

create function pg_temp.login_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end
$$;
create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
end
$$;

insert into auth.users (id, email) values (gen_random_uuid(), 'fin@x.dev') returning id as fin \gset
insert into auth.users (id, email) values (gen_random_uuid(), 'dono@a.dev') returning id as owner \gset
insert into public.platform_admins (user_id, platform_role) values (:'fin', 'super_admin');
insert into public.establishments (slug, name) values ('loja-a', 'Loja A') returning id as est \gset
insert into public.establishment_members (establishment_id, user_id, role) values (:'est', :'owner', 'owner');
insert into public.professionals (establishment_id, display_name) values (:'est', 'Bruno'), (:'est', 'Carla');
select v.id as essencial from public.subscription_plan_versions v join public.subscription_plans p on p.id = v.plan_id where p.code = 'essencial' \gset
select v.id as individual from public.subscription_plan_versions v join public.subscription_plans p on p.id = v.plan_id where p.code = 'individual' \gset

-- Assinatura com âncora em 10/01/2027, sem oferta e com implantação isenta; 1ª fatura paga.
select pg_temp.login_as(:'fin');
select set_config('app.billing_today', '2027-01-10', true);
select public.billing_assign_subscription(:'est', :'essencial', '2027-01-10', false, 'waive', null, null, null, 0, true, null)
  ->> 'subscription_id' as sub \gset
select id as inv0 from public.invoices where subscription_id = :'sub' \gset
select public.billing_record_payment(:'est', :'inv0', 9990, 'pix', '2027-01-10', null, null);
select pg_temp.as_postgres();

-- 1–4. Geração no prazo e idempotência (F14) ---------------------------------------------
select private.billing_run('2027-02-04', 'manual');
select is((select count(*) from public.invoices where subscription_id = :'sub'), 1::bigint,
  'antes de 5 dias do vencimento a fatura do ciclo não é gerada');
select private.billing_run('2027-02-05', 'manual');
select is((select count(*) from public.invoices where subscription_id = :'sub'), 2::bigint,
  'fatura do 2º ciclo emitida 5 dias antes do vencimento');
select is((select due_date from public.invoices where subscription_id = :'sub' and cycle_index = 1), '2027-02-10'::date,
  'vencimento no início do ciclo');
select private.billing_run('2027-02-05', 'manual');
select private.billing_run('2027-02-06', 'manual');
select is((select count(*) from public.invoices where subscription_id = :'sub'), 2::bigint,
  'rotina executada várias vezes não duplica faturas (F14)');

-- 5–8. Régua (idempotente por fatura e etapa) ---------------------------------------------
select is((select array_agg(kind order by kind) from public.billing_notifications), array['d-5'],
  'lembrete de 5 dias antes registrado uma única vez');
select private.billing_run('2027-02-09', 'manual');
select private.billing_run('2027-02-10', 'manual');
select is((select array_agg(kind order by days_from_due) from public.billing_notifications),
  array['d-5', 'd-1', 'd0'], 'lembrete de véspera e cobrança do dia');
select is((select status::text from public.subscriptions where id = :'sub'), 'active', 'no dia do vencimento ainda está em dia');

-- 8–11. Inadimplência: atraso, suspensão desligada por padrão ------------------------------
select private.billing_run('2027-02-11', 'manual');
select is((select status::text from public.invoices where subscription_id = :'sub' and cycle_index = 1), 'overdue',
  'fatura vencida marcada como vencida');
select is((select status::text from public.subscriptions where id = :'sub'), 'past_due', 'assinatura em atraso (past_due)');
select is(private.establishment_mode(:'est'), 'operational'::public.establishment_mode,
  'em atraso dentro da tolerância o estabelecimento continua operando');
select private.billing_run('2027-02-25', 'manual');
select is((select status::text from public.subscriptions where id = :'sub'), 'past_due',
  'suspensão automática desligada por padrão: continua em atraso');

-- 12–14. Exceção por assinatura: suspensão automática após a tolerância --------------------
select pg_temp.login_as(:'fin');
select public.billing_set_subscription_dunning(:'sub', true, 10);
select pg_temp.as_postgres();
select private.billing_run('2027-02-25', 'manual');
select is((select status::text from public.subscriptions where id = :'sub'), 'suspended',
  'com suspensão automática ligada, suspende após a tolerância');
select is(private.establishment_mode(:'est'), 'restricted'::public.establishment_mode, 'suspensa → modo restrito');
select is((select count(*) from public.professionals where establishment_id = :'est'), 2::bigint,
  'suspensão não exclui dados (F16)');

-- 15–16. Ciclos atrasados não são gerados para assinatura suspensa; quitação reativa (F17)
select is((select count(*) from public.invoices where subscription_id = :'sub'), 2::bigint,
  'assinatura suspensa não recebe novas faturas de ciclo');
select pg_temp.login_as(:'fin');
select set_config('app.billing_today', '2027-02-26', true);
select public.billing_record_payment(:'est', id, 9990, 'pix', '2027-02-26', null, null)
from public.invoices where subscription_id = :'sub' and cycle_index = 1;
select is((select status::text from public.subscriptions where id = :'sub'), 'active',
  'quitação das faturas vencidas reativa a assinatura (F17)');
select pg_temp.as_postgres();

-- 17–18. Rotina parada por dias gera todos os ciclos devidos, em ordem ----------------------
select private.billing_run('2027-05-12', 'manual');
select is((select array_agg(cycle_index order by cycle_index) from public.invoices where subscription_id = :'sub'),
  array[0, 1, 2, 3, 4], 'ciclos atrasados gerados em ordem (março, abril, maio)');
select is((select count(*) from public.billing_notifications n join public.invoices i on i.id = n.invoice_id
           where i.cycle_index = 2), 0::bigint,
  'avisos antigos de ciclos atrasados não são despejados de uma vez');

-- 19–20. Mudança de plano agendada: aplicada ou bloqueada pelo limite -----------------------
select pg_temp.login_as(:'fin');
select public.billing_schedule_plan_change(:'sub', :'individual', 0, 'Pediu downgrade');
select pg_temp.as_postgres();
select private.billing_run('2027-06-05', 'manual');
select is((select status from public.subscription_scheduled_changes), 'blocked',
  'downgrade agendado fica bloqueado quando há mais profissionais que o novo limite (F18)');
select is((select plan_version_id from public.subscriptions where id = :'sub'), :'essencial'::uuid, 'plano mantido');

-- 21–22. Log da rotina e falha isolada ------------------------------------------------------
select ok((select count(*) from public.billing_job_runs where status = 'ok') >= 10, 'execuções registradas em billing_job_runs');
select is((select errors from public.billing_job_runs order by id desc limit 1), '[]'::jsonb, 'sem erros na última execução');

-- 23–24. Permissões --------------------------------------------------------------------------
select ok(
  not has_function_privilege('authenticated', 'public.billing_run_daily()', 'execute')
  and not has_function_privilege('service_role', 'public.billing_run_daily()', 'execute'),
  'rotina diária não é executável pela API nem pela service_role'
);
select pg_temp.login_as(:'owner');
select throws_ok('select public.billing_run_now()', 'P0001', 'FORBIDDEN', 'dono do estabelecimento não executa a rotina');

select * from finish();
rollback;
