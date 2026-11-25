-- Agendamento público: DTOs, permissões, limites, política de cancelamento/reagendamento.
begin;
select plan(35);

set client_min_messages = warning;
truncate public.establishments, public.platform_admins, public.audit_logs cascade;
truncate private.rate_limits;
delete from auth.users;

create function pg_temp.at(p_time text, p_days integer default 3) returns timestamptz language sql as $$
  select (((now() at time zone 'America/Sao_Paulo')::date + p_days) + p_time::time) at time zone 'America/Sao_Paulo'
$$;
select ((now() at time zone 'America/Sao_Paulo')::date + 3) as d \gset

insert into public.establishments (slug, name, description) values ('vitrine', 'Vitrine', 'Barbearia')
returning id as est \gset
insert into public.establishments (slug, name) values ('fechada', 'Fechada') returning id as est_off \gset
update public.establishments set status = 'deactivated' where id = :'est_off';

insert into public.professionals (establishment_id, display_name, sort_order) values (:'est', 'Rafa', 1) returning id as pro \gset
insert into public.professionals (establishment_id, display_name, sort_order) values (:'est', 'Lia', 2) returning id as pro2 \gset
insert into public.professionals (establishment_id, display_name, is_bookable) values (:'est', 'Interno', false)
returning id as pro_hidden \gset
insert into public.services (establishment_id, name, price_cents, duration_minutes) values (:'est', 'Corte', 4000, 30)
returning id as svc \gset
insert into public.services (establishment_id, name, price_cents, duration_minutes, is_public)
values (:'est', 'Só no balcão', 1000, 30, false) returning id as svc_private \gset
insert into public.services (establishment_id, name, price_cents, duration_minutes) values (:'est', 'Sem ninguém', 1000, 30)
returning id as svc_orphan \gset
insert into public.professional_services (establishment_id, professional_id, service_id) values
  (:'est', :'pro', :'svc'), (:'est', :'pro2', :'svc'), (:'est', :'pro', :'svc_private'),
  (:'est', :'pro_hidden', :'svc_orphan');
insert into public.establishment_working_hours (establishment_id, weekday, start_time, end_time)
select :'est', w, '00:00', '24:00' from generate_series(0, 6) w;
update public.establishment_settings set min_booking_notice_minutes = 0 where establishment_id = :'est';

-- Permissões ------------------------------------------------------------------------
select ok(
  not has_function_privilege('authenticated', 'public.public_create_booking(text, uuid, uuid, timestamptz, text, text, text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.public_create_booking(text, uuid, uuid, timestamptz, text, text, text, text, text)', 'execute'),
  'reserva pública só é executável pelo servidor (service_role)'
);
select ok(
  not has_function_privilege('authenticated', 'public.public_get_booking(text, text)', 'execute'),
  'leitura por token só pelo servidor'
);
select ok(
  has_function_privilege('service_role', 'public.public_get_booking_page(text)', 'execute'),
  'service_role lê a página pública'
);

-- Página ----------------------------------------------------------------------------
select is(public.public_get_booking_page('fechada'), null, 'estabelecimento desativado: 404');
select is(public.public_get_booking_page('nao-existe'), null, 'slug inexistente: 404');
select is(
  (select array_agg(s ->> 'name' order by s ->> 'name')
   from jsonb_array_elements(public.public_get_booking_page('vitrine') -> 'services') s),
  array['Corte'], 'só serviços públicos com profissional visível aparecem'
);
select is(
  (select array_agg(p ->> 'display_name' order by p ->> 'display_name')
   from jsonb_array_elements(public.public_get_booking_page('VITRINE') -> 'professionals') p),
  array['Lia', 'Rafa'], 'profissionais fora da página pública não aparecem (slug sem diferenciar maiúsculas)'
);
select ok(
  not (public.public_get_booking_page('vitrine')::text ~ 'internal_notes|reason|user_id|email'),
  'DTO da página não traz campos internos'
);

