-- =============================================================================
-- 11 · Clientes, agendamentos, eventos e tokens de acesso (Fase 4 · E4-5)
-- Referência: DATABASE.md §5.17–§5.20, §8, §9
-- Escritas somente via RPC; a API só lê (conforme o papel).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Clientes do estabelecimento (sem conta)
-- -----------------------------------------------------------------------------
create table public.customers (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  full_name        text not null check (char_length(full_name) between 1 and 120),
  phone_e164       text check (phone_e164 is null or private.is_e164(phone_e164)),
  email            extensions.citext check (email is null or char_length(email) <= 254),
  internal_notes   text check (internal_notes is null or char_length(internal_notes) <= 2000),
  created_source   public.appointment_source not null,
  anonymized_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint customers_tenant_uk unique (establishment_id, id)
);

create unique index customers_phone_uk on public.customers (establishment_id, phone_e164)
  where phone_e164 is not null and anonymized_at is null;
create index customers_name_idx on public.customers (establishment_id, lower(full_name) text_pattern_ops);

create trigger customers_set_updated_at before update on public.customers
  for each row execute function private.set_updated_at();
create trigger customers_tenant before update on public.customers
  for each row execute function private.prevent_tenant_change();

-- -----------------------------------------------------------------------------
-- Agendamentos
-- -----------------------------------------------------------------------------
create table public.appointments (
  id                          uuid primary key default gen_random_uuid(),
  establishment_id            uuid not null references public.establishments (id) on delete cascade,
  professional_id             uuid not null,
  service_id                  uuid not null,
  customer_id                 uuid not null,
  reference_code              text not null check (reference_code ~ '^[0-9A-HJKMNP-TV-Z]{8}$'),
  starts_at                   timestamptz not null,
  ends_at                     timestamptz not null,
  occupied_range              tstzrange not null,
  status                      public.appointment_status not null default 'confirmed',
  source                      public.appointment_source not null,
  professional_auto_assigned  boolean not null default false,
  outside_working_hours       boolean not null default false,
  service_name_snapshot       text not null,
  price_cents_snapshot        integer not null check (price_cents_snapshot >= 0),
  final_price_cents           integer check (final_price_cents is null or final_price_cents >= 0),
  duration_minutes_snapshot   smallint not null,
  buffer_before_snapshot      smallint not null default 0,
  buffer_after_snapshot       smallint not null default 0,
  customer_name_snapshot      text not null,
  customer_phone_snapshot     text,
  customer_notes              text check (customer_notes is null or char_length(customer_notes) <= 500),
  internal_notes              text check (internal_notes is null or char_length(internal_notes) <= 1000),
  cancelled_at                timestamptz,
  cancelled_by_type           public.actor_type,
  cancellation_reason         text check (cancellation_reason is null or char_length(cancellation_reason) <= 300),
  created_by                  uuid references public.profiles (id) on delete set null,
  version                     integer not null default 1,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint appointments_tenant_uk unique (establishment_id, id),
  constraint appointments_reference_uk unique (establishment_id, reference_code),
  constraint appointments_professional_fk foreign key (establishment_id, professional_id)
    references public.professionals (establishment_id, id),
  constraint appointments_service_fk foreign key (establishment_id, service_id)
    references public.services (establishment_id, id),
  constraint appointments_customer_fk foreign key (establishment_id, customer_id)
    references public.customers (establishment_id, id),
  constraint appointments_time_order check (starts_at < ends_at),
  constraint appointments_occupied_covers check (
    lower_inc(occupied_range) and not upper_inc(occupied_range)
    and lower(occupied_range) <= starts_at and upper(occupied_range) >= ends_at
  ),
  constraint appointments_cancel_shape check ((status = 'cancelled') = (cancelled_at is not null)),
  -- Barreira final contra sobreposição (DATABASE §8).
  constraint appointments_no_overlap exclude using gist (
    professional_id with =, occupied_range with &&
  ) where (status <> 'cancelled')
);

create index appointments_establishment_start_idx on public.appointments (establishment_id, starts_at);
create index appointments_professional_start_idx on public.appointments (professional_id, starts_at);
create index appointments_customer_idx on public.appointments (customer_id, starts_at desc);
create index appointments_status_idx on public.appointments (establishment_id, status, starts_at);

create trigger appointments_tenant before update on public.appointments
  for each row execute function private.prevent_tenant_change();

-- Versão (concorrência otimista na UI) e updated_at.
create or replace function private.bump_appointment_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger appointments_bump_version before update on public.appointments
  for each row execute function private.bump_appointment_version();

-- Máquina de status (DATABASE §9). Espelhada em src/modules/appointments/rules.ts.
create or replace function private.appointment_transition_allowed(
  p_from public.appointment_status,
  p_to   public.appointment_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from, p_to) in (
    ('pending'::public.appointment_status, 'confirmed'::public.appointment_status),
    ('pending', 'cancelled'),
    ('confirmed', 'in_progress'),
    ('confirmed', 'cancelled'),
    ('confirmed', 'no_show'),
    ('in_progress', 'completed')
  );
