-- RPCs de horários, bloqueios e agendamentos: autorização, isolamento, conflitos e máquina de status.
begin;
select plan(42);

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
create function pg_temp.reset_role() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
end
$$;
create function pg_temp.at(p_time text) returns timestamptz language sql as $$
  select (current_setting('test.d')::date + p_time::time) at time zone 'America/Sao_Paulo'
$$;
select set_config('test.d', ((now() at time zone 'America/Sao_Paulo')::date + 3)::text, true);

select pg_temp.new_user('dono@a.dev')   as owner_a \gset
select pg_temp.new_user('staff@a.dev')  as staff_a \gset
select pg_temp.new_user('staff2@a.dev') as staff2_a \gset
select pg_temp.new_user('dono@b.dev')   as owner_b \gset

insert into public.establishments (slug, name) values ('loja-a', 'Loja A') returning id as est_a \gset
insert into public.establishments (slug, name) values ('loja-b', 'Loja B') returning id as est_b \gset
insert into public.establishment_members (establishment_id, user_id, role) values
  (:'est_a', :'owner_a', 'owner'), (:'est_a', :'staff_a', 'staff'), (:'est_a', :'staff2_a', 'staff'),
  (:'est_b', :'owner_b', 'owner');

insert into public.professionals (establishment_id, display_name, user_id, sort_order)
values (:'est_a', 'Bruno', :'staff_a', 1) returning id as pro1 \gset
insert into public.professionals (establishment_id, display_name, user_id, sort_order)
values (:'est_a', 'Carla', :'staff2_a', 2) returning id as pro2 \gset
insert into public.services (establishment_id, name, price_cents, duration_minutes)
values (:'est_a', 'Corte', 4000, 30) returning id as svc \gset
insert into public.professional_services (establishment_id, professional_id, service_id)
values (:'est_a', :'pro1', :'svc'), (:'est_a', :'pro2', :'svc');

-- Horários --------------------------------------------------------------------------
select pg_temp.login_as(:'staff_a');
select throws_ok(
  format($$select public.save_weekly_hours(%L, null, '[]', true)$$, :'est_a'),
  'P0001', 'FORBIDDEN', 'staff não altera o horário do estabelecimento'
);
select throws_ok(
  format($$select public.save_weekly_hours(%L, %L, '[]', true)$$, :'est_a', :'pro1'),
  'P0001', 'FORBIDDEN', 'staff não altera a própria jornada sem permissão da casa'
);
select throws_ok(
  format($$insert into public.establishment_working_hours (establishment_id, weekday, start_time, end_time)
           values (%L, 1, '09:00', '18:00')$$, :'est_a'),
  '42501', null, 'horários não são gravados direto na tabela'
);

select pg_temp.login_as(:'owner_a');
select is(
  (public.save_weekly_hours(:'est_a', null,
    (select jsonb_agg(jsonb_build_object('weekday', w, 'start', '09:00', 'end', '19:00')) from generate_series(0, 6) w),
    false)) ->> 'saved',
  'true', 'dono salva o horário semanal do estabelecimento'
);
select is((select count(*) from public.establishment_working_hours where establishment_id = :'est_a'), 7::bigint,
  'sete intervalos gravados');
select throws_ok(
  format($$select public.save_weekly_hours(%L, %L,
    '[{"weekday":1,"start":"09:00","end":"12:00"},{"weekday":1,"start":"11:00","end":"14:00"}]', true)$$, :'est_a', :'pro1'),
  'P0001', 'OVERLAPPING_INTERVALS', 'intervalos sobrepostos no mesmo dia são recusados'
);
select throws_ok(
  format($$select public.save_weekly_hours(%L, null, '[{"weekday":9,"start":"09:00","end":"12:00"}]', true)$$, :'est_a'),
  'P0001', 'VALIDATION_ERROR', 'dia da semana inválido é recusado'
);

select pg_temp.login_as(:'owner_b');
select throws_ok(
  format($$select public.save_weekly_hours(%L, null, '[]', true)$$, :'est_a'),
  'P0001', 'FORBIDDEN', 'dono de B não altera horários de A'
);
select throws_ok(
  format($$select public.save_weekly_hours(%L, %L, '[]', true)$$, :'est_b', :'pro1'),
  'P0001', 'NOT_FOUND', 'profissional de A não é alcançável pelo estabelecimento B'
);

