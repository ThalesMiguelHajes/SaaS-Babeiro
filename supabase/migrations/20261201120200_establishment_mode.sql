-- =============================================================================
-- 17 · Modo do estabelecimento aplicado às regras existentes (B1-3)
-- Referência: BILLING.md §12 — fonte única: private.establishment_mode()
-- Funções recriadas a partir das versões anteriores, com a checagem de modo.
-- =============================================================================

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

  -- Modo do estabelecimento (BILLING §12): restrito não cria novos agendamentos.
  perform private.assert_not_restricted(p_establishment_id);
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
  where e.slug = lower(p_slug) and e.status = 'active' and s.public_booking_enabled
    and (
      private.establishment_mode(e.id) = 'operational'
      or (private.establishment_mode(e.id) = 'setup'
          and coalesce((private.current_subscription(e.id)).public_booking_in_setup, false))
    );
$$;

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
    if private.public_bookable_establishment(
         (select slug from public.establishments where id = p_appointment.establishment_id)) is null then
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
      'booking_enabled', private.public_bookable_establishment(e.slug) is not null
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

  perform private.assert_not_restricted(p_establishment_id);
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

-- Serviços novos não são cadastrados em modo restrito (profissionais: trigger de limite).
drop policy services_insert on public.services;
create policy services_insert on public.services for insert to authenticated
  with check (
    (select private.is_establishment_admin(establishment_id))
    and private.establishment_mode(establishment_id) not in ('restricted', 'disabled')
  );

revoke execute on all functions in schema private from public, anon;
grant execute on function private.establishment_mode(uuid) to authenticated, service_role;
grant execute on function private.billing_cycle_start(date, integer, public.billing_interval, integer) to authenticated, service_role;
