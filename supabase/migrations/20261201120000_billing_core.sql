-- =============================================================================
-- 15 · Financeiro do SaaS — núcleo (B1)
-- Referência: BILLING.md §2–§8, §12, §15
-- Preços e limites vivem no banco (versões de plano), nunca no código.
-- =============================================================================

create type public.subscription_status as enum
  ('pending_activation', 'trialing', 'active', 'past_due', 'suspended', 'canceled');
create type public.billing_interval as enum ('month', 'year');
create type public.establishment_mode as enum ('operational', 'setup', 'restricted', 'disabled');
create type public.add_on_billing_type as enum ('one_time', 'recurring', 'per_unit', 'custom_quote');
create type public.billing_charge_status as enum ('pending', 'invoiced', 'waived', 'covered_by_promotion', 'canceled');
create type public.discount_kind as enum ('percent', 'fixed', 'free');
create type public.discount_duration as enum ('once', 'repeating', 'forever');

-- -----------------------------------------------------------------------------
-- Configurações globais de cobrança (linha única)
-- -----------------------------------------------------------------------------
create table public.billing_settings (
  id                         boolean primary key default true check (id),
  timezone                   text not null default 'America/Sao_Paulo',
  pix_key_type               text check (pix_key_type is null or pix_key_type in ('cpf', 'cnpj', 'email', 'phone', 'random')),
  pix_key                    text check (pix_key is null or char_length(pix_key) <= 140),
  pix_receiver_name          text check (pix_receiver_name is null or char_length(pix_receiver_name) <= 120),
  payment_instructions       text check (payment_instructions is null or char_length(payment_instructions) <= 1000),
  support_whatsapp_e164      text check (support_whatsapp_e164 is null or private.is_e164(support_whatsapp_e164)),
  default_setup_fee_cents    integer not null default 14990 check (default_setup_fee_cents >= 0),
  issue_days_before_due      smallint not null default 5 check (issue_days_before_due between 0 and 28),
  past_due_after_days        smallint not null default 1 check (past_due_after_days between 0 and 60),
  grace_days                 smallint not null default 10 check (grace_days between 0 and 90),
  auto_suspend_enabled       boolean not null default false,
  annual_plans_enabled       boolean not null default false,
  updated_at                 timestamptz not null default now()
);
insert into public.billing_settings (id) values (true);

create trigger billing_settings_set_updated_at before update on public.billing_settings
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Catálogo de funcionalidades e planos versionados
-- -----------------------------------------------------------------------------
create table public.billing_features (
  key            text primary key check (key ~ '^[a-z][a-z0-9_]{2,60}$'),
  name           text not null,
  kind           text not null check (kind in ('boolean', 'limit')),
  is_implemented boolean not null default true
);

create table public.subscription_plans (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  name           text not null check (char_length(name) between 1 and 60),
  description    text check (description is null or char_length(description) <= 500),
  sort_order     smallint not null default 0,
  is_active      boolean not null default true,
  is_promotional boolean not null default false,
  created_at     timestamptz not null default now()
);

create table public.subscription_plan_versions (
  id                             uuid primary key default gen_random_uuid(),
  plan_id                        uuid not null references public.subscription_plans (id),
  version                        integer not null check (version >= 1),
  monthly_price_cents            integer not null check (monthly_price_cents between 0 and 10000000),
  annual_price_cents             integer check (annual_price_cents is null or annual_price_cents between 0 and 100000000),
  included_professionals         smallint not null check (included_professionals between 1 and 1000),
  extra_professional_price_cents integer check (extra_professional_price_cents is null or extra_professional_price_cents between 0 and 1000000),
  is_current                     boolean not null default true,
  created_by                     uuid references public.profiles (id) on delete set null,
  created_at                     timestamptz not null default now(),
  unique (plan_id, version)
);
create unique index subscription_plan_versions_current_uk on public.subscription_plan_versions (plan_id) where is_current;

create table public.subscription_plan_features (
  plan_version_id uuid not null references public.subscription_plan_versions (id),
  feature_key     text not null references public.billing_features (key),
  enabled         boolean not null default true,
  limit_value     integer,
  primary key (plan_version_id, feature_key)
);

