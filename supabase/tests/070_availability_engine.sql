-- Motor de disponibilidade (DATABASE §7). Inclui o exemplo de referência §7.3.1.
begin;
select plan(26);

set client_min_messages = warning;
truncate public.establishments, public.platform_admins, public.audit_logs cascade;
delete from auth.users;

-- Data de referência: daqui a 3 dias no fuso de São Paulo.
select ((now() at time zone 'America/Sao_Paulo')::date + 3) as d \gset

insert into public.establishments (slug, name) values ('motor', 'Motor') returning id as est \gset
insert into public.professionals (establishment_id, display_name) values (:'est', 'Rafa') returning id as pro \gset
insert into public.professionals (establishment_id, display_name) values (:'est', 'Sem jornada') returning id as pro_inherit \gset
insert into public.services (establishment_id, name, price_cents, duration_minutes)
values (:'est', 'Corte masculino', 4000, 30) returning id as svc30 \gset
insert into public.services (establishment_id, name, price_cents, duration_minutes)
values (:'est', 'Barba', 3000, 20) returning id as svc20 \gset
insert into public.services (establishment_id, name, price_cents, duration_minutes)
values (:'est', 'Corte e barba', 6500, 50) returning id as svc50 \gset
insert into public.services (establishment_id, name, price_cents, duration_minutes)
values (:'est', 'Pigmentação', 8000, 60) returning id as svc60 \gset
insert into public.services (establishment_id, name, price_cents, duration_minutes, buffer_after_minutes)
values (:'est', 'Química', 9000, 30, 10) returning id as svc_buf \gset
insert into public.services (establishment_id, name, price_cents, duration_minutes)
values (:'est', 'Não habilitado', 1000, 30) returning id as svc_off \gset

insert into public.professional_services (establishment_id, professional_id, service_id)
select :'est', :'pro', s from unnest(array[:'svc30', :'svc20', :'svc50', :'svc60', :'svc_buf']::uuid[]) s;
insert into public.professional_services (establishment_id, professional_id, service_id)
values (:'est', :'pro_inherit', :'svc30');

-- Estabelecimento aberto todos os dias 08–20; profissional 09–12 e 13–18 (almoço 12–13).
insert into public.establishment_working_hours (establishment_id, weekday, start_time, end_time)
select :'est', w, '08:00', '20:00' from generate_series(0, 6) w;
insert into public.professional_working_hours (establishment_id, professional_id, weekday, start_time, end_time)
select :'est', :'pro', w, t.s, t.e
from generate_series(0, 6) w, (values ('09:00'::time, '12:00'::time), ('13:00', '18:00')) t(s, e);

-- Agendamentos existentes 10:00–11:00 e 15:00–15:30.
insert into public.customers (establishment_id, full_name, created_source) values (:'est', 'Cliente', 'admin_panel')
returning id as cust \gset
create function pg_temp.at(p_time text) returns timestamptz language sql as $$
  select (current_setting('test.d')::date + p_time::time) at time zone 'America/Sao_Paulo'
$$;
select set_config('test.d', :'d', true);
insert into public.appointments (establishment_id, professional_id, service_id, customer_id, reference_code,
  starts_at, ends_at, occupied_range, source, service_name_snapshot, price_cents_snapshot,
  duration_minutes_snapshot, customer_name_snapshot)
values
  (:'est', :'pro', :'svc60', :'cust', 'AAAAAAA1', pg_temp.at('10:00'), pg_temp.at('11:00'),
   tstzrange(pg_temp.at('10:00'), pg_temp.at('11:00')), 'admin_panel', 'X', 0, 60, 'Cliente'),
  (:'est', :'pro', :'svc30', :'cust', 'AAAAAAA2', pg_temp.at('15:00'), pg_temp.at('15:30'),
   tstzrange(pg_temp.at('15:00'), pg_temp.at('15:30')), 'admin_panel', 'X', 0, 30, 'Cliente');

create function pg_temp.slots(p_svc uuid, p_pro uuid default null, p_panel boolean default false)
returns text[] language sql as $$
  select coalesce(array_agg(to_char(t at time zone 'America/Sao_Paulo', 'HH24:MI') order by t), '{}')
  from private.available_slots(
    (select id from public.establishments where slug = 'motor'), p_svc,
    coalesce(p_pro, (select id from public.professionals where display_name = 'Rafa')),
    current_setting('test.d')::date, p_panel)
  t
$$;

-- 1–5. Exemplo de referência -----------------------------------------------------------
select is(
  pg_temp.slots(:'svc30'),
  array['09:00','09:15','09:30','11:00','11:15','11:30','13:00','13:15','13:30','13:45','14:00','14:15',
        '14:30','15:30','15:45','16:00','16:15','16:30','16:45','17:00','17:15','17:30'],
  'exemplo de referência: 22 horários para 30 min'
);
select ok(not ('09:45' = any (pg_temp.slots(:'svc30'))), '09:45 não é oferecido (invadiria o atendimento das 10h)');
select ok(not ('11:45' = any (pg_temp.slots(:'svc30'))), '11:45 não é oferecido (invadiria o almoço)');
select ok(not ('17:45' = any (pg_temp.slots(:'svc30'))), '17:45 não é oferecido (passaria do fim do expediente)');
select is(cardinality(pg_temp.slots(:'svc20')), 22, 'barba (20 min): 22 horários');
select is(cardinality(pg_temp.slots(:'svc50')), 14, 'corte e barba (50 min): 14 horários');
select is(pg_temp.slots(:'svc60'),
  array['09:00','11:00','13:00','13:15','13:30','13:45','14:00','15:30','15:45','16:00','16:15','16:30','16:45','17:00'],
  'pigmentação (60 min): 14 horários');

