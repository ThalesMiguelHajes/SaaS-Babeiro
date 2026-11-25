-- Financeiro do SaaS (BILLING §22): ciclos, oferta, implantação, limites, faturas, pagamentos, modo.
begin;
select plan(51);

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
create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
end
$$;

-- 1–8. Ciclos (BILLING §8.1, F21) -------------------------------------------------------
select is(private.billing_cycle_start('2027-01-10', 10, 'month', 1), '2027-02-10'::date, 'âncora 10: mês seguinte no dia 10');
select is(private.billing_cycle_start('2027-01-31', 31, 'month', 1), '2027-02-28'::date, 'âncora 31: fevereiro termina no 28');
select is(private.billing_cycle_start('2027-01-31', 31, 'month', 2), '2027-03-31'::date, '... e volta ao 31 em março (não escorrega)');
select is(private.billing_cycle_start('2027-01-31', 31, 'month', 3), '2027-04-30'::date, '... 30 em abril');
select is(private.billing_cycle_start('2028-01-31', 31, 'month', 1), '2028-02-29'::date, 'ano bissexto: 29/02');
select is(private.billing_cycle_start('2028-02-29', 29, 'month', 12), '2029-02-28'::date, 'âncora 29/02: no ano seguinte, 28/02');
select is(private.billing_cycle_start('2028-02-29', 29, 'month', 13), '2029-03-29'::date, '... e 29/03 depois');
select is(private.billing_cycle_start('2027-01-30', 30, 'month', 2), '2027-03-30'::date, 'âncora 30: 30/03');

-- Dados ----------------------------------------------------------------------------------
select pg_temp.new_user('super@x.dev')  as super \gset
select pg_temp.new_user('fin@x.dev')    as fin \gset
select pg_temp.new_user('dono@a.dev')   as owner_a \gset
select pg_temp.new_user('staff@a.dev')  as staff_a \gset
select pg_temp.new_user('dono@b.dev')   as owner_b \gset
insert into public.platform_admins (user_id, platform_role) values (:'super', 'super_admin'), (:'fin', 'billing_manager');
insert into public.establishments (slug, name) values ('loja-a', 'Loja A') returning id as est \gset
insert into public.establishments (slug, name) values ('loja-b', 'Loja B') returning id as est_b \gset
insert into public.establishment_members (establishment_id, user_id, role) values
  (:'est', :'owner_a', 'owner'), (:'est', :'staff_a', 'staff'), (:'est_b', :'owner_b', 'owner');
insert into public.professionals (establishment_id, display_name) values (:'est', 'Bruno');
select v.id as essencial from public.subscription_plan_versions v join public.subscription_plans p on p.id = v.plan_id where p.code = 'essencial' \gset
select v.id as individual from public.subscription_plan_versions v join public.subscription_plans p on p.id = v.plan_id where p.code = 'individual' \gset
select v.id as premium from public.subscription_plan_versions v join public.subscription_plans p on p.id = v.plan_id where p.code = 'premium' \gset
select id as premium_plan from public.subscription_plans where code = 'premium' \gset

select is(private.establishment_mode(:'est'), 'operational'::public.establishment_mode,
  'estabelecimento sem assinatura opera normalmente (D24)');

-- Permissões -----------------------------------------------------------------------------
select pg_temp.login_as(:'owner_a');
select throws_ok(
  format($$select public.billing_assign_subscription(%L, %L, null, true, 'first_invoice', null, null, null, 0, true, null)$$, :'est', :'essencial'),
  'P0001', 'FORBIDDEN', 'dono do estabelecimento não atribui plano nem preço (F12)'
);
select throws_ok(
  format($$select public.billing_record_payment(%L, null, 100, 'pix', null, null, null)$$, :'est'),
  'P0001', 'FORBIDDEN', 'dono não confirma pagamentos (F13)'
);

-- Atribuição com oferta (F1, F3) ---------------------------------------------------------
select pg_temp.login_as(:'fin');
select public.billing_assign_subscription(:'est', :'essencial', null, true, 'first_invoice', null, null, null, 0, true, null) as assigned \gset
select :'assigned'::jsonb ->> 'subscription_id' as sub \gset
select :'assigned'::jsonb ->> 'invoice_id' as inv0 \gset
select is((select total_cents from public.invoices where id = :'inv0'), 10000, 'oferta: 1ª fatura de R$ 100,00 (F1)');
select is((select array_agg(kind::text) from public.invoice_items where invoice_id = :'inv0'), array['promotional_bundle'],
  '1ª fatura tem uma única linha da oferta (plano + implantação)');
select is((select status::text from public.billing_charges where subscription_id = :'sub' and kind = 'setup_fee'),
  'covered_by_promotion', 'implantação coberta pela oferta');