-- -----------------------------------------------------------------------------
-- Assinaturas
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  establishment_id       uuid not null references public.establishments (id),
  plan_version_id        uuid not null references public.subscription_plan_versions (id),
  interval               public.billing_interval not null default 'month',
  price_override_cents   integer check (price_override_cents is null or price_override_cents between 0 and 10000000),
  price_override_reason  text check (price_override_reason is null or char_length(price_override_reason) <= 300),
  extra_professionals    smallint not null default 0 check (extra_professionals between 0 and 500),
  status                 public.subscription_status not null default 'pending_activation',
  contracted_at          timestamptz not null default now(),
  activated_at           timestamptz,
  trial_ends_on          date,
  anchor_day             smallint not null check (anchor_day between 1 and 31),
  anchor_date            date not null,
  next_cycle_index       integer not null default 0 check (next_cycle_index >= 0),
  public_booking_in_setup boolean not null default false,
  notes                  text check (notes is null or char_length(notes) <= 2000),
  canceled_at            timestamptz,
  cancel_reason          text,
  suspended_at           timestamptz,
  suspension_reason      text,
  created_by             uuid references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint subscriptions_tenant_uk unique (establishment_id, id),
  constraint subscriptions_override_reason check (price_override_cents is null or price_override_reason is not null)
);
-- No máximo uma assinatura não cancelada por estabelecimento.
create unique index subscriptions_one_open_uk on public.subscriptions (establishment_id) where status <> 'canceled';

create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function private.set_updated_at();
create trigger subscriptions_tenant before update on public.subscriptions
  for each row execute function private.prevent_tenant_change();

create table public.subscription_events (
  id               bigint generated always as identity primary key,
  establishment_id uuid not null,
  subscription_id  uuid not null,
  event_type       text not null,
  from_status      public.subscription_status,
  to_status        public.subscription_status,
  actor_user_id    uuid,
  reason           text,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  constraint subscription_events_subscription_fk foreign key (establishment_id, subscription_id)
    references public.subscriptions (establishment_id, id)
);
create index subscription_events_subscription_idx on public.subscription_events (subscription_id, id);
create trigger subscription_events_append_only before update or delete on public.subscription_events
  for each row execute function private.forbid_update_delete();

-- Versão já usada por assinatura é imutável (editar preço = nova versão).
create or replace function private.guard_plan_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or (
    (new.monthly_price_cents, new.annual_price_cents, new.included_professionals,
     new.extra_professional_price_cents, new.plan_id, new.version)
    is distinct from
    (old.monthly_price_cents, old.annual_price_cents, old.included_professionals,
     old.extra_professional_price_cents, old.plan_id, old.version)
  ) then
    if exists (select 1 from public.subscriptions s where s.plan_version_id = old.id) then
      raise exception using errcode = 'P0001', message = 'PLAN_VERSION_IN_USE';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
create trigger subscription_plan_versions_guard before update or delete on public.subscription_plan_versions
  for each row execute function private.guard_plan_version();

-- -----------------------------------------------------------------------------
-- Serviços adicionais, cobranças únicas, ofertas e descontos
-- -----------------------------------------------------------------------------
create table public.add_on_services (
  id                       uuid primary key default gen_random_uuid(),
  code                     text not null unique,
  name                     text not null,
  description              text,
  price_cents              integer check (price_cents is null or price_cents >= 0),
  price_is_starting_from   boolean not null default false,
  billing_type             public.add_on_billing_type not null,
  unit_label               text,
  is_active                boolean not null default true,
  is_technically_available boolean not null default true,
  sort_order               smallint not null default 0
);