-- Agendamentos ----------------------------------------------------------------------
select pg_temp.login_as(:'owner_a');
select (public.create_appointment(:'est_a', :'svc', :'pro1', pg_temp.at('10:00'), null, 'João', '+5511999990000',
  null, 'Primeira vez', null)) ->> 'id' as appt1 \gset
select isnt(:'appt1'::uuid, null::uuid, 'dono cria agendamento pelo painel');
select is((select status::text from public.appointments where id = :'appt1'), 'confirmed', 'agendamento do painel entra confirmado');
select throws_ok(
  format($$select public.create_appointment(%L, %L, %L, %L, null, 'Maria', null, null, null, null)$$,
    :'est_a', :'svc', :'pro1', pg_temp.at('10:00')),
  'P0001', 'SLOT_UNAVAILABLE', 'mesmo horário não é reservado duas vezes'
);
select throws_ok(
  format($$select public.create_appointment(%L, %L, %L, %L, null, 'Maria', null, null, null, null)$$,
    :'est_a', :'svc', :'pro1', pg_temp.at('10:15')),
  'P0001', 'SLOT_UNAVAILABLE', 'horário parcialmente sobreposto é recusado'
);
select throws_ok(
  format($$select public.create_appointment(%L, %L, %L, %L, null, 'Maria', null, null, null, null)$$,
    :'est_a', :'svc', :'pro1', pg_temp.at('19:00')),
  'P0001', 'SLOT_UNAVAILABLE', 'fora do expediente é recusado'
);
select (public.create_appointment(:'est_a', :'svc', :'pro1', pg_temp.at('19:00'), null, 'Encaixe', null,
  null, null, null, true)) ->> 'id' as fit_in \gset
select is((select outside_working_hours from public.appointments where id = :'fit_in'), true,
  'dono faz encaixe fora do expediente explicitamente');

-- Deduplicação de cliente por telefone
select public.create_appointment(:'est_a', :'svc', :'pro2', pg_temp.at('10:00'), null, 'João Silva', '+5511999990000',
  null, null, null);
select is((select count(*) from public.customers where phone_e164 = '+5511999990000'), 1::bigint,
  'mesmo telefone reaproveita o cliente');

-- "Qualquer profissional": escolhe quem tem menos atendimentos no dia (Carla tem 1, Bruno tem 2)
select (public.create_appointment(:'est_a', :'svc', null, pg_temp.at('14:00'), null, 'Ana', null, null, null, null))
  ->> 'professional_id' as auto_pro \gset
select is(:'auto_pro'::text, :'pro2'::text, 'qualquer profissional: escolhe quem tem menos atendimentos no dia');

-- Staff
select pg_temp.login_as(:'staff_a');
select is((select count(*) from public.appointments), 2::bigint, 'staff vê só os próprios agendamentos');
select is((select count(*) from public.customers), 0::bigint, 'staff não lê a tabela de clientes');
select throws_ok(
  format($$select public.create_appointment(%L, %L, %L, %L, null, 'X', null, null, null, null)$$,
    :'est_a', :'svc', :'pro2', pg_temp.at('16:00')),
  'P0001', 'FORBIDDEN', 'staff não agenda para outro profissional'
);
select throws_ok(
  format($$select public.create_appointment(%L, %L, %L, %L, null, 'X', null, null, null, null, true)$$,
    :'est_a', :'svc', :'pro1', pg_temp.at('20:00')),
  'P0001', 'FORBIDDEN', 'staff não faz encaixe fora do expediente'
);
select is(
  (public.create_appointment(:'est_a', :'svc', null, pg_temp.at('16:00'), null, 'Cliente do Bruno', null, null, null, null))
    ->> 'professional_id',
  :'pro1'::text, 'staff agenda para si mesmo'
);
select throws_ok(
  format($$insert into public.appointments (establishment_id) values (%L)$$, :'est_a'),
  '42501', null, 'agendamentos não são gravados direto na tabela'
);

select pg_temp.login_as(:'owner_b');
select is((select count(*) from public.appointments), 0::bigint, 'dono de B não vê agendamentos de A');
select throws_ok(
  format($$select public.create_appointment(%L, %L, %L, %L, null, 'X', null, null, null, null)$$,
    :'est_a', :'svc', :'pro1', pg_temp.at('17:00')),
  'P0001', 'FORBIDDEN', 'dono de B não agenda em A'
);
select throws_ok(
  format($$select * from public.get_available_slots(%L, %L, null, %L)$$, :'est_a', :'svc', current_setting('test.d')),
  'P0001', 'FORBIDDEN', 'dono de B não consulta horários de A'
);