-- Buffers precisam caber no tempo livre (D16).
select is((pg_temp.slots(:'svc_buf'))[1:3], array['09:00','09:15','11:00'],
  'limpeza de 10 min após o serviço também precisa caber');

-- Habilitação (A12), serviço inativo, profissional inativo.
select is(pg_temp.slots(:'svc_off'), '{}'::text[], 'serviço não habilitado para o profissional não tem horários');
update public.services set is_active = false where id = :'svc20';
select is(pg_temp.slots(:'svc20'), '{}'::text[], 'serviço inativo não tem horários');
update public.services set is_active = true where id = :'svc20';

-- Profissional sem jornada própria segue o estabelecimento (D23).
select is(cardinality(pg_temp.slots(:'svc30', :'pro_inherit')), 47,
  'sem jornada própria: segue o horário do estabelecimento (08:00–19:30)');

-- Visibilidade pública x painel
update public.professionals set is_bookable = false where id = :'pro_inherit';
select is(pg_temp.slots(:'svc30', :'pro_inherit'), '{}'::text[], 'profissional fora da página pública não aparece para o cliente');
select is(cardinality(pg_temp.slots(:'svc30', :'pro_inherit', true)), 47, '... mas aparece para a equipe no painel');

-- Cancelamento libera o horário (A9).
update public.appointments set status = 'cancelled', cancelled_at = now() where reference_code = 'AAAAAAA2';
select ok('15:00' = any (pg_temp.slots(:'svc30')), 'cancelamento libera o horário');
alter table public.appointments disable trigger appointments_status_transition;
update public.appointments set status = 'confirmed', cancelled_at = null where reference_code = 'AAAAAAA2';
alter table public.appointments enable trigger appointments_status_transition;

-- Bloqueio do profissional e do estabelecimento.
insert into public.availability_blocks (establishment_id, professional_id, period, kind)
values (:'est', :'pro', tstzrange(pg_temp.at('13:00'), pg_temp.at('14:00')), 'personal');
select ok(not ('13:30' = any (pg_temp.slots(:'svc30'))), 'bloqueio do profissional remove os horários');
insert into public.availability_blocks (establishment_id, professional_id, period, kind)
values (:'est', null, tstzrange(pg_temp.at('16:00'), pg_temp.at('17:00')), 'other');
select ok(not ('16:15' = any (pg_temp.slots(:'svc30'))), 'bloqueio do estabelecimento afeta todos os profissionais');
select ok(not ('16:15' = any (pg_temp.slots(:'svc30', :'pro_inherit', true))), '... inclusive quem segue o horário da casa');
delete from public.availability_blocks;

-- Férias (A7)
insert into public.availability_blocks (establishment_id, professional_id, period, all_day, kind)
values (:'est', :'pro', tstzrange(pg_temp.at('00:00') - interval '2 days', pg_temp.at('00:00') + interval '5 days'), true, 'vacation');
select is(pg_temp.slots(:'svc30'), '{}'::text[], 'profissional de férias não aparece disponível');
delete from public.availability_blocks;

-- Exceções por data
insert into public.establishment_date_overrides (establishment_id, date, kind, label)
values (:'est', :'d', 'closed', 'Feriado');
select is(pg_temp.slots(:'svc30'), '{}'::text[], 'estabelecimento fechado na data: sem horários');
delete from public.establishment_date_overrides;
insert into public.professional_date_overrides (establishment_id, professional_id, date, kind, start_time, end_time)
values (:'est', :'pro', :'d', 'custom_hours', '16:00', '17:00');
select is(pg_temp.slots(:'svc30'), array['16:00','16:15','16:30'], 'jornada especial na data substitui a semanal');
delete from public.professional_date_overrides;

-- Janela de agendamento
update public.establishment_settings set max_booking_days_ahead = 2 where establishment_id = :'est';
select is(pg_temp.slots(:'svc30'), '{}'::text[], 'além do limite de dias à frente: vazio para o cliente');
select is(cardinality(pg_temp.slots(:'svc30', null, true)), 22, '... a equipe ainda agenda pelo painel');
update public.establishment_settings set max_booking_days_ahead = 30 where establishment_id = :'est';

-- Validação de horário específico (mesma lógica)
select is(private.booking_error(:'est', :'svc30', :'pro', pg_temp.at('09:05')), 'SLOT_UNAVAILABLE',
  'na página pública o horário precisa estar na grade');
select is(private.booking_error(:'est', :'svc30', :'pro', pg_temp.at('09:05'), true), null,
  'no painel, horário fora da grade é aceito se estiver livre');
select is(private.booking_error(:'est', :'svc30', :'pro', pg_temp.at('09:45'), true), 'SLOT_UNAVAILABLE',
  'horário que invade outro atendimento é recusado');

-- Horário de verão: grade alinhada à meia-noite local (Nova York, 14/03/2027).
update public.establishments set timezone = 'America/New_York' where id = :'est';
select is(
  (select array_agg(to_char(t at time zone 'America/New_York', 'HH24:MI') order by t)
   from private.available_slots(:'est', :'svc60', :'pro', '2027-03-14', true) t)[1:2],
  array['09:00', '09:15'],
  'no dia da mudança de horário de verão a grade continua em horário local'
);

select * from finish();
rollback;
