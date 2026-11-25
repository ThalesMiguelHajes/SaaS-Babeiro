-- =============================================================================
-- 03 · Estabelecimentos: establishments, establishment_settings,
--      establishment_members, establishment_invitations + auxiliares de tenant + RLS
-- Referência: DATABASE.md §5.4–§5.7, §10.2, §11; SECURITY.md §3–§6
-- =============================================================================

-- -----------------------------------------------------------------------------
-- establishments
-- -----------------------------------------------------------------------------
create table public.establishments (
  id                  uuid primary key default gen_random_uuid(),
  slug                extensions.citext not null unique
                        check (char_length(slug) between 3 and 60
                               and slug::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name                text not null check (char_length(name) between 2 and 120),
  business_type       public.business_type not null default 'barbershop',
  status              public.establishment_status not null default 'active',
  description         text check (description is null or char_length(description) <= 1000),
  owner_name          text check (owner_name is null or char_length(owner_name) <= 120),
  owner_email         extensions.citext check (owner_email is null or char_length(owner_email) <= 254),
  phone_e164          text check (phone_e164 is null or private.is_e164(phone_e164)),
  whatsapp_e164       text check (whatsapp_e164 is null or private.is_e164(whatsapp_e164)),
  instagram_handle    text check (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'),
  address_street      text check (address_street is null or char_length(address_street) <= 160),
  address_number      text check (address_number is null or char_length(address_number) <= 20),
  address_complement  text check (address_complement is null or char_length(address_complement) <= 80),
  address_district    text check (address_district is null or char_length(address_district) <= 80),
  address_city        text check (address_city is null or char_length(address_city) <= 80),
  address_state       text check (address_state is null or address_state ~ '^[A-Z]{2}$'),
  address_postal_code text check (address_postal_code is null or address_postal_code ~ '^[0-9]{8}$'),
  timezone            text not null default 'America/Sao_Paulo',
  logo_path           text check (logo_path is null or char_length(logo_path) <= 300),
  cover_path          text check (cover_path is null or char_length(cover_path) <= 300),
  accent_color        text not null default '#18181B' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  status_changed_at   timestamptz,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index establishments_status_idx on public.establishments (status);

create trigger establishments_set_updated_at
  before update on public.establishments
  for each row execute function private.set_updated_at();

-- Slug não pode estar na lista reservada; fuso precisa existir.
create or replace function private.validate_establishment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.slug is distinct from old.slug then
    if exists (
      select 1
      from public.platform_settings s,
           jsonb_array_elements_text(s.value) as r(slug)
      where s.key = 'reserved_slugs' and r.slug = new.slug::text
    ) then
      raise exception using errcode = 'P0001', message = 'SLUG_RESERVED';
    end if;
  end if;

  if tg_op = 'INSERT' or new.timezone is distinct from old.timezone then
    if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
      raise exception using errcode = 'P0001', message = 'INVALID_TIMEZONE';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;

  return new;
end;
$$;

create trigger establishments_validate
  before insert or update on public.establishments
  for each row execute function private.validate_establishment();

-- -----------------------------------------------------------------------------
-- establishment_settings (1:1, criada automaticamente)
-- -----------------------------------------------------------------------------
create table public.establishment_settings (
  establishment_id                 uuid primary key references public.establishments (id) on delete cascade,
  slot_interval_minutes            smallint not null default 15 check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  min_booking_notice_minutes       integer  not null default 60 check (min_booking_notice_minutes between 0 and 10080),
  max_booking_days_ahead           smallint not null default 30 check (max_booking_days_ahead between 1 and 365),
  booking_requires_confirmation    boolean  not null default false,
  allow_customer_cancellation      boolean  not null default true,
  allow_customer_reschedule        boolean  not null default true,
  customer_change_notice_minutes   integer  not null default 120 check (customer_change_notice_minutes between 0 and 10080),
  max_active_bookings_per_customer smallint not null default 3 check (max_active_bookings_per_customer between 1 and 50),
  staff_can_manage_own_blocks      boolean  not null default true,
  staff_can_manage_own_hours       boolean  not null default false,
  staff_can_record_payments        boolean  not null default true,
  public_booking_enabled           boolean  not null default true,
  booking_policy_text              text check (booking_policy_text is null or char_length(booking_policy_text) <= 2000),
  updated_at                       timestamptz not null default now()
);

create trigger establishment_settings_set_updated_at
  before update on public.establishment_settings
  for each row execute function private.set_updated_at();

create or replace function private.create_establishment_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.establishment_settings (establishment_id) values (new.id)
  on conflict (establishment_id) do nothing;
  return new;
end;
$$;

create trigger establishments_create_settings
  after insert on public.establishments
  for each row execute function private.create_establishment_settings();

-- -----------------------------------------------------------------------------
-- establishment_members
-- -----------------------------------------------------------------------------
create table public.establishment_members (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  role             public.member_role not null,
  is_active        boolean not null default true,
  invited_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint establishment_members_unique_user unique (establishment_id, user_id),
  constraint establishment_members_tenant_uk unique (establishment_id, id)
);

-- No máximo um owner ativo por estabelecimento.
create unique index establishment_members_single_owner
  on public.establishment_members (establishment_id)
  where role = 'owner' and is_active;

-- Índice crítico para autorização.
create index establishment_members_user_active_idx
  on public.establishment_members (user_id)
  where is_active;

create trigger establishment_members_set_updated_at
  before update on public.establishment_members
  for each row execute function private.set_updated_at();

create trigger establishment_members_tenant_immutable
  before update on public.establishment_members
  for each row execute function private.prevent_tenant_change();

-- Não permitir que o estabelecimento fique sem owner depois de já ter tido um.
-- Verificado ao final da transação (permite transferir a titularidade em uma RPC).
create or replace function private.ensure_owner_remains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner' and old.is_active
     and (tg_op = 'DELETE' or new.role <> 'owner' or not new.is_active) then
    if exists (select 1 from public.establishments e where e.id = old.establishment_id)
       and not exists (
         select 1 from public.establishment_members m
         where m.establishment_id = old.establishment_id and m.role = 'owner' and m.is_active
       ) then
      raise exception using errcode = 'P0001', message = 'LAST_OWNER';
    end if;
  end if;
  return null;
end;
$$;

create constraint trigger establishment_members_owner_remains
  after update or delete on public.establishment_members
  deferrable initially deferred
  for each row execute function private.ensure_owner_remains();

-- -----------------------------------------------------------------------------
-- establishment_invitations
-- (professional_id é adicionado na migration do catálogo, junto com professionals)
-- -----------------------------------------------------------------------------
create table public.establishment_invitations (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  email            extensions.citext not null check (char_length(email) between 3 and 254),
  role             public.member_role not null,
  token_hash       bytea not null unique check (octet_length(token_hash) = 32),
  expires_at       timestamptz not null default (now() + interval '7 days'),
  accepted_at      timestamptz,
  accepted_by      uuid references public.profiles (id) on delete set null,
  revoked_at       timestamptz,
  invited_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint establishment_invitations_tenant_uk unique (establishment_id, id),
  constraint establishment_invitations_final_state check (not (accepted_at is not null and revoked_at is not null))
);

create unique index establishment_invitations_one_pending
  on public.establishment_invitations (establishment_id, email)
  where accepted_at is null and revoked_at is null;

create trigger establishment_invitations_tenant_immutable
  before update on public.establishment_invitations
  for each row execute function private.prevent_tenant_change();

-- -----------------------------------------------------------------------------
-- Auxiliares de autorização do tenant (DATABASE.md §10.2)
-- Vínculo ativo + estabelecimento não desativado.
-- -----------------------------------------------------------------------------
create or replace function private.member_role(p_establishment_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.establishment_members m
  join public.establishments e on e.id = m.establishment_id
  where m.establishment_id = p_establishment_id
    and m.user_id = (select auth.uid())
    and m.is_active
    and e.status <> 'deactivated';
$$;

create or replace function private.is_member(p_establishment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.member_role(p_establishment_id) is not null;
$$;

create or replace function private.has_member_role(p_establishment_id uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.member_role(p_establishment_id) = any (p_roles), false);
$$;

create or replace function private.is_establishment_admin(p_establishment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_member_role(p_establishment_id, array['owner', 'admin']::public.member_role[]);
$$;

create or replace function private.assert_member_role(p_establishment_id uuid, p_roles public.member_role[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_member_role(p_establishment_id, p_roles) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
end;
$$;

-- Usuários que compartilham algum estabelecimento ativo com o usuário atual.
create or replace function private.shares_establishment_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.establishment_members mine
    join public.establishment_members theirs
      on theirs.establishment_id = mine.establishment_id and theirs.is_active
    join public.establishments e on e.id = mine.establishment_id and e.status <> 'deactivated'
    where mine.user_id = (select auth.uid())
      and mine.is_active
      and theirs.user_id = p_user_id
  );
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.member_role(uuid) to authenticated, service_role;
grant execute on function private.is_member(uuid) to authenticated, service_role;
grant execute on function private.has_member_role(uuid, public.member_role[]) to authenticated, service_role;
grant execute on function private.is_establishment_admin(uuid) to authenticated, service_role;
grant execute on function private.assert_member_role(uuid, public.member_role[]) to authenticated, service_role;
grant execute on function private.shares_establishment_with(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Guarda de colunas de establishments
-- Dados cadastrais (nome, slug, status, fuso, tipo, responsável) só pelo Super Admin
-- ou por código privilegiado. O admin do estabelecimento edita apenas o perfil público.
-- -----------------------------------------------------------------------------
-- ATENÇÃO: precisa ser SECURITY INVOKER. Em SECURITY DEFINER, current_user seria o owner da
-- função e is_privileged_context() retornaria sempre verdadeiro.
create or replace function private.guard_establishment_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if private.is_privileged_context() or private.is_platform_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.slug is distinct from old.slug
     or new.name is distinct from old.name
     or new.status is distinct from old.status
     or new.timezone is distinct from old.timezone
     or new.business_type is distinct from old.business_type
     or new.owner_name is distinct from old.owner_name
     or new.owner_email is distinct from old.owner_email
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.status_changed_at is distinct from old.status_changed_at then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN_COLUMN';
  end if;

  return new;
end;
$$;

create trigger establishments_guard_columns
  before update on public.establishments
  for each row execute function private.guard_establishment_columns();

revoke execute on function private.guard_establishment_columns() from public, anon;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke all on public.establishments, public.establishment_settings,
              public.establishment_members, public.establishment_invitations from anon;

-- Criação de estabelecimentos, vínculos e convites: somente via RPC (Fase 2).
revoke insert, delete, truncate on public.establishments from authenticated;
revoke insert, delete, truncate on public.establishment_settings from authenticated;
revoke insert, update, delete, truncate on public.establishment_members from authenticated;
revoke insert, update, delete, truncate on public.establishment_invitations from authenticated;
-- token_hash nunca é lido pela API.
revoke select on public.establishment_invitations from authenticated;
grant select (id, establishment_id, email, role, expires_at, accepted_at, accepted_by,
              revoked_at, invited_by, created_at)
  on public.establishment_invitations to authenticated;
-- establishment_id é imutável em settings.
revoke update on public.establishment_settings from authenticated;
grant update (slot_interval_minutes, min_booking_notice_minutes, max_booking_days_ahead,
              booking_requires_confirmation, allow_customer_cancellation, allow_customer_reschedule,
              customer_change_notice_minutes, max_active_bookings_per_customer,
              staff_can_manage_own_blocks, staff_can_manage_own_hours, staff_can_record_payments,
              public_booking_enabled, booking_policy_text)
  on public.establishment_settings to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.establishments             enable row level security;
alter table public.establishment_settings     enable row level security;
alter table public.establishment_members      enable row level security;
alter table public.establishment_invitations  enable row level security;

-- establishments
create policy establishments_select on public.establishments
  for select to authenticated
  using ((select private.is_member(id)) or (select private.is_platform_admin()));

create policy establishments_update on public.establishments
  for update to authenticated
  using ((select private.is_establishment_admin(id)) or (select private.is_platform_admin()))
  with check ((select private.is_establishment_admin(id)) or (select private.is_platform_admin()));

-- establishment_settings
create policy establishment_settings_select on public.establishment_settings
  for select to authenticated
  using ((select private.is_member(establishment_id)) or (select private.is_platform_admin()));

create policy establishment_settings_update on public.establishment_settings
  for update to authenticated
  using ((select private.is_establishment_admin(establishment_id)) or (select private.is_platform_admin()))
  with check ((select private.is_establishment_admin(establishment_id)) or (select private.is_platform_admin()));

-- establishment_members: membros veem a equipe do próprio estabelecimento; sem escrita pela API.
create policy establishment_members_select on public.establishment_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_member(establishment_id))
    or (select private.is_platform_admin())
  );

-- establishment_invitations: owner/admin do estabelecimento e Super Admin.
create policy establishment_invitations_select on public.establishment_invitations
  for select to authenticated
  using ((select private.is_establishment_admin(establishment_id)) or (select private.is_platform_admin()));

-- profiles: membros veem nome/avatar de quem compartilha estabelecimento.
create policy profiles_select_coworkers on public.profiles
  for select to authenticated
  using ((select private.shares_establishment_with(id)));

-- audit_logs: owner/admin veem os do próprio estabelecimento.
create policy audit_logs_select_establishment on public.audit_logs
  for select to authenticated
  using (establishment_id is not null and (select private.is_establishment_admin(establishment_id)));
