-- =============================================================================
-- 14 · Operação: recebimentos por atendimento, agenda do dia e indicadores (Fase 6)
-- Referência: DATABASE.md §5.23, MASTER_PLAN §4.2 (D19)
-- `appointment_payments` = estabelecimento recebendo do cliente final (não é o financeiro do SaaS).
-- =============================================================================

create table public.appointment_payments (
  id                  uuid primary key default gen_random_uuid(),
  establishment_id    uuid not null references public.establishments (id) on delete cascade,
  appointment_id      uuid not null,
  amount_cents        integer not null check (amount_cents > 0 and amount_cents <= 10000000),
  method              public.pos_payment_method not null,
  received_at         timestamptz not null default now(),
  notes               text check (notes is null or char_length(notes) <= 300),
  recorded_by         uuid references public.profiles (id) on delete set null,
  provider            text,
  provider_payment_id text,
  voided_at           timestamptz,
  voided_by           uuid references public.profiles (id) on delete set null,
  void_reason         text check (void_reason is null or char_length(void_reason) between 3 and 300),
  created_at          timestamptz not null default now(),
  constraint appointment_payments_appointment_fk foreign key (establishment_id, appointment_id)
    references public.appointments (establishment_id, id),
  constraint appointment_payments_void_shape check ((voided_at is null) = (void_reason is null))
);

create index appointment_payments_received_idx on public.appointment_payments (establishment_id, received_at);
create index appointment_payments_appointment_idx on public.appointment_payments (appointment_id);

create trigger appointment_payments_tenant before update on public.appointment_payments
  for each row execute function private.prevent_tenant_change();

-- Lançamentos nunca são apagados; a única alteração permitida é a anulação (uma vez).
create or replace function private.guard_payment_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'APPEND_ONLY';
  end if;
  if old.voided_at is not null
     or (new.amount_cents, new.method, new.received_at, new.appointment_id, new.notes)
        is distinct from (old.amount_cents, old.method, old.received_at, old.appointment_id, old.notes) then
    raise exception using errcode = 'P0001', message = 'APPEND_ONLY';
  end if;
  return new;
end;
$$;

create trigger appointment_payments_guard before update or delete on public.appointment_payments
  for each row execute function private.guard_payment_update();

alter table public.appointment_payments enable row level security;

create policy appointment_payments_select on public.appointment_payments for select to authenticated
  using (
    (select private.is_establishment_admin(establishment_id))
    or exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and a.professional_id = (select private.my_professional_id(a.establishment_id))
    )
  );

revoke all on public.appointment_payments from anon, authenticated;
grant select on public.appointment_payments to authenticated;
grant select, insert, update on public.appointment_payments to service_role;

-- -----------------------------------------------------------------------------
-- Recebimentos
-- -----------------------------------------------------------------------------

-- Quem registra pagamento: owner/admin; o profissional nos próprios atendimentos, se a casa permitir.
create or replace function private.assert_can_record_payment(p_appointment public.appointments)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_can_manage_appointment(p_appointment);
  if not private.is_establishment_admin(p_appointment.establishment_id) and not coalesce((
    select s.staff_can_record_payments from public.establishment_settings s
    where s.establishment_id = p_appointment.establishment_id
  ), false) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
end;
$$;

create or replace function private.insert_payments(p_appointment public.appointments, p_payments jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_item   jsonb;
  v_amount integer;
  v_method public.pos_payment_method;
  v_notes  text;
  v_count  integer := 0;
begin
  if p_payments is null then
    return 0;
  end if;
  if jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) > 10 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  for v_item in select * from jsonb_array_elements(p_payments)
  loop
    begin
      v_amount := (v_item ->> 'amount_cents')::integer;
      v_method := (v_item ->> 'method')::public.pos_payment_method;
      v_notes := nullif(trim(v_item ->> 'notes'), '');
    exception when others then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end;
    if v_amount is null or v_amount <= 0 or v_amount > 10000000 or char_length(coalesce(v_notes, '')) > 300 then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
    insert into public.appointment_payments
      (establishment_id, appointment_id, amount_cents, method, notes, recorded_by)
    values (p_appointment.establishment_id, p_appointment.id, v_amount, v_method, v_notes, (select auth.uid()));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Concluir atendimento: valor cobrado (desconto de balcão) + recebimentos em uma transação (D19).