select ok((select number from public.invoices where id = :'inv0') ~ '^FAT-\d{4}-\d{6}$', 'fatura emitida recebe número sequencial');
select is((select status::text from public.subscriptions where id = :'sub'), 'pending_activation', 'assinatura aguardando ativação');
select is(private.establishment_mode(:'est'), 'setup'::public.establishment_mode, 'modo implantação até pagar');
select throws_ok(
  format($$select public.billing_assign_subscription(%L, %L, null, false, 'waive', null, null, null, 0, true, null)$$, :'est', :'essencial'),
  'P0001', 'SUBSCRIPTION_EXISTS', 'uma assinatura aberta por estabelecimento'
);

-- Isolamento (F11) -----------------------------------------------------------------------
select pg_temp.login_as(:'owner_a');
select is((select count(*) from public.invoices), 1::bigint, 'dono vê as faturas do próprio estabelecimento');
select pg_temp.login_as(:'owner_b');
select is((select count(*) from public.invoices), 0::bigint, 'dono de B não vê faturas de A (F11)');
select pg_temp.login_as(:'staff_a');
select is((select count(*) from public.subscriptions), 0::bigint, 'staff não vê a assinatura');

-- Pagamento parcial e total (F10, F17) ----------------------------------------------------
select pg_temp.login_as(:'fin');
select public.billing_record_payment(:'est', :'inv0', 5000, 'pix', null, 'E2E123', null) as pay1 \gset
select is((select status::text from public.invoices where id = :'inv0'), 'partially_paid', 'pagamento parcial não liquida a fatura (F10)');
select is((select status::text from public.subscriptions where id = :'sub'), 'pending_activation', '... e não ativa a assinatura');
select public.billing_record_payment(:'est', :'inv0', 6000, 'pix', null, null, null);
select is((select status::text || '/' || amount_paid_cents from public.invoices where id = :'inv0'), 'paid/10000',
  'quitada; excedente fica como saldo a alocar');
select is((select status::text from public.subscriptions where id = :'sub'), 'active', 'pagamento ativa a assinatura');
select is(private.establishment_mode(:'est'), 'operational'::public.establishment_mode, 'modo operacional');

-- Próximo ciclo (F2, F3) ------------------------------------------------------------------
select public.billing_generate_next_invoice(:'sub', true) as inv1 \gset
select is((select total_cents from public.invoices where id = :'inv1'), 9990, '2º ciclo usa o preço contratado (F2)');
select ok(not exists (select 1 from public.invoice_items where invoice_id = :'inv1' and kind in ('setup_fee', 'promotional_bundle')),
  'implantação não é cobrada de novo (F3)');
select is((select due_date from public.invoices where id = :'inv1'),
  (select private.billing_cycle_start(anchor_date, anchor_day, interval, 1) from public.subscriptions where id = :'sub'),
  'vencimento no início do ciclo seguinte (pré-pago)');

-- Limite de profissionais (F4, F5, F18) ---------------------------------------------------
select pg_temp.login_as(:'owner_a');
insert into public.professionals (establishment_id, display_name) values (:'est', 'Carla');
select throws_ok(
  format($$insert into public.professionals (establishment_id, display_name) values (%L, 'Terceiro')$$, :'est'),
  'P0001', 'PLAN_LIMIT_REACHED', 'Essencial não permite 3 profissionais ativos (F4)'
);
select lives_ok(
  format($$insert into public.professionals (establishment_id, display_name, is_active) values (%L, 'Inativo', false)$$, :'est'),
  'profissional inativo não consome vaga'
);
select pg_temp.login_as(:'fin');
select throws_ok(
  format($$select public.billing_change_plan(%L, %L, 0, 'teste')$$, :'sub', :'individual'),
  'P0001', 'PLAN_LIMIT_REACHED', 'downgrade acima do limite é bloqueado'
);
select pg_temp.as_postgres();
select is((select count(*) from public.professionals where establishment_id = :'est' and is_active), 2::bigint,
  'downgrade nunca desativa profissionais (F18)');
select pg_temp.login_as(:'fin');