-- Horários livres para a equipe: 10:00 ocupado para os dois; 14:00 só Bruno livre
select pg_temp.login_as(:'owner_a');
select ok(
  not exists (select 1 from public.get_available_slots(:'est_a', :'svc', null, current_setting('test.d')::date)
              where starts_at = pg_temp.at('10:00')),
  'horário ocupado por todos não aparece em "qualquer profissional"'
);
select is(
  (select professional_ids from public.get_available_slots(:'est_a', :'svc', null, current_setting('test.d')::date)
   where starts_at = pg_temp.at('14:00')),
  array[:'pro1']::uuid[], 'horário mostra quem está livre'
);

-- Reagendamento ---------------------------------------------------------------------
select throws_ok(
  format($$select public.reschedule_appointment(%L, %L, null, 1)$$, :'appt1', pg_temp.at('16:00')),
  'P0001', 'SLOT_UNAVAILABLE', 'reagendar para horário ocupado falha'
);
select is((select starts_at from public.appointments where id = :'appt1'), pg_temp.at('10:00'),
  'reagendamento malsucedido mantém a reserva original (A10)');
select is((public.reschedule_appointment(:'appt1', pg_temp.at('11:00'), null, 1)) ->> 'version', '2',
  'reagenda para horário livre');
select throws_ok(
  format($$select public.reschedule_appointment(%L, %L, null, 1)$$, :'appt1', pg_temp.at('12:00')),
  'P0001', 'STALE_VERSION', 'versão desatualizada é recusada'
);

-- Status ----------------------------------------------------------------------------
select throws_ok(
  format($$select public.update_appointment_status(%L, 'completed', null, 2)$$, :'appt1'),
  'P0001', 'INVALID_STATUS_TRANSITION', 'confirmado não vai direto para concluído'
);
select throws_ok(
  format($$select public.update_appointment_status(%L, 'in_progress', null, 2)$$, :'appt1'),
  'P0001', 'INVALID_STATUS_TRANSITION', 'atendimento não começa dias antes do horário'
);
select is((public.update_appointment_status(:'appt1', 'cancelled', 'Cliente pediu', 2)) ->> 'status', 'cancelled',
  'cancela com motivo');
select throws_ok(
  format($$select public.update_appointment_status(%L, 'confirmed', null, 3)$$, :'appt1'),
  'P0001', 'INVALID_STATUS_TRANSITION', 'cancelado é terminal'
);
select is((select array_agg(event_type order by id) from public.appointment_events where appointment_id = :'appt1'),
  array['created', 'rescheduled', 'cancelled'], 'histórico registra criação, reagendamento e cancelamento');

-- Conflitos (E4-7) -------------------------------------------------------------------
-- Bruno tem atendimento às 16:00. Reduzir a jornada dele para 09–12 gera conflito.
select is(
  (public.save_weekly_hours(:'est_a', :'pro1',
    (select jsonb_agg(jsonb_build_object('weekday', w, 'start', '09:00', 'end', '12:00')) from generate_series(0, 6) w),
    false)) -> 'conflicts' -> 0 ->> 'reason',
  'outside_hours', 'pré-visualização lista o agendamento que ficaria fora da jornada'
);
select is((select count(*) from public.professional_working_hours where professional_id = :'pro1'), 0::bigint,
  'sem confirmação nada é salvo');
select is(
  (public.save_availability_block(:'est_a', null, :'pro1', pg_temp.at('15:30'), pg_temp.at('17:00'), false,
     'personal', 'Médico', true)) ->> 'saved',
  'true', 'bloqueio sobre agendamento é salvo com confirmação'
);
select is((select count(*) from public.get_schedule_conflicts(:'est_a')), 1::bigint,
  'agendamento afetado aparece em "precisam de atenção" (nada é cancelado)');

-- Desativar profissional com agendamentos futuros
select throws_ok(
  format($$update public.professionals set is_active = false where id = %L$$, :'pro1'),
  'P0001', 'HAS_FUTURE_APPOINTMENTS', 'profissional com agendamentos futuros não é desativado'
);

select * from finish();
rollback;
