-- =============================================================================
-- 13 · Agendamento público (Fase 5 · E5-1, E5-2)
-- Referência: DATABASE.md §10.4, SECURITY.md §7–§8
--
-- RPCs públicas: executáveis SOMENTE pela service_role (chamadas pelo servidor Next.js).
-- DTOs mínimos: nunca notas internas, motivo de bloqueio, dados de outros clientes ou
-- quem ocupa um horário.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Rate limiting (SECURITY §8)
-- -----------------------------------------------------------------------------
create table private.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 1,
  primary key (key, window_start)
);

-- Conta uma tentativa na janela atual; acima do limite lança RATE_LIMITED.
-- Como a exceção desfaz a transação, o contador para no limite até a janela virar.
create or replace function private.check_rate_limit(p_key text, p_window_seconds integer, p_max_hits integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits   integer;
begin
  if p_key is null then
    return;
  end if;
  insert into private.rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;

  -- Limpeza oportunista (o pg_cron assume isso na Fase 7).
  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '1 day';
  end if;

  if v_hits > p_max_hits then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Núcleo de criação de agendamento (compartilhado por painel e página pública)
-- Pressupõe autorização já verificada pelo chamador.
-- -----------------------------------------------------------------------------
create or replace function private.book_appointment(
  p_establishment_id uuid,
  p_service_id       uuid,
  p_professional_id  uuid,          -- null = qualquer profissional
  p_starts_at        timestamptz,
  p_customer_id      uuid,
  p_customer_name    text,
  p_customer_phone   text,
  p_customer_notes   text,
  p_internal_notes   text,
  p_source           public.appointment_source,
  p_status           public.appointment_status,
  p_panel            boolean,
  p_outside          boolean,
  p_actor            public.actor_type
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_service   public.services;
  v_tz        text;
  v_pro       uuid := p_professional_id;
  v_auto      boolean := p_professional_id is null;
  v_candidate uuid;
  v_error     text;
  v_id        uuid;
  v_code      text;
  v_ends_at   timestamptz;
  v_occupied  tstzrange;
  v_attempt   integer := 0;
begin
  select e.timezone into v_tz from public.establishments e
  where e.id = p_establishment_id and e.status = 'active';
  if not found then
    raise exception using errcode = 'P0001', message = 'ESTABLISHMENT_UNAVAILABLE';
  end if;

  select * into v_service from public.services s
  where s.id = p_service_id and s.establishment_id = p_establishment_id
    and s.is_active and s.archived_at is null and (p_panel or s.is_public);
  if not found then
    raise exception using errcode = 'P0001', message = 'SERVICE_UNAVAILABLE';
  end if;

  if v_auto then
    if p_outside then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
    -- "Qualquer profissional": trava todos os candidatos em ordem de id (DATABASE §7.4).
    for v_candidate in select private.candidate_professionals(p_establishment_id, p_service_id, p_panel)
    loop
      perform private.lock_professional(v_candidate);
    end loop;

    select c.id into v_pro
    from private.candidate_professionals(p_establishment_id, p_service_id, p_panel) as c(id)
    join public.professionals p on p.id = c.id
    where private.booking_error(p_establishment_id, p_service_id, c.id, p_starts_at, p_panel) is null
    order by (
      select count(*) from public.appointments a
      where a.professional_id = c.id and a.status <> 'cancelled'
        and (a.starts_at at time zone v_tz)::date = (p_starts_at at time zone v_tz)::date
    ), p.sort_order, p.id
    limit 1;

    if v_pro is null then
      -- Distingue "fora da janela" de "ocupado" para a mensagem ao cliente.
      select private.booking_error(p_establishment_id, p_service_id, c.id, p_starts_at, p_panel)
        into v_error
      from private.candidate_professionals(p_establishment_id, p_service_id, p_panel) as c(id)
      limit 1;
      raise exception using errcode = 'P0001',
        message = case when v_error = 'OUTSIDE_BOOKING_WINDOW' then v_error else 'SLOT_UNAVAILABLE' end;
    end if;
  else
    perform private.lock_professional(v_pro);
    if p_outside then
      v_error := private.booking_entities_error(p_establishment_id, p_service_id, v_pro, true);
      if v_error is null and p_starts_at < now() - interval '1 day' then
        v_error := 'OUTSIDE_BOOKING_WINDOW';
      end if;
    else
      v_error := private.booking_error(p_establishment_id, p_service_id, v_pro, p_starts_at, p_panel);
    end if;
    if v_error is not null then
      raise exception using errcode = 'P0001', message = v_error;
    end if;
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);
  v_occupied := tstzrange(p_starts_at - make_interval(mins => v_service.buffer_before_minutes),
                          v_ends_at + make_interval(mins => v_service.buffer_after_minutes), '[)');

  loop
    v_attempt := v_attempt + 1;
    v_code := private.new_reference_code();
    begin
      insert into public.appointments (
        establishment_id, professional_id, service_id, customer_id, reference_code,
        starts_at, ends_at, occupied_range, status, source,
        professional_auto_assigned, outside_working_hours,
        service_name_snapshot, price_cents_snapshot, duration_minutes_snapshot,
        buffer_before_snapshot, buffer_after_snapshot,
        customer_name_snapshot, customer_phone_snapshot, customer_notes, internal_notes, created_by
      ) values (
        p_establishment_id, v_pro, p_service_id, p_customer_id, v_code,
        p_starts_at, v_ends_at, v_occupied, p_status, p_source,
        v_auto, p_outside,
        v_service.name, v_service.price_cents, v_service.duration_minutes,
        v_service.buffer_before_minutes, v_service.buffer_after_minutes,
        p_customer_name, p_customer_phone,
        nullif(trim(p_customer_notes), ''), nullif(trim(p_internal_notes), ''), (select auth.uid())
      )
      returning id into v_id;
      exit;
    exception
      when exclusion_violation then
        raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE';
      when unique_violation then
        if v_attempt >= 5 then
          raise;
        end if;
    end;
  end loop;

  insert into public.appointment_events
    (establishment_id, appointment_id, event_type, to_status, new_starts_at, new_professional_id,
     actor_type, actor_user_id)
  values (p_establishment_id, v_id, 'created', p_status, p_starts_at, v_pro, p_actor, (select auth.uid()));

  return jsonb_build_object('id', v_id, 'reference_code', v_code, 'professional_id', v_pro,
                            'starts_at', p_starts_at, 'ends_at', v_ends_at, 'status', p_status);
end;
$$;

-- Painel: mesma assinatura e regras da Fase 4, agora sobre o núcleo compartilhado.
create or replace function public.create_appointment(
  p_establishment_id      uuid,
  p_service_id            uuid,
  p_professional_id       uuid,
  p_starts_at             timestamptz,
  p_customer_id           uuid,
  p_customer_name         text,
  p_customer_phone        text,
  p_customer_email        text,
  p_customer_notes        text,
  p_internal_notes        text,
  p_outside_working_hours boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin    boolean := private.is_establishment_admin(p_establishment_id);
  v_my_pro      uuid := private.my_professional_id(p_establishment_id);
  v_pro         uuid := p_professional_id;
  v_outside     boolean := coalesce(p_outside_working_hours, false);
  v_source      public.appointment_source;
  v_customer    public.customers;
  v_customer_id uuid;
begin
  if not v_is_admin then
    if v_my_pro is null then
      raise exception using errcode = 'P0001', message = 'FORBIDDEN';
    end if;
    if v_outside or (p_professional_id is not null and p_professional_id <> v_my_pro) or p_customer_id is not null then
      raise exception using errcode = 'P0001', message = 'FORBIDDEN';
    end if;
    v_pro := v_my_pro;
  end if;
  v_source := case when v_is_admin then 'admin_panel'::public.appointment_source
                   else 'professional_panel'::public.appointment_source end;

  if p_starts_at is null or char_length(coalesce(p_customer_notes, '')) > 500
     or char_length(coalesce(p_internal_notes, '')) > 1000 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if not exists (select 1 from public.establishments e where e.id = p_establishment_id and e.status = 'active') then
    raise exception using errcode = 'P0001', message = 'ESTABLISHMENT_UNAVAILABLE';
  end if;

  if p_customer_id is not null then
    select * into v_customer from public.customers c
    where c.id = p_customer_id and c.establishment_id = p_establishment_id and c.anonymized_at is null;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
  else
    v_customer_id := private.find_or_create_customer(
      p_establishment_id, p_customer_name, p_customer_phone, p_customer_email, v_source);
    select * into v_customer from public.customers c where c.id = v_customer_id;
  end if;

  return private.book_appointment(
    p_establishment_id, p_service_id, v_pro, p_starts_at, v_customer.id,
    coalesce(nullif(trim(p_customer_name), ''), v_customer.full_name),
    coalesce(nullif(trim(p_customer_phone), ''), v_customer.phone_e164),
    p_customer_notes, p_internal_notes, v_source, 'confirmed', true, v_outside,
    private.appointment_actor_type());
end;
$$;

-- -----------------------------------------------------------------------------
-- Auxiliares públicos
-- -----------------------------------------------------------------------------

-- Estabelecimento que aceita reservas pela página pública (ativo e com a página ligada).
create or replace function private.public_bookable_establishment(p_slug text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.establishments e
  join public.establishment_settings s on s.establishment_id = e.id
  where e.slug = lower(p_slug) and e.status = 'active' and s.public_booking_enabled;
$$;

-- Horários públicos de um dia ("qualquer profissional" = união dos candidatos).
create or replace function private.public_slots(
  p_establishment_id uuid, p_service_id uuid, p_professional_id uuid, p_date date
)
returns setof timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select distinct s.t
  from (
    select p_professional_id as id where p_professional_id is not null
    union all
    select x from private.candidate_professionals(p_establishment_id, p_service_id, false) x
    where p_professional_id is null
  ) c
  cross join lateral private.available_slots(p_establishment_id, p_service_id, c.id, p_date, false) as s(t)
  order by s.t;
$$;

-- Regras de alteração pelo cliente (SECURITY §7): retorna null se permitido ou o código de erro.
create or replace function private.customer_change_error(p_appointment public.appointments, p_kind text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_settings public.establishment_settings;
  v_status   public.establishment_status;
begin
  select * into v_settings from public.establishment_settings where establishment_id = p_appointment.establishment_id;
  select status into v_status from public.establishments where id = p_appointment.establishment_id;

  if v_status = 'deactivated' then
    return 'ESTABLISHMENT_UNAVAILABLE';
  end if;
  if p_appointment.status not in ('pending', 'confirmed') then
    return 'INVALID_STATUS_TRANSITION';
  end if;
  if p_kind = 'cancel' and not v_settings.allow_customer_cancellation then
    return 'POLICY_VIOLATION';
  end if;
  if p_kind = 'reschedule' then
    if v_status <> 'active' or not v_settings.public_booking_enabled then
      return 'ESTABLISHMENT_UNAVAILABLE';
    end if;
    if not v_settings.allow_customer_reschedule then
      return 'POLICY_VIOLATION';
    end if;
  end if;
  if now() > p_appointment.starts_at - make_interval(mins => v_settings.customer_change_notice_minutes) then
    return 'POLICY_VIOLATION';
  end if;
  return null;
end;
$$;

-- Agendamento pelo token (válido, não revogado, não expirado), com limite por token e IP.
create or replace function private.appointment_by_token(p_token text, p_ip_hash text)
returns public.appointments
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hash  bytea;
  v_appt  public.appointments;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    return null;
  end if;
  v_hash := private.hash_token(p_token);
  perform private.check_rate_limit('token:' || encode(v_hash, 'hex'), 3600, 20);
  perform private.check_rate_limit('token-ip:' || p_ip_hash, 3600, 30);

  select a.* into v_appt
  from public.appointment_access_tokens t
  join public.appointments a on a.id = t.appointment_id
  where t.token_hash = v_hash and t.revoked_at is null and t.expires_at > now();
  if not found then
    return null;
  end if;

  update public.appointment_access_tokens set last_used_at = now() where token_hash = v_hash;
  return v_appt;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs públicas (DATABASE §10.4) — somente service_role
-- -----------------------------------------------------------------------------

-- Página do estabelecimento: dados públicos, serviços, profissionais e horários. Null se não existe
-- ou está desativado (404). Suspenso ou com a página desligada → booking_enabled = false (aviso).
create or replace function public.public_get_booking_page(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'establishment', jsonb_build_object(
      'slug', e.slug, 'name', e.name, 'description', e.description,
      'logo_path', e.logo_path, 'cover_path', e.cover_path, 'accent_color', e.accent_color,
      'timezone', e.timezone, 'whatsapp_e164', e.whatsapp_e164, 'phone_e164', e.phone_e164,
      'instagram_handle', e.instagram_handle,
      'address_street', e.address_street, 'address_number', e.address_number,
      'address_complement', e.address_complement, 'address_district', e.address_district,
      'address_city', e.address_city, 'address_state', e.address_state,
      'booking_enabled', e.status = 'active' and s.public_booking_enabled
    ),
    'settings', jsonb_build_object(
      'slot_interval_minutes', s.slot_interval_minutes,
      'min_booking_notice_minutes', s.min_booking_notice_minutes,
      'max_booking_days_ahead', s.max_booking_days_ahead,
      'booking_requires_confirmation', s.booking_requires_confirmation,
      'allow_customer_cancellation', s.allow_customer_cancellation,
      'allow_customer_reschedule', s.allow_customer_reschedule,
      'customer_change_notice_minutes', s.customer_change_notice_minutes,
      'booking_policy_text', s.booking_policy_text
    ),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.sort_order, c.name)
      from public.service_categories c where c.establishment_id = e.id
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', sv.id, 'name', sv.name, 'description', sv.description, 'category_id', sv.category_id,
               'price_cents', sv.price_cents, 'duration_minutes', sv.duration_minutes)
             order by sv.sort_order, sv.name)
      from public.services sv
      where sv.establishment_id = e.id and sv.is_active and sv.is_public and sv.archived_at is null
        and exists (
          select 1 from public.professional_services ps
          join public.professionals p on p.id = ps.professional_id
          where ps.service_id = sv.id and p.is_active and p.is_bookable
        )
    ), '[]'::jsonb),
    'professionals', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'display_name', p.display_name, 'photo_path', p.photo_path,
               'specialties', p.specialties,
               'service_ids', coalesce((select jsonb_agg(ps.service_id) from public.professional_services ps
                                        where ps.professional_id = p.id), '[]'::jsonb))
             order by p.sort_order, p.display_name)
      from public.professionals p
      where p.establishment_id = e.id and p.is_active and p.is_bookable
    ), '[]'::jsonb),
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object('weekday', h.weekday, 'start', to_char(h.start_time, 'HH24:MI'),
                                          'end', to_char(h.end_time, 'HH24:MI'))
             order by h.weekday, h.start_time)
      from public.establishment_working_hours h where h.establishment_id = e.id
    ), '[]'::jsonb)
  )
  from public.establishments e
  join public.establishment_settings s on s.establishment_id = e.id
  where e.slug = lower(p_slug) and e.status <> 'deactivated';
