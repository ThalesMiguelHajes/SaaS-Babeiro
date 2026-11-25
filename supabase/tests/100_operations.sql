-- Operação: concluir atendimento, recebimentos, anulação, agenda do dia e indicadores.
begin;
select plan(27);

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

select pg_temp.new_user('dono@a.dev')   as owner_a \gset
select pg_temp.new_user('staff@a.dev')  as staff_a \gset
select pg_temp.new_user('staff2@a.dev') as staff2_a \gset
select pg_temp.new_user('dono@b.dev')   as owner_b \gset

insert into public.establishments (slug, name) values ('loja-a', 'Loja A') returning id as est \gset
insert into public.establishments (slug, name) values ('loja-b', 'Loja B') returning id as est_b \gset
insert into public.establishment_members (establishment_id, user_id, role) values
  (:'est', :'owner_a', 'owner'), (:'est', :'staff_a', 'staff'), (:'est', :'staff2_a', 'staff'),
  (:'est_b', :'owner_b', 'owner');
insert into public.professionals (establishment_id, display_name, user_id, sort_order)
values (:'est', 'Bruno', :'staff_a', 1) returning id as pro1 \gset
insert into public.professionals (establishment_id, display_name, user_id, sort_order)
values (:'est', 'Carla', :'staff2_a', 2) returning id as pro2 \gset
insert into public.services (establishment_id, name, price_cents, duration_minutes)
values (:'est', 'Corte', 5000, 30) returning id as svc \gset
insert into public.professional_services (establishment_id, professional_id, service_id)
values (:'est', :'pro1', :'svc'), (:'est', :'pro2', :'svc');
insert into public.establishment_working_hours (establishment_id, weekday, start_time, end_time)
select :'est', w, '00:00', '24:00' from generate_series(0, 6) w;
insert into public.customers (establishment_id, full_name, created_source) values (:'est', 'Cliente', 'admin_panel')
returning id as cust \gset

-- Atendimentos já começados (há 1h) para Bruno e Carla, e um futuro para Bruno.
create function pg_temp.appt(p_pro uuid, p_start timestamptz, p_code text) returns uuid language sql as $$
  insert into public.appointments (establishment_id, professional_id, service_id, customer_id, reference_code,
    starts_at, ends_at, occupied_range, source, service_name_snapshot, price_cents_snapshot,
    duration_minutes_snapshot, customer_name_snapshot)
  select p.establishment_id, p_pro, s.id, c.id, p_code, p_start, p_start + interval '30 minutes',
         tstzrange(p_start, p_start + interval '30 minutes'), 'admin_panel', s.name, s.price_cents, 30, c.full_name
  from public.professionals p, public.services s, public.customers c
  where p.id = p_pro and s.name = 'Corte' and c.full_name = 'Cliente'
  returning id
$$;
select pg_temp.appt(:'pro1', date_trunc('minute', now()) - interval '1 hour', 'PAST0001') as past1 \gset
select pg_temp.appt(:'pro2', date_trunc('minute', now()) - interval '2 hours', 'PAST0002') as past2 \gset
select pg_temp.appt(:'pro1', date_trunc('minute', now()) + interval '2 days', 'FTRE0001') as future1 \gset

-- Concluir ------------------------------------------------------------------------------
select pg_temp.login_as(:'owner_a');
select throws_ok(
  format($$select public.complete_appointment(%L, 5000, '[]', null)$$, :'future1'),
  'P0001', 'INVALID_STATUS_TRANSITION', 'atendimento futuro não é concluído'
);
select throws_ok(
  format($$select public.complete_appointment(%L, 5000, '[{"amount_cents":-1,"method":"pix"}]', null)$$, :'past1'),
  'P0001', 'VALIDATION_ERROR', 'valor de pagamento inválido é recusado (e nada é concluído)'
);
select is((select status::text from public.appointments where id = :'past1'), 'confirmed', '... e o status não mudou');
select is(
  (public.complete_appointment(:'past1', 4000,
     '[{"amount_cents":3000,"method":"pix"},{"amount_cents":1000,"method":"cash","notes":"troco ok"}]', 1)) ->> 'status',
  'completed', 'dono conclui com desconto e dois pagamentos'
);
select is((select final_price_cents from public.appointments where id = :'past1'), 4000, 'valor cobrado registrado');
select is(
  (select array_agg(to_status::text order by id) from public.appointment_events where appointment_id = :'past1'),
  array['in_progress', 'completed'], 'conclusão passa por "em atendimento" e gera eventos'
);
select is((select count(*) from public.appointment_payments where appointment_id = :'past1'), 2::bigint,
  'dois lançamentos gravados');
