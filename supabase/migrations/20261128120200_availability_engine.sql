-- =============================================================================
-- 12 · Motor de disponibilidade e RPCs de agenda (Fase 4 · E4-4, E4-6, E4-7)
-- Referência: DATABASE.md §7–§10
--
-- A MESMA lógica (private.free_time) é usada para listar horários e para validar a reserva.
-- Modo "painel" (p_panel = true): equipe agendando pelo painel — ignora antecedência mínima,
-- limite de dias à frente e a visibilidade pública de serviço/profissional.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Conversões de data/hora local (fuso do estabelecimento; correto em horário de verão)
-- -----------------------------------------------------------------------------
create or replace function private.local_instant(p_date date, p_time time, p_tz text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (p_date + p_time) at time zone p_tz;
$$;

create or replace function private.local_day(p_date date, p_tz text)
returns tstzrange
language sql
stable
set search_path = ''
as $$
  select tstzrange(p_date::timestamp at time zone p_tz, (p_date + 1)::timestamp at time zone p_tz, '[)');
$$;

-- -----------------------------------------------------------------------------
-- Núcleo (DATABASE §7.2)
-- -----------------------------------------------------------------------------

-- Horário do estabelecimento no dia: exceção da data, senão horário semanal.
create or replace function private.establishment_hours(p_establishment_id uuid, p_date date, p_tz text)
returns tstzmultirange
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case
      when exists (
        select 1 from public.establishment_date_overrides o
        where o.establishment_id = p_establishment_id and o.date = p_date
      ) then (
        select range_agg(tstzrange(private.local_instant(p_date, o.start_time, p_tz),
                                   private.local_instant(p_date, o.end_time, p_tz), '[)'))
        from public.establishment_date_overrides o
        where o.establishment_id = p_establishment_id and o.date = p_date and o.kind = 'custom_hours'
      )
      else (
        select range_agg(tstzrange(private.local_instant(p_date, h.start_time, p_tz),
                                   private.local_instant(p_date, h.end_time, p_tz), '[)'))
        from public.establishment_working_hours h
        where h.establishment_id = p_establishment_id and h.weekday = extract(dow from p_date)::smallint
      )
    end,
    '{}'::tstzmultirange
  );
$$;

-- Jornada do profissional no dia: exceção da data, senão jornada semanal própria;
-- sem jornada própria cadastrada, segue o estabelecimento (dia inteiro, recortado depois). D23.
create or replace function private.professional_hours(p_professional_id uuid, p_date date, p_tz text)
returns tstzmultirange
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case
      when exists (
        select 1 from public.professional_date_overrides o
        where o.professional_id = p_professional_id and o.date = p_date
      ) then (
        select range_agg(tstzrange(private.local_instant(p_date, o.start_time, p_tz),
                                   private.local_instant(p_date, o.end_time, p_tz), '[)'))
        from public.professional_date_overrides o
        where o.professional_id = p_professional_id and o.date = p_date and o.kind = 'custom_hours'
      )
      when exists (
        select 1 from public.professional_working_hours h where h.professional_id = p_professional_id
      ) then (
        select range_agg(tstzrange(private.local_instant(p_date, h.start_time, p_tz),
                                   private.local_instant(p_date, h.end_time, p_tz), '[)'))
        from public.professional_working_hours h
        where h.professional_id = p_professional_id and h.weekday = extract(dow from p_date)::smallint
      )
      else tstzmultirange(private.local_day(p_date, p_tz))
    end,
    '{}'::tstzmultirange
  );
$$;

-- Tempo de trabalho = estabelecimento ∩ profissional.
create or replace function private.work_time(
  p_establishment_id uuid, p_professional_id uuid, p_date date, p_tz text
)
returns tstzmultirange
language sql
stable
security definer
set search_path = ''
as $$
  select private.establishment_hours(p_establishment_id, p_date, p_tz)
       * private.professional_hours(p_professional_id, p_date, p_tz);
$$;

-- Ocupado: bloqueios (do profissional e do estabelecimento) + agendamentos não cancelados.
create or replace function private.professional_busy(
  p_establishment_id uuid, p_professional_id uuid, p_range tstzrange, p_exclude_appointment uuid default null
)
returns tstzmultirange
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(range_agg(r), '{}'::tstzmultirange)
  from (
    select b.period as r
    from public.availability_blocks b
    where b.establishment_id = p_establishment_id
      and (b.professional_id = p_professional_id or b.professional_id is null)
      and b.period && p_range
    union all
    select a.occupied_range
    from public.appointments a
    where a.professional_id = p_professional_id
      and a.status <> 'cancelled'
      and a.occupied_range && p_range
      and a.id is distinct from p_exclude_appointment
  ) s;
$$;

-- Livre = trabalho − ocupado (a janela de ocupação cobre o dia com folga para buffers).
create or replace function private.free_time(
  p_establishment_id uuid, p_professional_id uuid, p_date date, p_tz text,
  p_exclude_appointment uuid default null
)
returns tstzmultirange
language sql
stable
security definer
set search_path = ''
as $$
  select private.work_time(p_establishment_id, p_professional_id, p_date, p_tz)
       - private.professional_busy(
           p_establishment_id, p_professional_id,
           tstzrange(lower(private.local_day(p_date, p_tz)) - interval '1 day',
                     upper(private.local_day(p_date, p_tz)) + interval '1 day', '[)'),
           p_exclude_appointment);