$$;

-- Datas com ao menos um horário (no máximo 62 dias por chamada).
create or replace function public.public_get_available_dates(
  p_slug            text,
  p_service_id      uuid,
  p_professional_id uuid,
  p_from            date,
  p_to              date,
  p_ip_hash         text
)
returns setof date
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_est   uuid := private.public_bookable_establishment(p_slug);
  v_tz    text;
  v_max   smallint;
  v_today date;
  v_d     date;
  v_last  date;
begin
  perform private.check_rate_limit('slots-ip:' || p_ip_hash, 60, 60);
  if v_est is null or p_from is null or p_to is null then
    return;
  end if;
  select e.timezone, s.max_booking_days_ahead into v_tz, v_max
  from public.establishments e join public.establishment_settings s on s.establishment_id = e.id
  where e.id = v_est;

  v_today := (now() at time zone v_tz)::date;
  v_d := greatest(p_from, v_today);
  v_last := least(p_to, v_today + v_max, greatest(p_from, v_today) + 61);
  while v_d <= v_last loop
    if exists (select 1 from private.public_slots(v_est, p_service_id, p_professional_id, v_d)) then
      return next v_d;
    end if;
    v_d := v_d + 1;
  end loop;
end;
$$;

-- Instantes livres de um dia. Nunca revela quem ocupa os horários.
create or replace function public.public_get_available_slots(
  p_slug            text,
  p_service_id      uuid,
  p_professional_id uuid,
  p_date            date,
  p_ip_hash         text
)
returns setof timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_est uuid := private.public_bookable_establishment(p_slug);
begin
  perform private.check_rate_limit('slots-ip:' || p_ip_hash, 60, 60);
  if v_est is null then
    return;
  end if;
  return query select * from private.public_slots(v_est, p_service_id, p_professional_id, p_date);