-- Premium com vagas extras (F6) e desconto com piso zero (F19) ----------------------------
select public.billing_change_plan(:'sub', :'premium', 2, 'cresceu');
select public.billing_generate_next_invoice(:'sub', true) as inv2 \gset
select is((select total_cents from public.invoices where id = :'inv2'), 15990 + 2 * 1490, 'vagas adicionais cobradas (F6)');
select public.billing_grant_discount(:'sub', 'Cortesia', 'fixed', 1000000, 'once', null, 'Compensação por indisponibilidade');
select public.billing_generate_next_invoice(:'sub', true) as inv3 \gset
select is((select total_cents from public.invoices where id = :'inv3'), 0, 'desconto maior que o valor não gera cobrança negativa (F19)');
select is((select status::text from public.invoices where id = :'inv3'), 'paid', 'fatura de valor zero já nasce quitada');
select public.billing_generate_next_invoice(:'sub', false) as inv4 \gset
select ok(not exists (select 1 from public.invoice_items where invoice_id = :'inv4' and kind = 'discount'),
  'desconto "uma vez" não se repete');

-- Versões de plano (F8) e imutabilidade --------------------------------------------------
select public.billing_create_plan_version(:'premium_plan', 17990, null, 10, 1690);
select is((select plan_version_id from public.subscriptions where id = :'sub'), :'premium'::uuid,
  'nova versão de preço não altera assinaturas existentes (F8)');
select pg_temp.as_postgres();
select throws_ok(
  format($$update public.subscription_plan_versions set monthly_price_cents = 1 where id = %L$$, :'premium'),
  'P0001', 'PLAN_VERSION_IN_USE', 'versão em uso não pode ser editada'
);
select throws_ok(
  format($$update public.invoices set total_cents = 1, subtotal_cents = 1 where id = %L$$, :'inv1'),
  'P0001', 'INVOICE_IMMUTABLE', 'valores de fatura emitida são imutáveis'
);
select throws_ok(
  format($$update public.subscriptions set status = 'canceled' where id = %L$$, :'sub'),
  'P0001', 'INVALID_STATUS_TRANSITION', 'status da assinatura só muda pela máquina de estados'
);
select throws_ok(format($$delete from public.payments where id = %L$$, :'pay1'), 'P0001', 'APPEND_ONLY',
  'pagamento nunca é apagado');

-- Reversão de pagamento e cancelamento ----------------------------------------------------
select pg_temp.login_as(:'fin');
select throws_ok(format($$select public.billing_cancel_invoice(%L, 'erro')$$, :'inv0'),
  'P0001', 'INVALID_STATUS_TRANSITION', 'fatura com pagamento não é cancelada (reverta o pagamento antes)');
select public.billing_reverse_payment(:'pay1', 'Pix devolvido pelo banco');
select is((select status::text || '/' || amount_paid_cents from public.invoices where id = :'inv0'), 'partially_paid/5000',
  'reversão recalcula a fatura');

-- Comprovante (F9) ------------------------------------------------------------------------
select public.billing_issue_invoice(:'inv4');
select pg_temp.login_as(:'owner_a');
select public.billing_submit_proof(:'inv4', :'est' || '/' || :'inv4' || '/comprovante.pdf') as proof \gset
select pg_temp.login_as(:'fin');
select is((select count(*) from public.payments where establishment_id = :'est' and status = 'confirmed'), 1::bigint,
  'comprovante enviado não confirma pagamento (F9)');
select public.billing_review_proof(:'proof', true, 15990 + 2 * 1490, 'pix', null);
select is((select status::text from public.payment_proofs where id = :'proof'), 'accepted', 'conferência aceita o comprovante');

-- Suspensão financeira: restringe sem apagar (F16, F24) -----------------------------------
select public.billing_transition_subscription(:'sub', 'suspended', 'Inadimplência');
select is(private.establishment_mode(:'est'), 'restricted'::public.establishment_mode, 'suspensão → modo restrito');
select pg_temp.login_as(:'owner_a');
select throws_ok(
  format($$select public.create_appointment(%L, gen_random_uuid(), null, now() + interval '1 day', null, 'X', null, null, null, null)$$, :'est'),
  'P0001', 'ESTABLISHMENT_RESTRICTED', 'modo restrito bloqueia novos agendamentos (F24)'
);
select is((select count(*) from public.professionals where establishment_id = :'est'), 3::bigint, 'suspensão não exclui dados (F16)');

-- Oferta de uso único e auditoria (F22) ---------------------------------------------------
select pg_temp.login_as(:'fin');
select public.billing_transition_subscription(:'sub', 'canceled', 'Encerrou o contrato');
select throws_ok(
  format($$select public.billing_assign_subscription(%L, %L, null, true, 'first_invoice', null, null, null, 0, true, null)$$, :'est', :'premium'),
  'P0001', 'PROMOTION_ALREADY_USED', 'oferta de entrada não se repete no mesmo estabelecimento'
);
select pg_temp.as_postgres();
select ok(
  (select count(distinct action) from public.audit_logs where action like 'billing.%') >= 8,
  'ações financeiras ficam na auditoria (F22)'
);

select * from finish();
rollback;
