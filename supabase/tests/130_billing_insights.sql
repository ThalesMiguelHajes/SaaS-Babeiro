-- Indicadores, cupons e adicionais recorrentes (BILLING §5, §6, §17; F20).
begin;
select plan(16);

set client_min_messages = warning;
truncate public.establishments, public.platform_admins, public.audit_logs, public.coupons cascade;
delete from auth.users;

create function pg_temp.login_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end
$$;

insert into auth.users (id, email) values (gen_random_uuid(), 'fin@x.dev') returning id as fin \gset
insert into auth.users (id, email) values (gen_random_uuid(), 'dono@a.dev') returning id as owner \gset
insert into public.platform_admins (user_id, platform_role) values (:'fin', 'billing_manager');
insert into public.establishments (slug, name) values ('loja-a', 'Loja A') returning id as est \gset
insert into public.establishments (slug, name) values ('loja-b', 'Loja B') returning id as est_b \gset
insert into public.establishment_members (establishment_id, user_id, role) values (:'est', :'owner', 'owner');
select v.id as essencial from public.subscription_plan_versions v join public.subscription_plans p on p.id = v.plan_id where p.code = 'essencial' \gset

select pg_temp.login_as(:'fin');
select set_config('app.billing_today', '2027-03-01', true);
select public.billing_assign_subscription(:'est', :'essencial', '2027-03-01', false, 'first_invoice', null, null, null, 0, true, null)
  ->> 'subscription_id' as sub \gset
select public.billing_assign_subscription(:'est_b', :'essencial', '2027-03-01', false, 'waive', null, null, null, 0, true, null)
  ->> 'subscription_id' as sub_b \gset
select id as inv0 from public.invoices where subscription_id = :'sub' and kind = 'subscription_cycle' \gset
select is((select total_cents from public.invoices where id = :'inv0'), 9990 + 14990, '1ª fatura: plano + implantação');
select public.billing_record_payment(:'est', :'inv0', 9990 + 14990, 'pix', '2027-03-01', null, null);
select public.billing_record_payment(:'est_b', id, 9990, 'pix', '2027-03-02', null, null)
from public.invoices where subscription_id = :'sub_b';

-- Adicional recorrente -------------------------------------------------------------------
select public.billing_add_recurring_item(:'sub', null, 'Automação de WhatsApp', 1, 2990, '2027-03-15') as item \gset
select public.billing_generate_next_invoice(:'sub', true) as inv1 \gset
select is((select array_agg(kind::text order by kind) from public.invoice_items where invoice_id = :'inv1'),
  array['plan', 'add_on'], 'adicional recorrente entra na fatura do ciclo');
select is((select total_cents from public.invoices where id = :'inv1'), 9990 + 2990, 'valor do ciclo com o adicional');
select public.billing_end_recurring_item(:'item', '2027-04-20', 'Encerrado a pedido');
select public.billing_generate_next_invoice(:'sub', true) as inv2 \gset
select is((select total_cents from public.invoices where id = :'inv2'), 9990, 'adicional encerrado sai das próximas faturas');

-- Cupons ----------------------------------------------------------------------------------
select public.billing_create_coupon('bemvindo10', 'Boas-vindas 10%', 'percent', 1000, 'repeating', 2, null, 1);
select is((select code::text from public.coupons), 'BEMVINDO10', 'código do cupom normalizado');
select throws_ok($$select public.billing_create_coupon('BEMVINDO10', 'Outro cupom', 'fixed', 100, 'once', null, null, null)$$,
  'P0001', 'COUPON_CODE_TAKEN', 'código de cupom é único');
select isnt(public.billing_apply_coupon(:'sub', 'bemvindo10'), null::uuid, 'cupom aplicado à assinatura');
select throws_ok(format($$select public.billing_apply_coupon(%L, 'BEMVINDO10')$$, :'sub_b'),
  'P0001', 'COUPON_INVALID', 'limite de resgates do cupom é respeitado');
select throws_ok(format($$select public.billing_apply_coupon(%L, 'NAOEXISTE')$$, :'sub_b'),
  'P0001', 'COUPON_INVALID', 'cupom inexistente é recusado');
select public.billing_generate_next_invoice(:'sub', true) as inv3 \gset
select is((select total_cents from public.invoices where id = :'inv3'), 9990 - 999, 'cupom de 10% aplicado na fatura');

-- Painel (F20: receitas avulsas não entram no MRR) --------------------------------------
select public.billing_add_charge(:'est', null, 'Treinamento extra', 2, 8000, true);
select public.billing_dashboard('2026-01-01', '2027-06-30') as dash \gset
select is((:'dash'::jsonb ->> 'mrr_cents')::integer, 9990 + 9990, 'MRR soma as mensalidades recorrentes ativas');
select is((:'dash'::jsonb ->> 'arr_cents')::integer, (9990 + 9990) * 12, 'ARR = MRR × 12');
select ok((:'dash'::jsonb -> 'invoiced_by_kind' ->> 'one_time')::integer >= 14990 + 16000,
  'implantação e treinamento aparecem como avulsos, fora do MRR (F20)');
select is((:'dash'::jsonb ->> 'received_cents')::integer, 9990 + 14990 + 9990, 'recebido no período');
select is(jsonb_array_length(:'dash'::jsonb -> 'monthly'), 12, 'série mensal de 12 meses para o gráfico');

-- Permissões ------------------------------------------------------------------------------
select pg_temp.login_as(:'owner');
select throws_ok($$select public.billing_dashboard('2027-01-01', '2027-12-31')$$, 'P0001', 'FORBIDDEN',
  'estabelecimento não vê o painel financeiro da plataforma');

select * from finish();
rollback;