end;
$$;

-- Reserva pública. Retorna o código e o token de gestão (o token só aparece aqui, uma vez).
create or replace function public.public_create_booking(
  p_slug            text,
  p_service_id      uuid,
  p_professional_id uuid,
  p_starts_at       timestamptz,
  p_customer_name   text,
  p_customer_phone  text,
  p_customer_email  text,
  p_customer_notes  text,
  p_ip_hash         text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_est         uuid;
  v_settings    public.establishment_settings;
  v_customer_id uuid;
  v_active      integer;
  v_result      jsonb;
  v_token       text := private.new_token();
  v_name        text := trim(p_customer_name);
  v_phone       text := nullif(trim(p_customer_phone), '');
begin
  perform private.check_rate_limit('booking-ip:' || p_ip_hash, 3600, 5);

  select e.id into v_est from public.establishments e where e.slug = lower(p_slug) and e.status <> 'deactivated';
  if v_est is null then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if private.public_bookable_establishment(p_slug) is null then
    raise exception using errcode = 'P0001', message = 'ESTABLISHMENT_UNAVAILABLE';
  end if;
  select * into v_settings from public.establishment_settings where establishment_id = v_est;

  if v_name is null or char_length(v_name) not between 2 and 120 or v_phone is null
     or not private.is_e164(v_phone) or char_length(coalesce(p_customer_notes, '')) > 500
     or char_length(coalesce(p_customer_email, '')) > 254 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- Cliente pelo telefone (dados existentes não são sobrescritos) e limite de reservas ativas.
  v_customer_id := private.find_or_create_customer(v_est, v_name, v_phone, p_customer_email, 'public_page');
  perform pg_advisory_xact_lock(hashtextextended('customer:' || v_customer_id::text, 0));
  select count(*) into v_active from public.appointments a
  where a.customer_id = v_customer_id and a.status in ('pending', 'confirmed') and a.starts_at > now();
  if v_active >= v_settings.max_active_bookings_per_customer then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_LIMIT_REACHED';
  end if;

  v_result := private.book_appointment(
    v_est, p_service_id, p_professional_id, p_starts_at, v_customer_id, v_name, v_phone,
    p_customer_notes, null, 'public_page',
    case when v_settings.booking_requires_confirmation then 'pending'::public.appointment_status
         else 'confirmed'::public.appointment_status end,
    false, false, 'customer');

  insert into public.appointment_access_tokens (establishment_id, appointment_id, token_hash, expires_at)
  values (v_est, (v_result ->> 'id')::uuid, private.hash_token(v_token),
          (v_result ->> 'ends_at')::timestamptz + interval '30 days');

  return (v_result - 'id' - 'professional_id') || jsonb_build_object('token', v_token);
end;
$$;

-- Resumo da reserva para o cliente (sem dados de outros clientes nem notas internas).
create or replace function public.public_get_booking(p_token text, p_ip_hash text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments := private.appointment_by_token(p_token, p_ip_hash);
begin
  if v_appt.id is null then
    return null;
  end if;
  return (
    select jsonb_build_object(
      'reference_code', v_appt.reference_code,
      'status', v_appt.status,
      'starts_at', v_appt.starts_at,
      'ends_at', v_appt.ends_at,
      'service_id', v_appt.service_id,
      'service_name', v_appt.service_name_snapshot,
      'price_cents', v_appt.price_cents_snapshot,
      'duration_minutes', v_appt.duration_minutes_snapshot,
      'professional_id', v_appt.professional_id,
      'professional_name', p.display_name,
      'professional_photo_path', p.photo_path,
      'customer_name', v_appt.customer_name_snapshot,
      'customer_notes', v_appt.customer_notes,
      'cancellation_reason', case when v_appt.cancelled_by_type = 'customer' then v_appt.cancellation_reason end,
      'can_cancel', private.customer_change_error(v_appt, 'cancel') is null,
      'can_reschedule', private.customer_change_error(v_appt, 'reschedule') is null,
      'change_notice_minutes', s.customer_change_notice_minutes,
      'establishment', jsonb_build_object(
        'slug', e.slug, 'name', e.name, 'timezone', e.timezone, 'accent_color', e.accent_color,
        'logo_path', e.logo_path, 'whatsapp_e164', e.whatsapp_e164, 'phone_e164', e.phone_e164,
        'address_street', e.address_street, 'address_number', e.address_number,
        'address_district', e.address_district, 'address_city', e.address_city,
        'address_state', e.address_state, 'status', e.status)
    )
    from public.establishments e
    join public.establishment_settings s on s.establishment_id = e.id
    join public.professionals p on p.id = v_appt.professional_id
    where e.id = v_appt.establishment_id
  );
end;
$$;

create or replace function public.public_cancel_booking(p_token text, p_reason text, p_ip_hash text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt   public.appointments := private.appointment_by_token(p_token, p_ip_hash);
  v_error  text;
  v_reason text := nullif(trim(p_reason), '');
begin
  if v_appt.id is null then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if char_length(coalesce(v_reason, '')) > 300 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  select * into v_appt from public.appointments where id = v_appt.id for update;
  v_error := private.customer_change_error(v_appt, 'cancel');
  if v_error is not null then
    raise exception using errcode = 'P0001', message = v_error;
  end if;

  update public.appointments
     set status = 'cancelled', cancelled_at = now(), cancelled_by_type = 'customer',
         cancellation_reason = v_reason
   where id = v_appt.id;

  insert into public.appointment_events
    (establishment_id, appointment_id, event_type, from_status, to_status, actor_type, note)
  values (v_appt.establishment_id, v_appt.id, 'cancelled', v_appt.status, 'cancelled', 'customer', v_reason);

  return jsonb_build_object('status', 'cancelled');
end;
$$;

-- Reagendamento pelo cliente: mesmo profissional, atômico (falha mantém o original).
create or replace function public.public_reschedule_booking(p_token text, p_starts_at timestamptz, p_ip_hash text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt    public.appointments := private.appointment_by_token(p_token, p_ip_hash);
  v_error   text;
  v_ends_at timestamptz;
begin
  if v_appt.id is null then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  perform private.lock_professional(v_appt.professional_id);
  select * into v_appt from public.appointments where id = v_appt.id for update;

  v_error := private.customer_change_error(v_appt, 'reschedule');
  if v_error is null then
    v_error := private.booking_error(v_appt.establishment_id, v_appt.service_id, v_appt.professional_id,
                                     p_starts_at, false, now(), v_appt.id);
  end if;
  if v_error is not null then
    raise exception using errcode = 'P0001', message = v_error;
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_appt.duration_minutes_snapshot);
  begin
    update public.appointments
       set starts_at = p_starts_at,
           ends_at = v_ends_at,
           occupied_range = tstzrange(p_starts_at - make_interval(mins => v_appt.buffer_before_snapshot),
                                      v_ends_at + make_interval(mins => v_appt.buffer_after_snapshot), '[)')
     where id = v_appt.id;
  exception
    when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE';
  end;

  update public.appointment_access_tokens
     set expires_at = v_ends_at + interval '30 days'
   where appointment_id = v_appt.id and revoked_at is null;

  insert into public.appointment_events
    (establishment_id, appointment_id, event_type, previous_starts_at, new_starts_at,
     previous_professional_id, new_professional_id, actor_type)
  values (v_appt.establishment_id, v_appt.id, 'rescheduled', v_appt.starts_at, p_starts_at,
          v_appt.professional_id, v_appt.professional_id, 'customer');

  return jsonb_build_object('starts_at', p_starts_at, 'ends_at', v_ends_at);
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants: RPCs públicas só para a service_role (D6). anon/authenticated sem EXECUTE.
-- -----------------------------------------------------------------------------
revoke all on private.rate_limits from public, anon, authenticated;
grant select, insert, update, delete on private.rate_limits to service_role;

revoke execute on all functions in schema private from public, anon;

revoke execute on function public.public_get_booking_page(text) from public, anon, authenticated;
revoke execute on function public.public_get_available_dates(text, uuid, uuid, date, date, text) from public, anon, authenticated;
revoke execute on function public.public_get_available_slots(text, uuid, uuid, date, text) from public, anon, authenticated;
revoke execute on function public.public_create_booking(text, uuid, uuid, timestamptz, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.public_get_booking(text, text) from public, anon, authenticated;
revoke execute on function public.public_cancel_booking(text, text, text) from public, anon, authenticated;
revoke execute on function public.public_reschedule_booking(text, timestamptz, text) from public, anon, authenticated;

grant execute on function public.public_get_booking_page(text) to service_role;
grant execute on function public.public_get_available_dates(text, uuid, uuid, date, date, text) to service_role;
grant execute on function public.public_get_available_slots(text, uuid, uuid, date, text) to service_role;
grant execute on function public.public_create_booking(text, uuid, uuid, timestamptz, text, text, text, text, text) to service_role;
grant execute on function public.public_get_booking(text, text) to service_role;
grant execute on function public.public_cancel_booking(text, text, text) to service_role;
grant execute on function public.public_reschedule_booking(text, timestamptz, text) to service_role;