$$;

-- Estabelecimento, serviço e profissional aptos? Retorna o código de erro ou null.
create or replace function private.booking_entities_error(
  p_establishment_id uuid, p_service_id uuid, p_professional_id uuid, p_panel boolean
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.establishments e where e.id = p_establishment_id and e.status = 'active'
  ) then
    return 'ESTABLISHMENT_UNAVAILABLE';
  end if;
  if not exists (
    select 1 from public.services s
    where s.id = p_service_id and s.establishment_id = p_establishment_id
      and s.is_active and s.archived_at is null and (p_panel or s.is_public)
  ) then
    return 'SERVICE_UNAVAILABLE';
  end if;
  if not exists (
    select 1 from public.professionals p
    join public.professional_services ps
      on ps.professional_id = p.id and ps.service_id = p_service_id
    where p.id = p_professional_id and p.establishment_id = p_establishment_id
      and p.is_active and (p_panel or p.is_bookable)
  ) then
    return 'PROFESSIONAL_UNAVAILABLE';
  end if;
  return null;
end;
$$;

-- Horários de início disponíveis (DATABASE §7.3).
create or replace function private.available_slots(
  p_establishment_id    uuid,
  p_service_id          uuid,
  p_professional_id     uuid,
  p_date                date,
  p_panel               boolean default false,
  p_now                 timestamptz default now(),
  p_exclude_appointment uuid default null
)
returns setof timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz        text;
  v_settings  public.establishment_settings;
  v_service   public.services;
  v_today     date;
  v_day       tstzrange;
  v_free      tstzmultirange;
  v_min_start timestamptz;
  v_before    interval;
  v_after     interval;
begin
  if private.booking_entities_error(p_establishment_id, p_service_id, p_professional_id, p_panel) is not null then
    return;
  end if;

  select e.timezone into v_tz from public.establishments e where e.id = p_establishment_id;
  select * into v_settings from public.establishment_settings s where s.establishment_id = p_establishment_id;
  select * into v_service from public.services s where s.id = p_service_id;

  v_today := (p_now at time zone v_tz)::date;
  if p_date < v_today or (not p_panel and p_date > v_today + v_settings.max_booking_days_ahead) then
    return;
  end if;

  v_day := private.local_day(p_date, v_tz);
  v_free := private.free_time(p_establishment_id, p_professional_id, p_date, v_tz, p_exclude_appointment);
  if isempty(v_free) then
    return;
  end if;

  v_min_start := case when p_panel then p_now
                      else p_now + make_interval(mins => v_settings.min_booking_notice_minutes) end;
  v_before := make_interval(mins => v_service.buffer_before_minutes);
  v_after := make_interval(mins => v_service.duration_minutes + v_service.buffer_after_minutes);

  return query
    select t
    from generate_series(lower(v_day), upper(v_day) - interval '1 minute',
                         make_interval(mins => v_settings.slot_interval_minutes)) as t
    where t >= v_min_start
      and v_free @> tstzrange(t - v_before, t + v_after, '[)')
    order by t;
end;
$$;