$$;

create or replace function private.enforce_appointment_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if not private.appointment_transition_allowed(old.status, new.status) then
      raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
    end if;
    -- Início do atendimento: até 15 min antes do horário. Falta: só depois do horário.
    if new.status = 'in_progress' and now() < old.starts_at - interval '15 minutes' then
      raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
    end if;
    if new.status = 'no_show' and now() < old.starts_at then
      raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
    end if;
  end if;

  -- Horário e profissional só mudam enquanto o agendamento não começou.
  if (new.starts_at, new.professional_id) is distinct from (old.starts_at, old.professional_id)
     and old.status not in ('pending', 'confirmed') then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
  end if;
  return new;
end;
$$;

create trigger appointments_status_transition before update on public.appointments
  for each row execute function private.enforce_appointment_status_transition();

-- -----------------------------------------------------------------------------
-- Eventos do agendamento (append-only)
-- -----------------------------------------------------------------------------
create table public.appointment_events (
  id                       bigint generated always as identity primary key,
  establishment_id         uuid not null,
  appointment_id           uuid not null,
  event_type               text not null check (event_type in ('created', 'status_changed', 'rescheduled', 'updated', 'cancelled')),
  from_status              public.appointment_status,
  to_status                public.appointment_status,
  previous_starts_at       timestamptz,
  new_starts_at            timestamptz,
  previous_professional_id uuid,
  new_professional_id      uuid,
  actor_type               public.actor_type not null,
  actor_user_id            uuid,
  note                     text check (note is null or char_length(note) <= 300),
  created_at               timestamptz not null default now(),
  constraint appointment_events_appointment_fk foreign key (establishment_id, appointment_id)
    references public.appointments (establishment_id, id) on delete cascade
);

create index appointment_events_appointment_idx on public.appointment_events (appointment_id, created_at);

create trigger appointment_events_append_only before update or delete on public.appointment_events
  for each row execute function private.forbid_update_delete();

-- -----------------------------------------------------------------------------
-- Tokens de gestão da reserva pelo cliente (Fase 5). Sem acesso pela API.
-- -----------------------------------------------------------------------------
create table public.appointment_access_tokens (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  appointment_id   uuid not null,
  token_hash       bytea not null unique,
  expires_at       timestamptz not null,
  revoked_at       timestamptz,
  last_used_at     timestamptz,
  created_at       timestamptz not null default now(),
  constraint appointment_access_tokens_appointment_fk foreign key (establishment_id, appointment_id)
    references public.appointments (establishment_id, id) on delete cascade
);

create index appointment_access_tokens_appointment_idx on public.appointment_access_tokens (appointment_id);

-- -----------------------------------------------------------------------------
-- Profissional com agendamentos futuros não pode ser desativado (E3-4).
-- -----------------------------------------------------------------------------
create or replace function private.guard_professional_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_active and not new.is_active and exists (
    select 1 from public.appointments a
    where a.professional_id = new.id
      and a.status in ('pending', 'confirmed', 'in_progress')
      and a.ends_at > now()
  ) then
    raise exception using errcode = 'P0001', message = 'HAS_FUTURE_APPOINTMENTS';
  end if;
  return new;
end;
$$;

create trigger professionals_guard_deactivation before update of is_active on public.professionals
  for each row execute function private.guard_professional_deactivation();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.customers                 enable row level security;
alter table public.appointments              enable row level security;
alter table public.appointment_events        enable row level security;
alter table public.appointment_access_tokens enable row level security;

-- Clientes: owner/admin. A visão do staff (sem notas internas) entra com a tela de clientes (E3-9);
-- até lá o staff usa os dados copiados no próprio agendamento.
create policy customers_select on public.customers for select to authenticated
  using ((select private.is_establishment_admin(establishment_id)));

create policy appointments_select on public.appointments for select to authenticated
  using (
    (select private.is_establishment_admin(establishment_id))
    or professional_id = (select private.my_professional_id(establishment_id))
  );

create policy appointment_events_select on public.appointment_events for select to authenticated
  using (
    (select private.is_establishment_admin(establishment_id))
    or exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and a.professional_id = (select private.my_professional_id(a.establishment_id))
    )
  );
-- appointment_access_tokens: nenhuma política (somente service_role / RPCs).

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke all on public.customers, public.appointments, public.appointment_events,
              public.appointment_access_tokens from anon, authenticated;
grant select on public.customers, public.appointments, public.appointment_events to authenticated;
grant select, insert, update, delete on public.customers, public.appointments,
      public.appointment_access_tokens to service_role;
grant select, insert on public.appointment_events to service_role;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.appointment_transition_allowed(public.appointment_status, public.appointment_status)
  to authenticated, service_role;