-- A partir de "confirmado", passa por "em atendimento" (respeitando a máquina de status).
create or replace function public.complete_appointment(
  p_appointment_id    uuid,
  p_final_price_cents integer,
  p_payments          jsonb,
  p_expected_version  integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  perform private.assert_can_manage_appointment(v_appt);
  if coalesce(jsonb_array_length(p_payments), 0) > 0 then
    perform private.assert_can_record_payment(v_appt);
  end if;
  if p_expected_version is not null and v_appt.version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'STALE_VERSION';
  end if;
  if p_final_price_cents is null or p_final_price_cents < 0 or p_final_price_cents > 10000000 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  if v_appt.status not in ('confirmed', 'in_progress') then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
  end if;

  if v_appt.status = 'confirmed' then
    update public.appointments set status = 'in_progress' where id = v_appt.id;
    insert into public.appointment_events
      (establishment_id, appointment_id, event_type, from_status, to_status, actor_type, actor_user_id)
    values (v_appt.establishment_id, v_appt.id, 'status_changed', 'confirmed', 'in_progress',
            private.appointment_actor_type(), (select auth.uid()));
  end if;

  update public.appointments
     set status = 'completed', final_price_cents = p_final_price_cents
   where id = v_appt.id;
  insert into public.appointment_events
    (establishment_id, appointment_id, event_type, from_status, to_status, actor_type, actor_user_id, note)
  values (v_appt.establishment_id, v_appt.id, 'status_changed', 'in_progress', 'completed',
          private.appointment_actor_type(), (select auth.uid()),
          case when p_final_price_cents <> v_appt.price_cents_snapshot
               then 'Valor cobrado diferente do preço de tabela' end);

  perform private.insert_payments(v_appt, p_payments);

  return jsonb_build_object('id', v_appt.id, 'status', 'completed',
                            'version', (select version from public.appointments where id = v_appt.id));
end;
$$;

-- Registrar pagamento depois (ex.: parte em dinheiro, parte no Pix).
create or replace function public.record_appointment_payment(
  p_appointment_id uuid,
  p_amount_cents   integer,
  p_method         public.pos_payment_method,
  p_notes          text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_id   uuid;
begin
  select * into v_appt from public.appointments where id = p_appointment_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  perform private.assert_can_record_payment(v_appt);
  if v_appt.status not in ('in_progress', 'completed') then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
  end if;
  perform private.insert_payments(v_appt, jsonb_build_array(jsonb_build_object(
    'amount_cents', p_amount_cents, 'method', p_method, 'notes', p_notes)));
  select id into v_id from public.appointment_payments
  where appointment_id = v_appt.id order by created_at desc, id desc limit 1;
  return v_id;
end;
$$;

-- Anulação com motivo (nunca DELETE). Auditada.
create or replace function public.void_appointment_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.appointment_payments;
  v_appt    public.appointments;
  v_reason  text := nullif(trim(p_reason), '');
begin
  select * into v_payment from public.appointment_payments where id = p_payment_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  select * into v_appt from public.appointments where id = v_payment.appointment_id;
  perform private.assert_can_record_payment(v_appt);
  if v_reason is null or char_length(v_reason) < 3 then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;
  if v_payment.voided_at is not null then
    raise exception using errcode = 'P0001', message = 'APPEND_ONLY';
  end if;

  update public.appointment_payments
     set voided_at = now(), voided_by = (select auth.uid()), void_reason = left(v_reason, 300)
   where id = p_payment_id;

  perform private.write_audit('appointment_payment.voided', v_payment.establishment_id, 'appointment_payment',
    p_payment_id, jsonb_build_object('amount_cents', v_payment.amount_cents, 'method', v_payment.method,
                                     'appointment_id', v_payment.appointment_id));
end;
$$;

-- -----------------------------------------------------------------------------
-- Escopo de leitura: owner/admin → estabelecimento todo; profissional → só ele.
-- -----------------------------------------------------------------------------
create or replace function private.read_scope(p_establishment_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pro uuid;
begin
  if private.is_establishment_admin(p_establishment_id) then
    return null;
  end if;
  v_pro := private.my_professional_id(p_establishment_id);
  if v_pro is null then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  return v_pro;
end;
$$;

-- Agenda de um dia: colunas (profissionais com o tempo de trabalho), bloqueios e agendamentos.
create or replace function public.get_agenda_day(p_establishment_id uuid, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_scope uuid := private.read_scope(p_establishment_id);
  v_tz    text;
  v_day   tstzrange;
begin
  select timezone into v_tz from public.establishments where id = p_establishment_id;
  v_day := private.local_day(p_date, v_tz);

  return jsonb_build_object(
    'timezone', v_tz,
    'professionals', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'display_name', p.display_name, 'photo_path', p.photo_path,
               'is_active', p.is_active,
               'work', coalesce((
                 select jsonb_agg(jsonb_build_array(lower(r), upper(r)) order by lower(r))
                 from unnest(private.work_time(p_establishment_id, p.id, p_date, v_tz)) r
               ), '[]'::jsonb))
             order by p.sort_order, p.display_name)
      from public.professionals p
      where p.establishment_id = p_establishment_id
        and (v_scope is null or p.id = v_scope)
        and (p.is_active or exists (
          select 1 from public.appointments a
          where a.professional_id = p.id and a.status <> 'cancelled' and a.occupied_range && v_day))
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id, 'professional_id', b.professional_id, 'starts_at', lower(b.period),
               'ends_at', upper(b.period), 'kind', b.kind, 'reason', b.reason, 'all_day', b.all_day)
             order by lower(b.period))
      from public.availability_blocks b
      where b.establishment_id = p_establishment_id and b.period && v_day
        and (b.professional_id is null or v_scope is null or b.professional_id = v_scope)
    ), '[]'::jsonb),
    'appointments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'professional_id', a.professional_id, 'starts_at', a.starts_at,
               'ends_at', a.ends_at, 'status', a.status, 'service_name', a.service_name_snapshot,
               'customer_name', a.customer_name_snapshot, 'price_cents', a.price_cents_snapshot,
               'source', a.source, 'outside_working_hours', a.outside_working_hours,
               'paid_cents', coalesce((select sum(ap.amount_cents) from public.appointment_payments ap
                                       where ap.appointment_id = a.id and ap.voided_at is null), 0))
             order by a.starts_at)
      from public.appointments a
      where a.establishment_id = p_establishment_id and a.status <> 'cancelled'
        and a.starts_at < upper(v_day) and a.ends_at > lower(v_day)
        and (v_scope is null or a.professional_id = v_scope)
    ), '[]'::jsonb)
  );