-- Datas e horários ------------------------------------------------------------------
select ok(
  :'d'::date in (select public.public_get_available_dates('vitrine', :'svc', null, current_date, current_date + 10, null)),
  'datas com horário são listadas'
);
select is(
  (select count(*) from public.public_get_available_dates('vitrine', :'svc_private', null, current_date, current_date + 10, null)),
  0::bigint, 'serviço fora da página pública não tem datas'
);
select ok(
  pg_temp.at('10:00') in (select public.public_get_available_slots('vitrine', :'svc', null, :'d', null)),
  'horários do dia para "qualquer profissional"'
);

-- Reserva ---------------------------------------------------------------------------
select public.public_create_booking('vitrine', :'svc', :'pro', pg_temp.at('10:00'), 'João Cliente', '+5511988887777',
  null, 'Corte baixo', 'ip-a') as booking \gset
select ok((:'booking'::jsonb ->> 'token') ~ '^[A-Za-z0-9_-]{43}$', 'reserva devolve o token de gestão (uma vez)');
select ok((:'booking'::jsonb ->> 'reference_code') ~ '^[0-9A-Z]{8}$', 'reserva devolve o código de referência');
select ok(not (:'booking'::jsonb ? 'id') and not (:'booking'::jsonb ? 'professional_id'), 'reserva não expõe ids internos');
select is(
  (select status::text || '/' || source::text from public.appointments where reference_code = :'booking'::jsonb ->> 'reference_code'),
  'confirmed/public_page', 'reserva pública entra confirmada, com origem página pública'
);
select is(
  (select count(*) from public.appointment_access_tokens
   where token_hash = private.hash_token(:'booking'::jsonb ->> 'token')),
  1::bigint, 'banco guarda apenas o hash do token'
);
select throws_ok(
  format($$select public.public_create_booking('vitrine', %L, %L, %L, 'Maria', '+5511977776666', null, null, 'ip-b')$$,
    :'svc', :'pro', pg_temp.at('10:00')),
  'P0001', 'SLOT_UNAVAILABLE', 'mesmo horário não é reservado duas vezes'
);
select throws_ok(
  format($$select public.public_create_booking('vitrine', %L, %L, %L, 'Maria', '+5511977776666', null, null, 'ip-b')$$,
    :'svc', :'pro_hidden', pg_temp.at('11:00')),
  'P0001', 'PROFESSIONAL_UNAVAILABLE', 'profissional fora da página pública não recebe reserva pelo link'
);
select throws_ok(
  format($$select public.public_create_booking('vitrine', %L, %L, %L, 'Maria', '+5511977776666', null, null, 'ip-b')$$,
    :'svc', :'pro', pg_temp.at('11:05')),
  'P0001', 'SLOT_UNAVAILABLE', 'horário fora da grade é recusado na página pública'
);
select throws_ok(
  format($$select public.public_create_booking('vitrine', %L, %L, %L, 'Maria', '11977776666', null, null, 'ip-b')$$,
    :'svc', :'pro', pg_temp.at('11:00')),
  'P0001', 'VALIDATION_ERROR', 'telefone precisa estar normalizado (E.164)'
);

-- Cliente existente não é sobrescrito; limite de reservas ativas por telefone
select public.public_create_booking('vitrine', :'svc', null, pg_temp.at('12:00'), 'Outro Nome', '+5511988887777',
  null, null, 'ip-c') as second \gset
select is((select full_name from public.customers where phone_e164 = '+5511988887777'), 'João Cliente',
  'reserva pública não sobrescreve os dados do cliente');
select is(
  (select professional_auto_assigned from public.appointments where reference_code = :'second'::jsonb ->> 'reference_code'),
  true, '"qualquer profissional" escolhe alguém e marca a atribuição automática'
);
update public.establishment_settings set max_active_bookings_per_customer = 2 where establishment_id = :'est';
select throws_ok(
  format($$select public.public_create_booking('vitrine', %L, null, %L, 'João', '+5511988887777', null, null, 'ip-d')$$,
    :'svc', pg_temp.at('15:00')),
  'P0001', 'CUSTOMER_LIMIT_REACHED', 'limite de reservas ativas por telefone'
);