create table public.billing_charges (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id),
  subscription_id  uuid,
  add_on_id        uuid references public.add_on_services (id),
  kind             text not null check (kind in ('setup_fee', 'add_on', 'adjustment')),
  description      text not null check (char_length(description) between 1 and 200),
  quantity         integer not null default 1 check (quantity between 1 and 1000),
  unit_price_cents integer not null check (unit_price_cents between 0 and 100000000),
  status           public.billing_charge_status not null default 'pending',
  invoice_id       uuid,
  notes            text,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint billing_charges_tenant_uk unique (establishment_id, id),
  constraint billing_charges_subscription_fk foreign key (establishment_id, subscription_id)
    references public.subscriptions (establishment_id, id)
);
-- A implantação nunca é cobrada duas vezes na mesma assinatura (F3).
create unique index billing_charges_setup_once_uk on public.billing_charges (subscription_id)
  where kind = 'setup_fee' and status <> 'canceled';

create table public.promotional_offers (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  first_cycle_price_cents  integer not null check (first_cycle_price_cents between 0 and 10000000),
  waives_setup_fee         boolean not null default true,
  ends_on                  date,
  max_redemptions          integer check (max_redemptions is null or max_redemptions > 0),
  is_active                boolean not null default true,
  created_at               timestamptz not null default now()
);

create table public.promotional_offer_plans (
  offer_id uuid not null references public.promotional_offers (id),
  plan_id  uuid not null references public.subscription_plans (id),
  primary key (offer_id, plan_id)
);

create table public.promotion_redemptions (
  id               uuid primary key default gen_random_uuid(),
  offer_id         uuid not null references public.promotional_offers (id),
  establishment_id uuid not null references public.establishments (id),
  subscription_id  uuid not null,
  override_reason  text,
  redeemed_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint promotion_redemptions_subscription_fk foreign key (establishment_id, subscription_id)
    references public.subscriptions (establishment_id, id)
);
-- Uso único por estabelecimento (novo resgate só com justificativa auditada).
create unique index promotion_redemptions_once_uk on public.promotion_redemptions (offer_id, establishment_id)
  where override_reason is null;

create table public.subscription_discounts (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  subscription_id  uuid not null,
  name             text not null check (char_length(name) between 1 and 120),
  kind             public.discount_kind not null,
  value            integer not null default 0 check (value >= 0),
  duration         public.discount_duration not null,
  cycles_total     smallint check (cycles_total is null or cycles_total > 0),
  cycles_applied   smallint not null default 0,
  reason           text not null check (char_length(reason) between 3 and 300),
  granted_by       uuid references public.profiles (id) on delete set null,
  revoked_at       timestamptz,
  created_at       timestamptz not null default now(),
  constraint subscription_discounts_subscription_fk foreign key (establishment_id, subscription_id)
    references public.subscriptions (establishment_id, id),
  constraint subscription_discounts_shape check (
    (kind = 'percent' and value between 1 and 10000) or (kind = 'fixed' and value > 0) or kind = 'free'
  ),
  constraint subscription_discounts_cycles check ((duration = 'repeating') = (cycles_total is not null))
);

-- -----------------------------------------------------------------------------
-- Ciclo de cobrança (BILLING §8.1): sempre a partir da âncora, sem "escorregar"
-- -----------------------------------------------------------------------------
create or replace function private.billing_cycle_start(
  p_anchor_date date, p_anchor_day integer, p_interval public.billing_interval, p_k integer
)
returns date
language sql
immutable
set search_path = ''
as $$
  with m as (
    select (date_trunc('month', p_anchor_date)
            + make_interval(months => p_k * case when p_interval = 'year' then 12 else 1 end))::date as first_day
  )
  select make_date(
    extract(year from first_day)::integer,
    extract(month from first_day)::integer,
    least(p_anchor_day, extract(day from (first_day + interval '1 month' - interval '1 day'))::integer)
  )
  from m;
$$;

-- -----------------------------------------------------------------------------
-- Assinatura vigente, modo do estabelecimento e limites (BILLING §3, §12)
-- -----------------------------------------------------------------------------
create or replace function private.current_subscription(p_establishment_id uuid)
returns public.subscriptions
language sql
stable
security definer
set search_path = ''
as $$
  select s.* from public.subscriptions s
  where s.establishment_id = p_establishment_id
  order by (s.status = 'canceled'), s.created_at desc
  limit 1;
$$;