-- Validação de um horário específico (mesma lógica da listagem). Retorna código de erro ou null.
-- No painel o horário não precisa estar na grade; na página pública, precisa.
create or replace function private.booking_error(
  p_establishment_id    uuid,
  p_service_id          uuid,
  p_professional_id     uuid,
  p_starts_at           timestamptz,
  p_panel               boolean default false,
  p_now                 timestamptz default now(),
  p_exclude_appointment uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_error    text;
  v_tz       text;
  v_settings public.establishment_settings;
  v_service  public.services;
  v_date     date;
  v_today    date;
  v_offset   integer;
begin
  v_error := private.booking_entities_error(p_establishment_id, p_service_id, p_professional_id, p_panel);
  if v_error is not null then
    return v_error;
  end if;

  select e.timezone into v_tz from public.establishments e where e.id = p_establishment_id;
  select * into v_settings from public.establishment_settings s where s.establishment_id = p_establishment_id;
  select * into v_service from public.services s where s.id = p_service_id;

  if date_trunc('minute', p_starts_at) <> p_starts_at then
    return 'SLOT_UNAVAILABLE';
  end if;

  v_date := (p_starts_at at time zone v_tz)::date;
  v_today := (p_now at time zone v_tz)::date;
  if p_starts_at < p_now
     or (not p_panel and p_starts_at < p_now + make_interval(mins => v_settings.min_booking_notice_minutes))
     or (not p_panel and v_date > v_today + v_settings.max_booking_days_ahead) then
    return 'OUTSIDE_BOOKING_WINDOW';
  end if;

  if not p_panel then
    v_offset := extract(epoch from (p_starts_at - lower(private.local_day(v_date, v_tz))))::integer / 60;
    if v_offset % v_settings.slot_interval_minutes <> 0 then
      return 'SLOT_UNAVAILABLE';
    end if;
  end if;

  if not private.free_time(p_establishment_id, p_professional_id, v_date, v_tz, p_exclude_appointment)
         @> tstzrange(p_starts_at - make_interval(mins => v_service.buffer_before_minutes),
                      p_starts_at + make_interval(mins => v_service.duration_minutes + v_service.buffer_after_minutes),
                      '[)') then
    return 'SLOT_UNAVAILABLE';
  end if;
  return null;
end;
$$;

-- Profissionais que podem realizar o serviço ("qualquer profissional"), em ordem de id (locks).
create or replace function private.candidate_professionals(
  p_establishment_id uuid, p_service_id uuid, p_panel boolean
)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.professionals p
  join public.professional_services ps on ps.professional_id = p.id and ps.service_id = p_service_id
  where p.establishment_id = p_establishment_id and p.is_active and (p_panel or p.is_bookable)
  order by p.id;
$$;

-- Serializa operações de agenda do mesmo profissional (DATABASE §8, camada 1).
create or replace function private.lock_professional(p_professional_id uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('professional:' || p_professional_id::text, 0));
$$;

-- Trava todos os profissionais do estabelecimento (ou só um), sempre em ordem de id.
create or replace function private.lock_schedule_scope(p_establishment_id uuid, p_professional_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in
    select p.id from public.professionals p
    where p.establishment_id = p_establishment_id
      and (p_professional_id is null or p.id = p_professional_id)
    order by p.id
  loop
    perform private.lock_professional(v_id);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Conflitos após mudanças de disponibilidade (DATABASE §7.6)
-- -----------------------------------------------------------------------------
create or replace function private.appointment_conflicts(
  p_establishment_id uuid, p_professional_id uuid, p_from timestamptz default now()
)
returns table (
  appointment_id    uuid,
  professional_id   uuid,
  professional_name text,
  starts_at         timestamptz,
  ends_at           timestamptz,
  service_name      text,
  customer_name     text,
  reason            text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.professional_id, p.display_name, a.starts_at, a.ends_at,
         a.service_name_snapshot, a.customer_name_snapshot,
         case
           when not (private.work_time(a.establishment_id, a.professional_id,
                                       (a.starts_at at time zone e.timezone)::date, e.timezone)
                     @> a.occupied_range) then 'outside_hours'
           else 'blocked'
         end
  from public.appointments a
  join public.establishments e on e.id = a.establishment_id
  join public.professionals p on p.id = a.professional_id
  where a.establishment_id = p_establishment_id
    and (p_professional_id is null or a.professional_id = p_professional_id)
    and a.status in ('pending', 'confirmed')
    and a.ends_at > p_from
    and not a.outside_working_hours
    and (
      not (private.work_time(a.establishment_id, a.professional_id,
                             (a.starts_at at time zone e.timezone)::date, e.timezone)
           @> a.occupied_range)
      or exists (
        select 1 from public.availability_blocks b
        where b.establishment_id = a.establishment_id
          and (b.professional_id = a.professional_id or b.professional_id is null)
          and b.period && a.occupied_range
      )
    )
  order by a.starts_at;
$$;

-- Conflitos novos (ausentes de p_before) em JSON, para a pré-visualização.
create or replace function private.new_conflicts_json(
  p_establishment_id uuid, p_professional_id uuid, p_before uuid[]
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'appointment_id', c.appointment_id,
           'professional_id', c.professional_id,
           'professional_name', c.professional_name,
           'starts_at', c.starts_at,
           'ends_at', c.ends_at,
           'service_name', c.service_name,
           'customer_name', c.customer_name,
           'reason', c.reason
         ) order by c.starts_at), '[]'::jsonb)
  from private.appointment_conflicts(p_establishment_id, p_professional_id, now()) c
  where not (c.appointment_id = any (coalesce(p_before, '{}')));
$$;

create or replace function private.conflict_ids(p_establishment_id uuid, p_professional_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(c.appointment_id), '{}')
  from private.appointment_conflicts(p_establishment_id, p_professional_id, now()) c;
$$;

-- -----------------------------------------------------------------------------
-- Autorização de agenda
-- p_area: 'hours' (jornada e exceções) ou 'blocks' (bloqueios)
-- Estabelecimento (p_professional_id nulo): owner/admin.
-- Profissional: owner/admin; o próprio profissional se a configuração permitir.
-- -----------------------------------------------------------------------------
create or replace function private.assert_can_manage_schedule(
  p_establishment_id uuid, p_professional_id uuid, p_area text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_allowed boolean;
begin
  if p_professional_id is not null and not exists (
    select 1 from public.professionals p
    where p.id = p_professional_id and p.establishment_id = p_establishment_id
  ) then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if private.is_establishment_admin(p_establishment_id) then
    return;
  end if;

  if p_professional_id is null or private.my_professional_id(p_establishment_id) is distinct from p_professional_id then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  select case when p_area = 'blocks' then s.staff_can_manage_own_blocks else s.staff_can_manage_own_hours end
    into v_allowed
  from public.establishment_settings s where s.establishment_id = p_establishment_id;

  if not coalesce(v_allowed, false) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
end;
$$;

-- Valida e normaliza intervalos [{start:'09:00', end:'12:00', weekday?:1}].
create or replace function private.parse_intervals(p_intervals jsonb, p_with_weekday boolean)
returns table (weekday smallint, start_time time, end_time time)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_item jsonb;
  v_start time;
  v_end time;
  v_weekday smallint;
begin
  if p_intervals is null or jsonb_typeof(p_intervals) <> 'array' or jsonb_array_length(p_intervals) > 50 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  for v_item in select * from jsonb_array_elements(p_intervals)
  loop
    begin
      v_start := (v_item ->> 'start')::time;
      v_end := (v_item ->> 'end')::time;
      v_weekday := case when p_with_weekday then (v_item ->> 'weekday')::smallint end;
    exception when others then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end;
    if v_start is null or v_end is null or v_start >= v_end
       or (p_with_weekday and (v_weekday is null or v_weekday not between 0 and 6)) then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
    weekday := v_weekday;
    start_time := v_start;
    end_time := v_end;
    return next;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs de horários (E4-2, E4-3). Retornam {saved, conflicts}.
-- Com p_confirm = false e conflitos novos, nada é salvo (pré-visualização).
-- Nada é cancelado automaticamente.
-- -----------------------------------------------------------------------------
create or replace function public.save_weekly_hours(
  p_establishment_id uuid,
  p_professional_id  uuid,
  p_intervals        jsonb,
  p_confirm          boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before    uuid[];
  v_conflicts jsonb := '[]'::jsonb;
begin
  perform private.assert_can_manage_schedule(p_establishment_id, p_professional_id, 'hours');
  perform private.lock_schedule_scope(p_establishment_id, p_professional_id);
  v_before := private.conflict_ids(p_establishment_id, p_professional_id);

  begin
    if p_professional_id is null then
      delete from public.establishment_working_hours where establishment_id = p_establishment_id;
      insert into public.establishment_working_hours (establishment_id, weekday, start_time, end_time)
      select p_establishment_id, i.weekday, i.start_time, i.end_time from private.parse_intervals(p_intervals, true) i;
    else
      delete from public.professional_working_hours where professional_id = p_professional_id;
      insert into public.professional_working_hours (establishment_id, professional_id, weekday, start_time, end_time)
      select p_establishment_id, p_professional_id, i.weekday, i.start_time, i.end_time
      from private.parse_intervals(p_intervals, true) i;
    end if;

    v_conflicts := private.new_conflicts_json(p_establishment_id, p_professional_id, v_before);
    if not p_confirm and jsonb_array_length(v_conflicts) > 0 then
      raise exception using errcode = 'P0001', message = '__PREVIEW__';
    end if;
  exception
    when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'OVERLAPPING_INTERVALS';
    when raise_exception then
      if sqlerrm = '__PREVIEW__' then
        return jsonb_build_object('saved', false, 'conflicts', v_conflicts);
      end if;
      raise;
  end;

  perform private.write_audit('schedule.weekly_hours_saved', p_establishment_id,
    case when p_professional_id is null then 'establishment' else 'professional' end,
    coalesce(p_professional_id, p_establishment_id),
    jsonb_build_object('intervals', jsonb_array_length(p_intervals), 'conflicts', jsonb_array_length(v_conflicts)));
  return jsonb_build_object('saved', true, 'conflicts', v_conflicts);
end;
$$;

create or replace function public.save_date_override(
  p_establishment_id uuid,
  p_professional_id  uuid,
  p_date             date,
  p_kind             public.date_override_kind,
  p_intervals        jsonb,
  p_label            text,
  p_confirm          boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before    uuid[];
  v_conflicts jsonb := '[]'::jsonb;
  v_label     text := nullif(trim(p_label), '');
begin
  perform private.assert_can_manage_schedule(p_establishment_id, p_professional_id, 'hours');
  if p_date is null or p_kind is null or char_length(coalesce(v_label, '')) > 80 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  perform private.lock_schedule_scope(p_establishment_id, p_professional_id);
  v_before := private.conflict_ids(p_establishment_id, p_professional_id);

  begin
    if p_professional_id is null then
      delete from public.establishment_date_overrides where establishment_id = p_establishment_id and date = p_date;
      if p_kind = 'closed' then
        insert into public.establishment_date_overrides (establishment_id, date, kind, label, created_by)
        values (p_establishment_id, p_date, 'closed', v_label, (select auth.uid()));
      else
        insert into public.establishment_date_overrides (establishment_id, date, kind, start_time, end_time, label, created_by)
        select p_establishment_id, p_date, 'custom_hours', i.start_time, i.end_time, v_label, (select auth.uid())
        from private.parse_intervals(p_intervals, false) i;
      end if;
    else
      delete from public.professional_date_overrides where professional_id = p_professional_id and date = p_date;
      if p_kind = 'closed' then
        insert into public.professional_date_overrides (establishment_id, professional_id, date, kind, label, created_by)
        values (p_establishment_id, p_professional_id, p_date, 'closed', v_label, (select auth.uid()));
      else
        insert into public.professional_date_overrides
          (establishment_id, professional_id, date, kind, start_time, end_time, label, created_by)
        select p_establishment_id, p_professional_id, p_date, 'custom_hours', i.start_time, i.end_time, v_label,
               (select auth.uid())
        from private.parse_intervals(p_intervals, false) i;
      end if;
    end if;

    if p_kind = 'custom_hours' and jsonb_array_length(p_intervals) = 0 then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;

    v_conflicts := private.new_conflicts_json(p_establishment_id, p_professional_id, v_before);
    if not p_confirm and jsonb_array_length(v_conflicts) > 0 then
      raise exception using errcode = 'P0001', message = '__PREVIEW__';
    end if;
  exception
    when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'OVERLAPPING_INTERVALS';
    when raise_exception then
      if sqlerrm = '__PREVIEW__' then
        return jsonb_build_object('saved', false, 'conflicts', v_conflicts);
      end if;
      raise;
  end;

  perform private.write_audit('schedule.date_override_saved', p_establishment_id,
    case when p_professional_id is null then 'establishment' else 'professional' end,
    coalesce(p_professional_id, p_establishment_id),
    jsonb_build_object('date', p_date, 'kind', p_kind));
  return jsonb_build_object('saved', true, 'conflicts', v_conflicts);
end;
$$;

create or replace function public.delete_date_override(
  p_establishment_id uuid, p_professional_id uuid, p_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_can_manage_schedule(p_establishment_id, p_professional_id, 'hours');
  perform private.lock_schedule_scope(p_establishment_id, p_professional_id);
  if p_professional_id is null then
    delete from public.establishment_date_overrides where establishment_id = p_establishment_id and date = p_date;
  else
    delete from public.professional_date_overrides where professional_id = p_professional_id and date = p_date;
  end if;
  perform private.write_audit('schedule.date_override_deleted', p_establishment_id,
    case when p_professional_id is null then 'establishment' else 'professional' end,
    coalesce(p_professional_id, p_establishment_id), jsonb_build_object('date', p_date));
end;
$$;

-- Bloqueios (criar ou editar). Podem ficar sobre agendamentos (com confirmação).
create or replace function public.save_availability_block(
  p_establishment_id uuid,
  p_block_id         uuid,
  p_professional_id  uuid,
  p_starts_at        timestamptz,
  p_ends_at          timestamptz,
  p_all_day          boolean,
  p_kind             public.block_kind,
  p_reason           text,
  p_confirm          boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing  public.availability_blocks;
  v_before    uuid[];
  v_conflicts jsonb := '[]'::jsonb;
  v_id        uuid := p_block_id;
begin
  if p_block_id is not null then
    select * into v_existing from public.availability_blocks
    where id = p_block_id and establishment_id = p_establishment_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    -- Quem não pode gerenciar o bloqueio original também não pode movê-lo.
    perform private.assert_can_manage_schedule(p_establishment_id, v_existing.professional_id, 'blocks');
  end if;
  perform private.assert_can_manage_schedule(p_establishment_id, p_professional_id, 'blocks');

  if p_starts_at is null or p_ends_at is null or p_starts_at >= p_ends_at
     or p_ends_at - p_starts_at > interval '366 days' or char_length(coalesce(p_reason, '')) > 200 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  perform private.lock_schedule_scope(p_establishment_id, p_professional_id);
  if v_existing.professional_id is distinct from p_professional_id and p_block_id is not null then
    perform private.lock_schedule_scope(p_establishment_id, v_existing.professional_id);
  end if;
  v_before := private.conflict_ids(p_establishment_id, p_professional_id);

  begin
    if p_block_id is null then
      insert into public.availability_blocks
        (establishment_id, professional_id, period, all_day, kind, reason, created_by)
      values (p_establishment_id, p_professional_id, tstzrange(p_starts_at, p_ends_at, '[)'),
              coalesce(p_all_day, false), coalesce(p_kind, 'other'), nullif(trim(p_reason), ''),
              (select auth.uid()))
      returning id into v_id;
    else
      update public.availability_blocks
         set professional_id = p_professional_id,
             period = tstzrange(p_starts_at, p_ends_at, '[)'),
             all_day = coalesce(p_all_day, false),
             kind = coalesce(p_kind, 'other'),
             reason = nullif(trim(p_reason), '')
       where id = p_block_id;
    end if;

    v_conflicts := private.new_conflicts_json(p_establishment_id, p_professional_id, v_before);
    if not p_confirm and jsonb_array_length(v_conflicts) > 0 then
      raise exception using errcode = 'P0001', message = '__PREVIEW__';
    end if;
  exception
    when raise_exception then
      if sqlerrm = '__PREVIEW__' then
        return jsonb_build_object('saved', false, 'conflicts', v_conflicts);
      end if;
      raise;
  end;

  perform private.write_audit('schedule.block_saved', p_establishment_id, 'availability_block', v_id,
    jsonb_build_object('kind', coalesce(p_kind, 'other'), 'professional_id', p_professional_id));
  return jsonb_build_object('saved', true, 'id', v_id, 'conflicts', v_conflicts);
end;
$$;

create or replace function public.delete_availability_block(p_block_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_block public.availability_blocks;
begin
  select * into v_block from public.availability_blocks where id = p_block_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  perform private.assert_can_manage_schedule(v_block.establishment_id, v_block.professional_id, 'blocks');
  delete from public.availability_blocks where id = p_block_id;
  perform private.write_audit('schedule.block_deleted', v_block.establishment_id, 'availability_block', p_block_id,
    jsonb_build_object('kind', v_block.kind));
end;
$$;

-- -----------------------------------------------------------------------------
-- Consultas de disponibilidade para a equipe (modo painel)
-- -----------------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_establishment_id uuid,
  p_service_id       uuid,
  p_professional_id  uuid,
  p_date             date
)
returns table (starts_at timestamptz, professional_ids uuid[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_member(p_establishment_id) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  return query
    select s.t, array_agg(c.id order by c.id)
    from (
      select p_professional_id as id where p_professional_id is not null
      union all
      select x from private.candidate_professionals(p_establishment_id, p_service_id, true) x
      where p_professional_id is null
    ) c
    cross join lateral private.available_slots(p_establishment_id, p_service_id, c.id, p_date, true) as s(t)
    group by s.t
    order by s.t;
end;
$$;

create or replace function public.get_schedule_conflicts(p_establishment_id uuid)
returns table (
  appointment_id    uuid,
  professional_id   uuid,
  professional_name text,
  starts_at         timestamptz,
  ends_at           timestamptz,
  service_name      text,
  customer_name     text,
  reason            text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_scope uuid;
begin
  if private.is_establishment_admin(p_establishment_id) then
    v_scope := null;
  else
    v_scope := private.my_professional_id(p_establishment_id);
    if v_scope is null then
      raise exception using errcode = 'P0001', message = 'FORBIDDEN';
    end if;
  end if;
  return query select * from private.appointment_conflicts(p_establishment_id, v_scope, now());
end;
$$;

-- -----------------------------------------------------------------------------
-- Agendamentos (E4-6)
-- -----------------------------------------------------------------------------

-- Código legível de 8 caracteres (Crockford Base32). Não é segredo.
create or replace function private.new_reference_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', (get_byte(b, i) % 32) + 1, 1), '' order by i)
  from (select extensions.gen_random_bytes(8) as b) r, generate_series(0, 7) as i;
$$;

-- Cliente por telefone normalizado (deduplicação); sem telefone, sempre cria.
create or replace function private.find_or_create_customer(
  p_establishment_id uuid,
  p_name             text,
  p_phone_e164       text,
  p_email            text,
  p_source           public.appointment_source
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_name  text := trim(p_name);
  v_phone text := nullif(trim(p_phone_e164), '');
begin
  if v_name is null or char_length(v_name) not between 1 and 120
     or (v_phone is not null and not private.is_e164(v_phone)) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if v_phone is not null then
    select c.id into v_id from public.customers c
    where c.establishment_id = p_establishment_id and c.phone_e164 = v_phone and c.anonymized_at is null;
    if found then
      return v_id;
    end if;
  end if;

  insert into public.customers (establishment_id, full_name, phone_e164, email, created_source)
  values (p_establishment_id, v_name, v_phone, nullif(trim(p_email), ''), p_source)
  on conflict (establishment_id, phone_e164) where phone_e164 is not null and anonymized_at is null
  do update set updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.appointment_actor_type()
returns public.actor_type
language sql
stable
set search_path = ''
as $$
  select case when (select auth.uid()) is null then 'system'::public.actor_type else 'member'::public.actor_type end;
$$;

-- Criação pelo painel. Staff só agenda para si; encaixe fora do expediente só owner/admin.
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
  v_service     public.services;
  v_customer    public.customers;
  v_customer_id uuid;
  v_pro         uuid := p_professional_id;
  v_auto        boolean := p_professional_id is null;
  v_candidate   uuid;
  v_error       text;
  v_last_error  text := 'SLOT_UNAVAILABLE';
  v_tz          text;
  v_id          uuid;
  v_code        text;
  v_outside     boolean := coalesce(p_outside_working_hours, false);
  v_ends_at     timestamptz;
  v_occupied    tstzrange;
  v_attempt     integer := 0;
begin
  -- Autorização
  if not v_is_admin then
    if v_my_pro is null then
      raise exception using errcode = 'P0001', message = 'FORBIDDEN';
    end if;
    if v_outside or (p_professional_id is not null and p_professional_id <> v_my_pro) or p_customer_id is not null then
      raise exception using errcode = 'P0001', message = 'FORBIDDEN';
    end if;
    v_pro := v_my_pro;
    v_auto := false;
  end if;

  if p_starts_at is null or char_length(coalesce(p_customer_notes, '')) > 500
     or char_length(coalesce(p_internal_notes, '')) > 1000 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select e.timezone into v_tz from public.establishments e where e.id = p_establishment_id and e.status = 'active';
  if not found then
    raise exception using errcode = 'P0001', message = 'ESTABLISHMENT_UNAVAILABLE';
  end if;

  select * into v_service from public.services s
  where s.id = p_service_id and s.establishment_id = p_establishment_id and s.is_active and s.archived_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'SERVICE_UNAVAILABLE';
  end if;

  -- Cliente
  if p_customer_id is not null then
    select * into v_customer from public.customers c
    where c.id = p_customer_id and c.establishment_id = p_establishment_id and c.anonymized_at is null;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
  else
    v_customer_id := private.find_or_create_customer(
      p_establishment_id, p_customer_name, p_customer_phone, p_customer_email,
      case when v_is_admin then 'admin_panel'::public.appointment_source
           else 'professional_panel'::public.appointment_source end);
    select * into v_customer from public.customers c where c.id = v_customer_id;
  end if;

  -- Profissional: escolhido, ou "qualquer profissional" (DATABASE §7.4)
  if v_auto then
    if v_outside then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;
    for v_candidate in select private.candidate_professionals(p_establishment_id, p_service_id, true)
    loop
      perform private.lock_professional(v_candidate);
    end loop;

    select c.id into v_pro
    from private.candidate_professionals(p_establishment_id, p_service_id, true) as c(id)
    join public.professionals p on p.id = c.id
    where private.booking_error(p_establishment_id, p_service_id, c.id, p_starts_at, true) is null
    order by (
      select count(*) from public.appointments a
      where a.professional_id = c.id and a.status <> 'cancelled'
        and (a.starts_at at time zone v_tz)::date = (p_starts_at at time zone v_tz)::date
    ), p.sort_order, p.id
    limit 1;

    if v_pro is null then
      raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE';
    end if;
  else
    perform private.lock_professional(v_pro);
    if v_outside then
      v_error := private.booking_entities_error(p_establishment_id, p_service_id, v_pro, true);
      if v_error is null and p_starts_at < now() - interval '1 day' then
        v_error := 'OUTSIDE_BOOKING_WINDOW';
      end if;
    else
      v_error := private.booking_error(p_establishment_id, p_service_id, v_pro, p_starts_at, true);
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
        p_establishment_id, v_pro, p_service_id, v_customer.id, v_code,
        p_starts_at, v_ends_at, v_occupied, 'confirmed',
        case when v_is_admin then 'admin_panel'::public.appointment_source else 'professional_panel'::public.appointment_source end,
        v_auto, v_outside,
        v_service.name, v_service.price_cents, v_service.duration_minutes,
        v_service.buffer_before_minutes, v_service.buffer_after_minutes,
        coalesce(nullif(trim(p_customer_name), ''), v_customer.full_name),
        coalesce(nullif(trim(p_customer_phone), ''), v_customer.phone_e164),
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
    (establishment_id, appointment_id, event_type, to_status, new_starts_at, new_professional_id, actor_type, actor_user_id)
  values (p_establishment_id, v_id, 'created', 'confirmed', p_starts_at, v_pro,
          private.appointment_actor_type(), (select auth.uid()));

  return jsonb_build_object('id', v_id, 'reference_code', v_code, 'professional_id', v_pro,
                            'starts_at', p_starts_at, 'ends_at', v_ends_at);
end;
$$;

-- Autorização sobre um agendamento existente: owner/admin ou o profissional responsável.
create or replace function private.assert_can_manage_appointment(p_appointment public.appointments)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.is_establishment_admin(p_appointment.establishment_id) then
    return;
  end if;
  if private.my_professional_id(p_appointment.establishment_id) is distinct from p_appointment.professional_id then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
end;
$$;

-- Reagendamento atômico (UPDATE da mesma linha; falha mantém o original). DATABASE §8.
create or replace function public.reschedule_appointment(
  p_appointment_id        uuid,
  p_starts_at             timestamptz,
  p_professional_id       uuid,
  p_expected_version      integer,
  p_outside_working_hours boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt    public.appointments;
  v_pro     uuid;
  v_outside boolean := coalesce(p_outside_working_hours, false);
  v_error   text;
  v_ends_at timestamptz;
begin
  select * into v_appt from public.appointments where id = p_appointment_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  perform private.assert_can_manage_appointment(v_appt);

  v_pro := coalesce(p_professional_id, v_appt.professional_id);
  if not private.is_establishment_admin(v_appt.establishment_id)
     and (v_pro <> v_appt.professional_id or v_outside) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  -- Locks em ordem de id (evita deadlock em reagendamentos cruzados).
  perform private.lock_professional(x) from unnest(array[least(v_pro, v_appt.professional_id),
                                                         greatest(v_pro, v_appt.professional_id)]) as x;

  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if p_expected_version is not null and v_appt.version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'STALE_VERSION';
  end if;
  if v_appt.status not in ('pending', 'confirmed') then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
  end if;

  if v_outside then
    v_error := private.booking_entities_error(v_appt.establishment_id, v_appt.service_id, v_pro, true);
  else
    v_error := private.booking_error(v_appt.establishment_id, v_appt.service_id, v_pro, p_starts_at, true,
                                     now(), v_appt.id);
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
                                      v_ends_at + make_interval(mins => v_appt.buffer_after_snapshot), '[)'),
           professional_id = v_pro,
           professional_auto_assigned = professional_auto_assigned and v_pro = v_appt.professional_id,
           outside_working_hours = v_outside
     where id = p_appointment_id;
  exception
    when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE';
  end;

  insert into public.appointment_events
    (establishment_id, appointment_id, event_type, previous_starts_at, new_starts_at,
     previous_professional_id, new_professional_id, actor_type, actor_user_id)
  values (v_appt.establishment_id, v_appt.id, 'rescheduled', v_appt.starts_at, p_starts_at,
          v_appt.professional_id, v_pro, private.appointment_actor_type(), (select auth.uid()));

  return jsonb_build_object('id', v_appt.id, 'starts_at', p_starts_at, 'ends_at', v_ends_at,
                            'professional_id', v_pro, 'version', v_appt.version + 1);
end;
$$;

-- Mudança de status (inclui cancelamento). A transição é validada pelo trigger (DATABASE §9).
create or replace function public.update_appointment_status(
  p_appointment_id   uuid,
  p_status           public.appointment_status,
  p_note             text,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_note text := nullif(trim(p_note), '');
begin
  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  perform private.assert_can_manage_appointment(v_appt);

  if p_expected_version is not null and v_appt.version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'STALE_VERSION';
  end if;
  if char_length(coalesce(v_note, '')) > 300 or p_status is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  if p_status = v_appt.status then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
  end if;

  update public.appointments
     set status = p_status,
         cancelled_at = case when p_status = 'cancelled' then now() end,
         cancelled_by_type = case when p_status = 'cancelled' then private.appointment_actor_type() end,
         cancellation_reason = case when p_status = 'cancelled' then v_note end,
         final_price_cents = case when p_status = 'completed'
                                  then coalesce(final_price_cents, price_cents_snapshot)
                                  else final_price_cents end
   where id = p_appointment_id;

  insert into public.appointment_events
    (establishment_id, appointment_id, event_type, from_status, to_status, actor_type, actor_user_id, note)
  values (v_appt.establishment_id, v_appt.id,
          case when p_status = 'cancelled' then 'cancelled' else 'status_changed' end,
          v_appt.status, p_status, private.appointment_actor_type(), (select auth.uid()), v_note);

  return jsonb_build_object('id', v_appt.id, 'status', p_status, 'version', v_appt.version + 1);
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon;

grant execute on function private.local_instant(date, time, text) to service_role;
grant execute on function private.local_day(date, text) to service_role;
grant execute on function private.establishment_hours(uuid, date, text) to service_role;
grant execute on function private.professional_hours(uuid, date, text) to service_role;
grant execute on function private.work_time(uuid, uuid, date, text) to service_role;
grant execute on function private.professional_busy(uuid, uuid, tstzrange, uuid) to service_role;
grant execute on function private.free_time(uuid, uuid, date, text, uuid) to service_role;
grant execute on function private.booking_entities_error(uuid, uuid, uuid, boolean) to service_role;
grant execute on function private.available_slots(uuid, uuid, uuid, date, boolean, timestamptz, uuid) to service_role;
grant execute on function private.booking_error(uuid, uuid, uuid, timestamptz, boolean, timestamptz, uuid) to service_role;
grant execute on function private.candidate_professionals(uuid, uuid, boolean) to service_role;
grant execute on function private.appointment_conflicts(uuid, uuid, timestamptz) to service_role;

revoke execute on function public.save_weekly_hours(uuid, uuid, jsonb, boolean) from public, anon;
revoke execute on function public.save_date_override(uuid, uuid, date, public.date_override_kind, jsonb, text, boolean) from public, anon;
revoke execute on function public.delete_date_override(uuid, uuid, date) from public, anon;
revoke execute on function public.save_availability_block(uuid, uuid, uuid, timestamptz, timestamptz, boolean, public.block_kind, text, boolean) from public, anon;
revoke execute on function public.delete_availability_block(uuid) from public, anon;
revoke execute on function public.get_available_slots(uuid, uuid, uuid, date) from public, anon;
revoke execute on function public.get_schedule_conflicts(uuid) from public, anon;
revoke execute on function public.create_appointment(uuid, uuid, uuid, timestamptz, uuid, text, text, text, text, text, boolean) from public, anon;
revoke execute on function public.reschedule_appointment(uuid, timestamptz, uuid, integer, boolean) from public, anon;
revoke execute on function public.update_appointment_status(uuid, public.appointment_status, text, integer) from public, anon;

grant execute on function public.save_weekly_hours(uuid, uuid, jsonb, boolean) to authenticated;
grant execute on function public.save_date_override(uuid, uuid, date, public.date_override_kind, jsonb, text, boolean) to authenticated;
grant execute on function public.delete_date_override(uuid, uuid, date) to authenticated;
grant execute on function public.save_availability_block(uuid, uuid, uuid, timestamptz, timestamptz, boolean, public.block_kind, text, boolean) to authenticated;
grant execute on function public.delete_availability_block(uuid) to authenticated;
grant execute on function public.get_available_slots(uuid, uuid, uuid, date) to authenticated;
grant execute on function public.get_schedule_conflicts(uuid) to authenticated;
grant execute on function public.create_appointment(uuid, uuid, uuid, timestamptz, uuid, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.reschedule_appointment(uuid, timestamptz, uuid, integer, boolean) to authenticated;
grant execute on function public.update_appointment_status(uuid, public.appointment_status, text, integer) to authenticated;