select throws_ok(
  format($$select public.complete_appointment(%L, 4000, '[]', null)$$, :'past1'),
  'P0001', 'INVALID_STATUS_TRANSITION', 'concluído não é concluído de novo'
);
select isnt(public.record_appointment_payment(:'past1', 500, 'pix', 'gorjeta'), null::uuid,
  'pagamento extra depois de concluído (gorjeta)');
select throws_ok(
  format($$select public.record_appointment_payment(%L, 500, 'pix', null)$$, :'future1'),
  'P0001', 'INVALID_STATUS_TRANSITION', 'não registra pagamento em atendimento que não começou'
);

-- Staff ---------------------------------------------------------------------------------
update public.establishment_settings set staff_can_record_payments = false where establishment_id = :'est';
select pg_temp.login_as(:'staff2_a');
select throws_ok(
  format($$select public.complete_appointment(%L, 5000, '[{"amount_cents":5000,"method":"pix"}]', null)$$, :'past2'),
  'P0001', 'FORBIDDEN', 'staff não registra pagamento quando a casa não permite'
);
select is((public.complete_appointment(:'past2', 5000, '[]', null)) ->> 'status', 'completed',
  '... mas conclui o próprio atendimento sem pagamento');
select is((select count(*) from public.appointment_payments), 0::bigint, 'staff não vê pagamentos de outro profissional');
select pg_temp.as_postgres();
update public.establishment_settings set staff_can_record_payments = true where establishment_id = :'est';
select pg_temp.login_as(:'staff2_a');
select isnt(public.record_appointment_payment(:'past2', 5000, 'debit_card', null), null::uuid,
  'staff registra pagamento do próprio atendimento quando permitido');
select throws_ok(
  format($$select public.record_appointment_payment(%L, 100, 'pix', null)$$, :'past1'),
  'P0001', 'FORBIDDEN', 'staff não registra pagamento em atendimento de outro profissional'
);

-- Anulação ------------------------------------------------------------------------------
select pg_temp.login_as(:'owner_a');
select id as pay_cash from public.appointment_payments where method = 'cash' \gset
select throws_ok(format($$select public.void_appointment_payment(%L, '')$$, :'pay_cash'),
  'P0001', 'REASON_REQUIRED', 'anulação exige motivo');
select lives_ok(format($$select public.void_appointment_payment(%L, 'Lançado em dobro')$$, :'pay_cash'),
  'dono anula lançamento com motivo');
select throws_ok(format($$select public.void_appointment_payment(%L, 'de novo')$$, :'pay_cash'),
  'P0001', 'APPEND_ONLY', 'lançamento anulado não é anulado de novo');
select throws_ok(format($$update public.appointment_payments set amount_cents = 1 where id = %L$$, :'pay_cash'),
  '42501', null, 'pagamentos não são alterados direto pela API');
select is((select count(*) from public.audit_logs where action = 'appointment_payment.voided'), 1::bigint,
  'anulação auditada');

-- Indicadores ---------------------------------------------------------------------------
select public.get_dashboard(:'est', current_date - 2, current_date + 3) as dash \gset
select is((:'dash'::jsonb ->> 'expected_cents')::integer, 15000, 'Previsto: soma dos agendamentos não cancelados');
select is((:'dash'::jsonb ->> 'realized_cents')::integer, 9000, 'Realizado: valores cobrados dos concluídos');
select is((:'dash'::jsonb ->> 'received_cents')::integer, 8500, 'Recebido: pagamentos não anulados (3000 + 500 + 5000)');
select is(:'dash'::jsonb -> 'by_method', '{"pix": 3500, "debit_card": 5000}'::jsonb, 'Recebido por forma de pagamento');

select pg_temp.login_as(:'staff_a');
select is((public.get_dashboard(:'est', current_date - 2, current_date + 3) ->> 'realized_cents')::integer, 4000,
  'profissional vê só os próprios números');
select is(jsonb_array_length(public.get_agenda_day(:'est', (now() at time zone 'America/Sao_Paulo')::date + 2) -> 'professionals'), 1,
  'agenda do profissional mostra só a própria coluna');

select pg_temp.login_as(:'owner_b');
select throws_ok(
  format($$select public.get_agenda_day(%L, current_date)$$, :'est'),
  'P0001', 'FORBIDDEN', 'dono de B não vê a agenda de A'
);

select * from finish();
rollback;