-- Fonte única do acesso efetivo. Estabelecimentos sem assinatura (anteriores ao financeiro)
-- operam normalmente até receberem um plano (D24).
create or replace function private.establishment_mode(p_establishment_id uuid)
returns public.establishment_mode
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_status public.establishment_status;
  v_sub    public.subscriptions;
begin
  select status into v_status from public.establishments where id = p_establishment_id;
  if v_status is null or v_status = 'deactivated' then
    return 'disabled';
  end if;
  if v_status = 'suspended' then
    return 'restricted';
  end if;
  v_sub := private.current_subscription(p_establishment_id);
  if v_sub.id is null then
    return 'operational';
  end if;
  return case v_sub.status
    when 'pending_activation' then 'setup'
    when 'trialing' then 'operational'
    when 'active' then 'operational'
    when 'past_due' then 'operational'
    else 'restricted'
  end::public.establishment_mode;
end;
$$;

create or replace function private.assert_not_restricted(p_establishment_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.establishment_mode(p_establishment_id) in ('restricted', 'disabled') then
    raise exception using errcode = 'P0001', message = 'ESTABLISHMENT_RESTRICTED';
  end if;
end;
$$;

-- Limite/flag do plano vigente. Null = sem limite (sem assinatura ou chave sem limite).
create or replace function private.entitlement(p_establishment_id uuid, p_key text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sub   public.subscriptions := private.current_subscription(p_establishment_id);
  v_value integer;
begin
  if v_sub.id is null then
    return null;
  end if;
  if p_key = 'max_active_professionals' then
    select v.included_professionals + v_sub.extra_professionals into v_value
    from public.subscription_plan_versions v where v.id = v_sub.plan_version_id;
    return v_value;
  end if;
  select f.limit_value into v_value from public.subscription_plan_features f
  where f.plan_version_id = v_sub.plan_version_id and f.feature_key = p_key and f.enabled;
  return v_value;
end;
$$;

-- Vagas de profissionais (BILLING §3): conta todo profissional ativo, com lock por estabelecimento.
create or replace function private.enforce_professional_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit  integer;
  v_active integer;
begin
  if not new.is_active or (tg_op = 'UPDATE' and old.is_active) then
    return new;
  end if;
  perform private.assert_not_restricted(new.establishment_id);
  perform pg_advisory_xact_lock(hashtextextended('professional-limit:' || new.establishment_id::text, 0));
  v_limit := private.entitlement(new.establishment_id, 'max_active_professionals');
  if v_limit is null then
    return new;
  end if;
  select count(*) into v_active from public.professionals p
  where p.establishment_id = new.establishment_id and p.is_active and p.id <> new.id;
  if v_active + 1 > v_limit then
    raise exception using errcode = 'P0001', message = 'PLAN_LIMIT_REACHED';
  end if;
  return new;
end;
$$;

create trigger professionals_enforce_limit before insert or update of is_active on public.professionals
  for each row execute function private.enforce_professional_limit();

-- -----------------------------------------------------------------------------
-- Máquina de estados da assinatura (BILLING §7.2) — única porta de mudança de status
-- -----------------------------------------------------------------------------
create or replace function private.subscription_transition_allowed(
  p_from public.subscription_status, p_to public.subscription_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from, p_to) in (
    ('pending_activation'::public.subscription_status, 'trialing'::public.subscription_status),
    ('pending_activation', 'active'), ('pending_activation', 'canceled'),
    ('trialing', 'active'), ('trialing', 'past_due'), ('trialing', 'canceled'),
    ('active', 'past_due'), ('active', 'suspended'), ('active', 'canceled'),
    ('past_due', 'active'), ('past_due', 'suspended'), ('past_due', 'canceled'),
    ('suspended', 'active'), ('suspended', 'canceled')
  );
$$;

create or replace function private.transition_subscription(
  p_subscription_id uuid, p_to public.subscription_status, p_reason text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_sub.status = p_to then
    return;
  end if;
  if not private.subscription_transition_allowed(v_sub.status, p_to) then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
  end if;

  perform set_config('app.subscription_transition', 'on', true);
  update public.subscriptions
     set status = p_to,
         activated_at = case when p_to = 'active' and activated_at is null then now() else activated_at end,
         suspended_at = case when p_to = 'suspended' then now() when p_to = 'active' then null else suspended_at end,
         suspension_reason = case when p_to = 'suspended' then p_reason when p_to = 'active' then null else suspension_reason end,
         canceled_at = case when p_to = 'canceled' then now() else canceled_at end,
         cancel_reason = case when p_to = 'canceled' then p_reason else cancel_reason end
   where id = p_subscription_id;
  perform set_config('app.subscription_transition', 'off', true);

  insert into public.subscription_events
    (establishment_id, subscription_id, event_type, from_status, to_status, actor_user_id, reason)
  values (v_sub.establishment_id, v_sub.id, 'status_changed', v_sub.status, p_to, (select auth.uid()), p_reason);
  perform private.write_audit('billing.subscription_status_changed', v_sub.establishment_id, 'subscription',
    v_sub.id, jsonb_build_object('from', v_sub.status, 'to', p_to, 'reason', p_reason));
end;
$$;

-- Bloqueia UPDATE direto de status fora de transition_subscription.
create or replace function private.guard_subscription_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.subscription_transition', true), 'off') <> 'on' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
  end if;
  return new;
end;
$$;
create trigger subscriptions_guard_status before update of status on public.subscriptions
  for each row execute function private.guard_subscription_status();

-- -----------------------------------------------------------------------------
-- Catálogo inicial (BILLING §2.1, §4.1, §5) — idempotente
-- -----------------------------------------------------------------------------
insert into public.billing_features (key, name, kind) values
  ('max_active_professionals', 'Profissionais ativos', 'limit')
on conflict (key) do nothing;

insert into public.subscription_plans (code, name, description, sort_order) values
  ('individual',   'Individual',   'Para quem atende sozinho.', 1),
  ('essencial',    'Essencial',    'Para até 2 profissionais.', 2),
  ('profissional', 'Profissional', 'Para até 5 profissionais.', 3),
  ('premium',      'Premium',      'Para até 10 profissionais, com vagas adicionais.', 4)
on conflict (code) do nothing;

insert into public.subscription_plan_versions
  (plan_id, version, monthly_price_cents, annual_price_cents, included_professionals, extra_professional_price_cents)
select p.id, 1, v.monthly, v.annual, v.included, v.extra
from (values
  ('individual',    6990,  69900,  1, null::integer),
  ('essencial',     9990,  99900,  2, null),
  ('profissional', 11990, 119900,  5, null),
  ('premium',      15990, 159900, 10, 1490)
) v(code, monthly, annual, included, extra)
join public.subscription_plans p on p.code = v.code
where not exists (select 1 from public.subscription_plan_versions x where x.plan_id = p.id);

insert into public.subscription_plan_features (plan_version_id, feature_key, enabled, limit_value)
select v.id, 'max_active_professionals', true, v.included_professionals
from public.subscription_plan_versions v
on conflict do nothing;

insert into public.add_on_services (code, name, price_cents, price_is_starting_from, billing_type, unit_label, is_technically_available, sort_order)
values
  ('setup',               'Implantação completa',            14990, false, 'one_time', null,   true,  1),
  ('customer_import',     'Importação de clientes',           7990, true,  'one_time', null,   true,  2),
  ('extra_training',      'Treinamento adicional',            8000, false, 'per_unit', 'hora', true,  3),
  ('whatsapp_automation', 'Automação de WhatsApp',            2990, true,  'recurring', null,  false, 4),
  ('landing_page',        'Criação de landing page',         49990, true,  'one_time', null,   true,  5),
  ('institutional_site',  'Site institucional',              99990, true,  'one_time', null,   true,  6),
  ('custom_dev',          'Desenvolvimento personalizado',    null, false, 'custom_quote', null, true, 7),
  ('extra_professional',  'Profissional adicional (Premium)', 1490, false, 'recurring', null,   true,  8)
on conflict (code) do nothing;

insert into public.promotional_offers (name, first_cycle_price_cents, waives_setup_fee)
select 'Primeiro mês com implantação completa', 10000, true
where not exists (select 1 from public.promotional_offers);

insert into public.promotional_offer_plans (offer_id, plan_id)
select o.id, p.id from public.promotional_offers o cross join public.subscription_plans p
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- RLS (escritas somente via RPC)
-- -----------------------------------------------------------------------------
alter table public.billing_settings              enable row level security;
alter table public.billing_features              enable row level security;
alter table public.subscription_plans            enable row level security;
alter table public.subscription_plan_versions    enable row level security;
alter table public.subscription_plan_features    enable row level security;
alter table public.subscriptions                 enable row level security;
alter table public.subscription_events           enable row level security;
alter table public.add_on_services               enable row level security;
alter table public.billing_charges               enable row level security;
alter table public.promotional_offers            enable row level security;
alter table public.promotional_offer_plans       enable row level security;
alter table public.promotion_redemptions         enable row level security;
alter table public.subscription_discounts        enable row level security;

-- Financeiro da plataforma: quem tem billing.manage vê tudo.
create policy billing_settings_select on public.billing_settings for select to authenticated
  using ((select private.has_platform_permission('billing.manage')));
create policy billing_features_select on public.billing_features for select to authenticated using (true);
-- Catálogo comercial: legível por usuários autenticados (nomes, preços públicos).
create policy subscription_plans_select on public.subscription_plans for select to authenticated
  using (not is_promotional or (select private.has_platform_permission('billing.manage')));
create policy subscription_plan_versions_select on public.subscription_plan_versions for select to authenticated
  using (true);
create policy subscription_plan_features_select on public.subscription_plan_features for select to authenticated
  using (true);
create policy add_on_services_select on public.add_on_services for select to authenticated using (true);
create policy promotional_offers_select on public.promotional_offers for select to authenticated
  using ((select private.has_platform_permission('billing.manage')));
create policy promotional_offer_plans_select on public.promotional_offer_plans for select to authenticated
  using ((select private.has_platform_permission('billing.manage')));

-- Dados do estabelecimento: owner/admin do próprio + financeiro da plataforma. Staff não vê.
create policy subscriptions_select on public.subscriptions for select to authenticated
  using ((select private.is_establishment_admin(establishment_id)) or (select private.has_platform_permission('billing.manage')));
create policy subscription_events_select on public.subscription_events for select to authenticated
  using ((select private.is_establishment_admin(establishment_id)) or (select private.has_platform_permission('billing.manage')));
create policy billing_charges_select on public.billing_charges for select to authenticated
  using ((select private.is_establishment_admin(establishment_id)) or (select private.has_platform_permission('billing.manage')));
create policy promotion_redemptions_select on public.promotion_redemptions for select to authenticated
  using ((select private.has_platform_permission('billing.manage')));
create policy subscription_discounts_select on public.subscription_discounts for select to authenticated
  using ((select private.is_establishment_admin(establishment_id)) or (select private.has_platform_permission('billing.manage')));

revoke all on public.billing_settings, public.billing_features, public.subscription_plans,
              public.subscription_plan_versions, public.subscription_plan_features, public.subscriptions,
              public.subscription_events, public.add_on_services, public.billing_charges,
              public.promotional_offers, public.promotional_offer_plans, public.promotion_redemptions,
              public.subscription_discounts
  from anon, authenticated;
grant select on public.billing_settings, public.billing_features, public.subscription_plans,
                public.subscription_plan_versions, public.subscription_plan_features, public.subscriptions,
                public.subscription_events, public.add_on_services, public.billing_charges,
                public.promotional_offers, public.promotional_offer_plans, public.promotion_redemptions,
                public.subscription_discounts
  to authenticated;
grant select, insert, update on public.billing_settings, public.billing_features, public.subscription_plans,
      public.subscription_plan_versions, public.subscription_plan_features, public.subscriptions,
      public.add_on_services, public.billing_charges, public.promotional_offers, public.promotional_offer_plans,
      public.promotion_redemptions, public.subscription_discounts
  to service_role;
grant select, insert on public.subscription_events to service_role;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.establishment_mode(uuid) to authenticated, service_role;
grant execute on function private.billing_cycle_start(date, integer, public.billing_interval, integer) to authenticated, service_role;
