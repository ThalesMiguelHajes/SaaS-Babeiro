begin;
select plan(12);

insert into public.establishments (slug, name)
values ('asaas-sandbox-test', 'Asaas Sandbox Teste') returning id as est \gset
insert into public.establishments (slug, name)
values ('asaas-sandbox-other', 'Outro estabelecimento') returning id as other \gset
insert into public.invoices (establishment_id, kind, status, due_date, original_due_date, subtotal_cents, total_cents)
values (:'est', 'standalone', 'open', current_date, current_date, 10000, 10000)
returning id as invoice \gset

select ok(not has_function_privilege('authenticated',
  'public.billing_reserve_asaas_sandbox_charge(uuid,uuid,integer)', 'execute'),
  'usuário comum não pode reservar pelo RPC direto');
select ok(not has_function_privilege('authenticated',
  'public.billing_confirm_asaas_sandbox_payment(uuid,text,integer)', 'execute'),
  'usuário comum não pode baixar a fatura');
select ok(not has_function_privilege('anon',
  'public.billing_confirm_asaas_sandbox_payment(uuid,text,integer)', 'execute'),
  'anônimo não pode baixar a fatura');

set local role service_role;
select throws_ok(format(
  'select public.billing_reserve_asaas_sandbox_charge(%L,%L,10000)', :'invoice', :'other'
), 'P0001', 'INVOICE_BALANCE_CHANGED', 'fatura de outro tenant é recusada');
select is(public.billing_reserve_asaas_sandbox_charge(:'invoice', :'est', 10000),
  true, 'primeira chamada pode criar a cobrança');
select is(public.billing_reserve_asaas_sandbox_charge(:'invoice', :'est', 10000),
  false, 'repetição só pode consultar a cobrança');
select throws_ok(format(
  'select public.billing_confirm_asaas_sandbox_payment(%L,%L,9999)', :'invoice', 'pay_test'
), 'P0001', 'INVALID_ASAAS_CHARGE', 'valor diferente da reserva é recusado');
select is(public.billing_confirm_asaas_sandbox_payment(:'invoice', 'pay_test', 10000),
  true, 'baixa confirmada');
select is(public.billing_confirm_asaas_sandbox_payment(:'invoice', 'pay_test', 10000),
  false, 'reentrega não cria outro pagamento');
select throws_ok(format(
  'select public.billing_confirm_asaas_sandbox_payment(%L,%L,10000)', :'invoice', 'pay_other'
), 'P0001', 'INVALID_ASAAS_CHARGE', 'uma segunda cobrança não baixa a mesma fatura');
reset role;

select is((select status::text from public.invoices where id = :'invoice'), 'paid', 'fatura quitada');
select is((select sum(amount_cents) from public.payment_allocations where invoice_id = :'invoice'),
  10000::bigint, 'pagamento alocado uma única vez');

select * from finish();
rollback;