end;
$$;

-- Indicadores do período (datas locais, inclusivas): Previsto × Realizado × Recebido (D19).
create or replace function public.get_dashboard(p_establishment_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_scope uuid := private.read_scope(p_establishment_id);
  v_tz    text;
  v_range tstzrange;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  select timezone into v_tz from public.establishments where id = p_establishment_id;
  v_range := tstzrange(lower(private.local_day(p_from, v_tz)), upper(private.local_day(p_to, v_tz)), '[)');

  return (
    with appts as (
      select a.* from public.appointments a
      where a.establishment_id = p_establishment_id and v_range @> a.starts_at
        and (v_scope is null or a.professional_id = v_scope)
    ),
    pays as (
      select ap.*, a.professional_id
      from public.appointment_payments ap
      join public.appointments a on a.id = ap.appointment_id
      where ap.establishment_id = p_establishment_id and ap.voided_at is null and v_range @> ap.received_at
        and (v_scope is null or a.professional_id = v_scope)
    )
    select jsonb_build_object(
      'expected_cents', coalesce((select sum(price_cents_snapshot) from appts where status <> 'cancelled'), 0),
      'realized_cents', coalesce((select sum(final_price_cents) from appts where status = 'completed'), 0),
      'received_cents', coalesce((select sum(amount_cents) from pays), 0),
      'appointments', (select count(*) from appts where status <> 'cancelled'),
      'by_status', coalesce((select jsonb_object_agg(status, n) from (
                      select status, count(*) n from appts group by status) s), '{}'::jsonb),
      'by_method', coalesce((select jsonb_object_agg(method, cents) from (
                      select method, sum(amount_cents) cents from pays group by method) m), '{}'::jsonb),
      'completed_without_payment', (
        select count(*) from appts a where a.status = 'completed' and not exists (
          select 1 from public.appointment_payments ap where ap.appointment_id = a.id and ap.voided_at is null)),
      'by_professional', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', p.id, 'display_name', p.display_name,
                 'appointments', (select count(*) from appts a where a.professional_id = p.id and a.status <> 'cancelled'),
                 'realized_cents', coalesce((select sum(final_price_cents) from appts a
                                             where a.professional_id = p.id and a.status = 'completed'), 0),
                 'received_cents', coalesce((select sum(amount_cents) from pays x where x.professional_id = p.id), 0))
               order by p.sort_order, p.display_name)
        from public.professionals p
        where p.establishment_id = p_establishment_id and (v_scope is null or p.id = v_scope)
          and (p.is_active or exists (select 1 from appts a where a.professional_id = p.id))
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon;

revoke execute on function public.complete_appointment(uuid, integer, jsonb, integer) from public, anon;
revoke execute on function public.record_appointment_payment(uuid, integer, public.pos_payment_method, text) from public, anon;
revoke execute on function public.void_appointment_payment(uuid, text) from public, anon;
revoke execute on function public.get_agenda_day(uuid, date) from public, anon;
revoke execute on function public.get_dashboard(uuid, date, date) from public, anon;

grant execute on function public.complete_appointment(uuid, integer, jsonb, integer) to authenticated;
grant execute on function public.record_appointment_payment(uuid, integer, public.pos_payment_method, text) to authenticated;
grant execute on function public.void_appointment_payment(uuid, text) to authenticated;
grant execute on function public.get_agenda_day(uuid, date) to authenticated;
grant execute on function public.get_dashboard(uuid, date, date) to authenticated;