-- Rate limit: 5 reservas por hora por IP
select public.public_create_booking('vitrine', :'svc', null, pg_temp.at(t, 4), 'Cliente ' || t, '+55119000000' || n::text, null, null, 'ip-limite')
from (values ('09:00', 10), ('09:30', 11), ('10:00', 12), ('10:30', 13), ('11:00', 14)) v(t, n);
select throws_ok(
  format($$select public.public_create_booking('vitrine', %L, null, %L, 'Sexto', '+5511900000015', null, null, 'ip-limite')$$,
    :'svc', pg_temp.at('11:30', 4)),
  'P0001', 'RATE_LIMITED', 'sexta reserva do mesmo IP na hora é bloqueada'
);

-- Consulta pelo token ---------------------------------------------------------------
select is(public.public_get_booking('token-invalido', null), null, 'token inválido não revela nada');
select is(
  (public.public_get_booking(:'booking'::jsonb ->> 'token', null)) ->> 'customer_name', 'João Cliente',
  'token dá acesso ao resumo da própria reserva'
);
select ok(
  not ((public.public_get_booking(:'booking'::jsonb ->> 'token', null))::text ~ 'internal_notes|customer_phone'),
  'resumo não traz notas internas nem telefone'
);

-- Reagendamento ---------------------------------------------------------------------
select public.public_create_booking('vitrine', :'svc', :'pro', pg_temp.at('13:00'), 'Ocupante', '+5511955554444',
  null, null, 'ip-e');
select throws_ok(
  format($$select public.public_reschedule_booking(%L, %L, null)$$, :'booking'::jsonb ->> 'token', pg_temp.at('13:00')),
  'P0001', 'SLOT_UNAVAILABLE', 'reagendar para horário ocupado falha'
);
select is(
  (select starts_at from public.appointments where reference_code = :'booking'::jsonb ->> 'reference_code'),
  pg_temp.at('10:00'), 'falha no reagendamento mantém a reserva original'
);
select is(
  (public.public_reschedule_booking(:'booking'::jsonb ->> 'token', pg_temp.at('16:00'), null)) ->> 'ends_at',
  to_jsonb(pg_temp.at('16:30')) #>> '{}', 'cliente reagenda para horário livre'
);

-- Cancelamento e política -----------------------------------------------------------
update public.establishment_settings set allow_customer_cancellation = false where establishment_id = :'est';
select throws_ok(
  format($$select public.public_cancel_booking(%L, null, null)$$, :'booking'::jsonb ->> 'token'),
  'P0001', 'POLICY_VIOLATION', 'cancelamento desligado pela política do estabelecimento'
);
update public.establishment_settings set allow_customer_cancellation = true where establishment_id = :'est';

-- Suspenso: não reserva nem reagenda, mas o cliente ainda pode cancelar.
update public.establishments set status = 'suspended' where id = :'est';
select is((public.public_get_booking_page('vitrine') -> 'establishment' ->> 'booking_enabled'), 'false',
  'suspenso: página mostra aviso em vez do agendamento');
select throws_ok(
  format($$select public.public_reschedule_booking(%L, %L, null)$$, :'booking'::jsonb ->> 'token', pg_temp.at('17:00')),
  'P0001', 'ESTABLISHMENT_UNAVAILABLE', 'suspenso: reagendamento bloqueado'
);
select is(
  (public.public_cancel_booking(:'booking'::jsonb ->> 'token', 'Imprevisto', null)) ->> 'status', 'cancelled',
  'suspenso: cliente ainda cancela'
);
select throws_ok(
  format($$select public.public_cancel_booking(%L, null, null)$$, :'booking'::jsonb ->> 'token'),
  'P0001', 'INVALID_STATUS_TRANSITION', 'reserva cancelada não é cancelada de novo'
);

select * from finish();
rollback;
