-- =============================================================================
-- 16 · Financeiro do SaaS — faturas, pagamentos manuais e comprovantes (B2)
-- Referência: BILLING.md §4, §6, §9, §10, §15
-- Nada é apagado: correções por cancelamento/reemissão e lançamentos de reversão.
-- =============================================================================

create type public.invoice_status as enum ('draft', 'open', 'paid', 'overdue', 'canceled', 'partially_paid', 'refunded');
create type public.invoice_item_kind as enum
  ('plan', 'extra_professional', 'add_on', 'one_time', 'setup_fee', 'promotional_bundle', 'discount', 'adjustment');
create type public.billing_payment_method as enum ('pix', 'credit_card', 'bank_transfer', 'cash', 'boleto', 'other');
create type public.billing_payment_status as enum ('confirmed', 'reversed');
create type public.proof_status as enum ('submitted', 'accepted', 'rejected');

create table public.invoice_number_counters (
  year integer primary key,
  last integer not null default 0
);

create table public.invoices (
  id                   uuid primary key default gen_random_uuid(),
  establishment_id     uuid not null references public.establishments (id),
  subscription_id      uuid,
  number               text unique,
  kind                 text not null check (kind in ('subscription_cycle', 'standalone')),
  cycle_index          integer,
  revision             integer not null default 0,
  period_start         date,
  period_end           date,
  status               public.invoice_status not null default 'draft',
  issued_at            timestamptz,
  due_date             date not null,
  original_due_date    date not null,
  subtotal_cents       integer not null default 0 check (subtotal_cents >= 0),
  discount_cents       integer not null default 0 check (discount_cents >= 0),
  total_cents          integer not null default 0 check (total_cents >= 0),
  amount_paid_cents    integer not null default 0,
  paid_at              timestamptz,
  payment_instructions jsonb,
  notes                text check (notes is null or char_length(notes) <= 1000),
  canceled_at          timestamptz,
  cancel_reason        text,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint invoices_tenant_uk unique (establishment_id, id),
  constraint invoices_subscription_fk foreign key (establishment_id, subscription_id)
    references public.subscriptions (establishment_id, id),
  constraint invoices_totals check (total_cents = subtotal_cents - discount_cents),
  constraint invoices_cycle_shape check ((kind = 'subscription_cycle') = (cycle_index is not null and subscription_id is not null))
);
-- Idempotência da fatura de ciclo (BILLING §8.3).
create unique index invoices_cycle_uk on public.invoices (subscription_id, cycle_index, revision)
  where kind = 'subscription_cycle';
create index invoices_establishment_idx on public.invoices (establishment_id, due_date desc);
create index invoices_status_idx on public.invoices (status, due_date);

create table public.invoice_items (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  invoice_id       uuid not null,
  kind             public.invoice_item_kind not null,
  description      text not null check (char_length(description) between 1 and 200),
  quantity         integer not null default 1 check (quantity between 1 and 1000),
  unit_price_cents integer not null,
  amount_cents     integer not null,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  constraint invoice_items_invoice_fk foreign key (establishment_id, invoice_id)
    references public.invoices (establishment_id, id),
  constraint invoice_items_amount check (amount_cents = quantity * unit_price_cents),
  constraint invoice_items_sign check ((kind = 'discount') = (amount_cents < 0) or amount_cents = 0)
);
create index invoice_items_invoice_idx on public.invoice_items (invoice_id);

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  establishment_id    uuid not null references public.establishments (id),
  method              public.billing_payment_method not null,
  amount_cents        integer not null check (amount_cents > 0 and amount_cents <= 100000000),
  received_on         date not null,
  status              public.billing_payment_status not null default 'confirmed',
  reference           text check (reference is null or char_length(reference) <= 120),
  notes               text check (notes is null or char_length(notes) <= 500),
  provider            text,
  provider_payment_id text,
  recorded_by         uuid references public.profiles (id) on delete set null,
  reversed_at         timestamptz,
  reversed_by         uuid references public.profiles (id) on delete set null,
  reverse_reason      text,
  created_at          timestamptz not null default now(),
  constraint payments_tenant_uk unique (establishment_id, id),
  constraint payments_reverse_shape check ((status = 'reversed') = (reversed_at is not null))
);
create unique index payments_provider_uk on public.payments (provider, provider_payment_id) where provider is not null;

create table public.payment_allocations (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  payment_id       uuid not null,
  invoice_id       uuid not null,
  amount_cents     integer not null check (amount_cents > 0),
  created_at       timestamptz not null default now(),
  constraint payment_allocations_payment_fk foreign key (establishment_id, payment_id)
    references public.payments (establishment_id, id),
  constraint payment_allocations_invoice_fk foreign key (establishment_id, invoice_id)
    references public.invoices (establishment_id, id)
);
create index payment_allocations_invoice_idx on public.payment_allocations (invoice_id);

create table public.payment_proofs (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  invoice_id       uuid not null,
  storage_path     text not null check (char_length(storage_path) <= 300),
  status           public.proof_status not null default 'submitted',
  submitted_by     uuid references public.profiles (id) on delete set null,
  reviewed_by      uuid references public.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  rejection_reason text,
  payment_id       uuid,
  created_at       timestamptz not null default now(),
  constraint payment_proofs_invoice_fk foreign key (establishment_id, invoice_id)
    references public.invoices (establishment_id, id)
);
create index payment_proofs_status_idx on public.payment_proofs (status, created_at);

create table public.billing_requests (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id),
  kind             text not null check (kind in ('change_plan', 'extra_professionals', 'add_on', 'cancel', 'support')),
  message          text not null check (char_length(message) between 3 and 1000),
  status           text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  response         text check (response is null or char_length(response) <= 1000),
  created_by       uuid references public.profiles (id) on delete set null,
  resolved_by      uuid references public.profiles (id) on delete set null,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Imutabilidade (BILLING §9.2): após emitida, valores e itens não mudam.
-- -----------------------------------------------------------------------------
create or replace function private.guard_invoice()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'APPEND_ONLY';
  end if;
  if old.status <> 'draft' and (
    (new.subtotal_cents, new.discount_cents, new.total_cents, new.establishment_id, new.subscription_id,
     new.kind, new.period_start, new.period_end, new.cycle_index, new.revision, new.original_due_date)
    is distinct from
    (old.subtotal_cents, old.discount_cents, old.total_cents, old.establishment_id, old.subscription_id,
     old.kind, old.period_start, old.period_end, old.cycle_index, old.revision, old.original_due_date)
    or (old.number is not null and new.number is distinct from old.number)
  ) then
    raise exception using errcode = 'P0001', message = 'INVOICE_IMMUTABLE';
  end if;
  if old.status in ('canceled', 'refunded') and new.status is distinct from old.status then
    raise exception using errcode = 'P0001', message = 'INVOICE_IMMUTABLE';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger invoices_guard before update or delete on public.invoices
  for each row execute function private.guard_invoice();

create or replace function private.guard_invoice_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.invoices i
    where i.id = coalesce(new.invoice_id, old.invoice_id) and i.status <> 'draft'
  ) then
    raise exception using errcode = 'P0001', message = 'INVOICE_IMMUTABLE';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger invoice_items_guard before insert or update or delete on public.invoice_items
  for each row execute function private.guard_invoice_items();

create or replace function private.guard_billing_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or old.status = 'reversed'
     or (new.amount_cents, new.method, new.received_on, new.establishment_id)
        is distinct from (old.amount_cents, old.method, old.received_on, old.establishment_id) then
    raise exception using errcode = 'P0001', message = 'APPEND_ONLY';
  end if;
  return new;
end;
$$;
create trigger payments_guard before update or delete on public.payments
  for each row execute function private.guard_billing_payment();
create trigger payment_allocations_append_only before update or delete on public.payment_allocations
  for each row execute function private.forbid_update_delete();

-- -----------------------------------------------------------------------------
-- Auxiliares
-- -----------------------------------------------------------------------------
create or replace function private.assert_billing_manager()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_platform_permission('billing.manage') then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
end;
$$;

create or replace function private.billing_today()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone (select timezone from public.billing_settings limit 1))::date;
$$;

create or replace function private.next_invoice_number(p_year integer)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_last integer;
begin
  insert into public.invoice_number_counters as c (year, last) values (p_year, 1)
  on conflict (year) do update set last = c.last + 1
  returning last into v_last;
  return format('FAT-%s-%s', p_year, lpad(v_last::text, 6, '0'));
end;
$$;

-- Mensalidade vigente: preço negociado ou preço da versão contratada.
create or replace function private.subscription_plan_price(p_sub public.subscriptions)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_sub.price_override_cents, v.monthly_price_cents)
  from public.subscription_plan_versions v where v.id = p_sub.plan_version_id;
$$;

create or replace function private.add_invoice_item(
  p_invoice public.invoices, p_kind public.invoice_item_kind, p_description text,
  p_quantity integer, p_unit_price integer, p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.invoice_items
    (establishment_id, invoice_id, kind, description, quantity, unit_price_cents, amount_cents, metadata)
  values (p_invoice.establishment_id, p_invoice.id, p_kind, left(p_description, 200), p_quantity, p_unit_price,
          p_quantity * p_unit_price, coalesce(p_metadata, '{}'::jsonb));
$$;

-- Recalcula subtotal/desconto/total a partir dos itens (só em rascunho).
create or replace function private.recalc_invoice_totals(p_invoice_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.invoices i
     set subtotal_cents = coalesce((select sum(amount_cents) from public.invoice_items x
                                    where x.invoice_id = i.id and x.amount_cents > 0), 0),
         discount_cents = coalesce((select -sum(amount_cents) from public.invoice_items x
                                    where x.invoice_id = i.id and x.amount_cents < 0), 0),
         total_cents = greatest(coalesce((select sum(amount_cents) from public.invoice_items x
                                          where x.invoice_id = i.id), 0), 0)
   where i.id = p_invoice_id;
$$;

-- Fatura do ciclo k (rascunho). Ordem (BILLING §6.3): itens → % → fixos → piso zero.
create or replace function private.build_cycle_invoice(p_subscription_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sub       public.subscriptions;
  v_version   public.subscription_plan_versions;
  v_plan      public.subscription_plans;
  v_invoice   public.invoices;
  v_k         integer;
  v_start     date;
  v_end       date;
  v_offer     public.promotional_offers;
  v_recurring integer := 0;
  v_remaining integer;
  v_disc      public.subscription_discounts;
  v_apply     integer;
  v_charge    public.billing_charges;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found or v_sub.status = 'canceled' then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  select * into v_version from public.subscription_plan_versions where id = v_sub.plan_version_id;
  select * into v_plan from public.subscription_plans where id = v_version.plan_id;

  v_k := v_sub.next_cycle_index;
  v_start := private.billing_cycle_start(v_sub.anchor_date, v_sub.anchor_day, v_sub.interval, v_k);
  v_end := private.billing_cycle_start(v_sub.anchor_date, v_sub.anchor_day, v_sub.interval, v_k + 1);

  insert into public.invoices (establishment_id, subscription_id, kind, cycle_index, revision,
                               period_start, period_end, due_date, original_due_date, created_by)
  values (v_sub.establishment_id, v_sub.id, 'subscription_cycle', v_k,
          coalesce((select max(revision) + 1 from public.invoices
                    where subscription_id = v_sub.id and cycle_index = v_k and kind = 'subscription_cycle'), 0),
          v_start, v_end, v_start, v_start, (select auth.uid()))
  returning * into v_invoice;

  -- Oferta de entrada: substitui mensalidade (e implantação) no 1º ciclo.
  if v_k = 0 then
    select o.* into v_offer
    from public.promotion_redemptions r join public.promotional_offers o on o.id = r.offer_id
    where r.subscription_id = v_sub.id
    limit 1;
  end if;

  if v_offer.id is not null then
    perform private.add_invoice_item(v_invoice, 'promotional_bundle',
      format('%s: plano %s%s', v_offer.name, v_plan.name, case when v_offer.waives_setup_fee then ' + implantação completa' else '' end),
      1, v_offer.first_cycle_price_cents,
      jsonb_build_object('offer_id', v_offer.id, 'plan_price_cents', private.subscription_plan_price(v_sub),
        'setup_fee_cents', (select default_setup_fee_cents from public.billing_settings limit 1)));
  else
    v_recurring := private.subscription_plan_price(v_sub);
    perform private.add_invoice_item(v_invoice, 'plan', format('Plano %s', v_plan.name), 1, v_recurring,
      jsonb_build_object('plan_version_id', v_version.id));
  end if;

  if v_sub.extra_professionals > 0 and v_version.extra_professional_price_cents is not null then
    perform private.add_invoice_item(v_invoice, 'extra_professional',
      format('Profissionais adicionais (%s × %s)', v_sub.extra_professionals,
             to_char(v_version.extra_professional_price_cents / 100.0, 'FM999G990D00')),
      v_sub.extra_professionals, v_version.extra_professional_price_cents);
    v_recurring := v_recurring + v_sub.extra_professionals * v_version.extra_professional_price_cents;
  end if;

  -- Cobranças únicas pendentes (implantação, serviços) entram nesta fatura.
  for v_charge in
    select * from public.billing_charges c
    where c.establishment_id = v_sub.establishment_id and c.status = 'pending'
      and (c.subscription_id is null or c.subscription_id = v_sub.id)
    order by c.created_at
    for update
  loop
    perform private.add_invoice_item(v_invoice,
      case v_charge.kind when 'setup_fee' then 'setup_fee'::public.invoice_item_kind else 'one_time'::public.invoice_item_kind end,
      v_charge.description, v_charge.quantity, v_charge.unit_price_cents, jsonb_build_object('charge_id', v_charge.id));
    update public.billing_charges set status = 'invoiced', invoice_id = v_invoice.id where id = v_charge.id;
  end loop;

  -- Descontos recorrentes (não acumulam com a oferta de entrada).
  if v_offer.id is null and v_recurring > 0 then
    v_remaining := v_recurring;
    for v_disc in
      select * from public.subscription_discounts d
      where d.subscription_id = v_sub.id and d.revoked_at is null
        and (d.duration <> 'once' or d.cycles_applied = 0)
        and (d.duration <> 'repeating' or d.cycles_applied < d.cycles_total)
      order by case d.kind when 'percent' then 1 when 'fixed' then 2 else 3 end, d.created_at
    loop
      exit when v_remaining <= 0;
      v_apply := least(v_remaining, case v_disc.kind
        when 'percent' then round(v_recurring * v_disc.value / 10000.0)::integer
        when 'fixed' then v_disc.value
        else v_remaining end);
      if v_apply > 0 then
        perform private.add_invoice_item(v_invoice, 'discount', v_disc.name, 1, -v_apply,
          jsonb_build_object('discount_id', v_disc.id));
        v_remaining := v_remaining - v_apply;
      end if;
    end loop;
  end if;

  perform private.recalc_invoice_totals(v_invoice.id);
  update public.subscriptions set next_cycle_index = v_k + 1 where id = v_sub.id;
  return v_invoice.id;
end;
$$;

-- Saldo, status derivado e reativação automática da assinatura (BILLING §7.2, §9.2).
create or replace function private.refresh_invoice(p_invoice_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inv  public.invoices;
  v_paid integer;
  v_sub  public.subscriptions;
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if v_inv.status in ('draft', 'canceled') then
    return;
  end if;
  select coalesce(sum(a.amount_cents), 0) into v_paid
  from public.payment_allocations a join public.payments p on p.id = a.payment_id
  where a.invoice_id = v_inv.id and p.status = 'confirmed';

  update public.invoices
     set amount_paid_cents = v_paid,
         status = case
           when v_paid >= total_cents then 'paid'::public.invoice_status
           when v_paid > 0 then 'partially_paid'::public.invoice_status
           when due_date < private.billing_today() then 'overdue'::public.invoice_status
           else 'open'::public.invoice_status end,
         paid_at = case when v_paid >= total_cents then coalesce(paid_at, now()) else null end
   where id = v_inv.id;

  -- Quitação de todas as faturas exigíveis reativa a assinatura (sem tocar na suspensão administrativa).
  if v_inv.subscription_id is not null then
    select * into v_sub from public.subscriptions where id = v_inv.subscription_id;
    if v_sub.status in ('pending_activation', 'past_due', 'suspended') and not exists (
      select 1 from public.invoices i
      where i.subscription_id = v_sub.id and i.status in ('open', 'partially_paid', 'overdue')
        and i.due_date <= private.billing_today()
    ) and exists (
      select 1 from public.invoices i where i.subscription_id = v_sub.id and i.status = 'paid'
    ) then
      perform private.transition_subscription(v_sub.id, 'active', 'Faturas quitadas');
    end if;
  end if;
end;
$$;

create or replace function private.issue_invoice(p_invoice_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inv public.invoices;
  v_set public.billing_settings;
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if v_inv.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
  end if;
  select * into v_set from public.billing_settings limit 1;
  update public.invoices
     set status = 'open',
         number = private.next_invoice_number(extract(year from private.billing_today())::integer),
         issued_at = now(),
         payment_instructions = jsonb_strip_nulls(jsonb_build_object(
           'pix_key_type', v_set.pix_key_type, 'pix_key', v_set.pix_key,
           'pix_receiver_name', v_set.pix_receiver_name, 'instructions', v_set.payment_instructions,
           'support_whatsapp_e164', v_set.support_whatsapp_e164))
   where id = v_inv.id;
  -- O ciclo do desconto só conta quando a fatura é emitida (BILLING §6.3).
  update public.subscription_discounts d set cycles_applied = cycles_applied + 1
  where d.id in (select (x.metadata ->> 'discount_id')::uuid from public.invoice_items x
                 where x.invoice_id = v_inv.id and x.kind = 'discount');
  perform private.write_audit('billing.invoice_issued', v_inv.establishment_id, 'invoice', v_inv.id,
    jsonb_build_object('total_cents', v_inv.total_cents));
  perform private.refresh_invoice(v_inv.id);
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs do financeiro da plataforma (billing.manage)
-- -----------------------------------------------------------------------------

-- Atribui plano ao estabelecimento: assinatura + oferta/implantação + 1ª fatura (BILLING §18.1).
create or replace function public.billing_assign_subscription(
  p_establishment_id     uuid,
  p_plan_version_id      uuid,
  p_anchor_date          date,
  p_use_offer            boolean,
  p_setup_mode           text,     -- 'first_invoice' | 'waive' | 'separate'
  p_setup_fee_cents      integer,
  p_price_override_cents integer,
  p_override_reason      text,
  p_extra_professionals  integer,
  p_issue                boolean,
  p_notes                text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version  public.subscription_plan_versions;
  v_offer    public.promotional_offers;
  v_sub_id   uuid;
  v_invoice  uuid;
  v_setup    integer;
  v_active   integer;
  v_count    integer;
  v_extra    integer := coalesce(p_extra_professionals, 0);
  v_anchor   date := coalesce(p_anchor_date, private.billing_today());
begin
  perform private.assert_billing_manager();
  if p_setup_mode not in ('first_invoice', 'waive', 'separate')
     or (p_price_override_cents is not null and char_length(coalesce(trim(p_override_reason), '')) < 3) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  if not exists (select 1 from public.establishments where id = p_establishment_id and status <> 'deactivated') then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  select v.* into v_version from public.subscription_plan_versions v
  join public.subscription_plans p on p.id = v.plan_id
  where v.id = p_plan_version_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_extra > 0 and v_version.extra_professional_price_cents is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  select count(*) into v_active from public.professionals where establishment_id = p_establishment_id and is_active;
  if v_active > v_version.included_professionals + v_extra then
    raise exception using errcode = 'P0001', message = 'PLAN_LIMIT_REACHED';
  end if;

  begin
    insert into public.subscriptions (establishment_id, plan_version_id, price_override_cents, price_override_reason,
                                      extra_professionals, anchor_day, anchor_date, notes, created_by)
    values (p_establishment_id, p_plan_version_id, p_price_override_cents, nullif(trim(p_override_reason), ''),
            v_extra, extract(day from v_anchor)::smallint, v_anchor, nullif(trim(p_notes), ''), (select auth.uid()))
    returning id into v_sub_id;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'SUBSCRIPTION_EXISTS';
  end;
  insert into public.subscription_events (establishment_id, subscription_id, event_type, to_status, actor_user_id, metadata)
  values (p_establishment_id, v_sub_id, 'created', 'pending_activation', (select auth.uid()),
          jsonb_build_object('plan_version_id', p_plan_version_id, 'use_offer', p_use_offer));

  -- Oferta de entrada: elegibilidade, uso único e limite de participantes com lock.
  if p_use_offer then
    select o.* into v_offer from public.promotional_offers o
    join public.promotional_offer_plans op on op.offer_id = o.id and op.plan_id = v_version.plan_id
    where o.is_active and (o.ends_on is null or o.ends_on >= private.billing_today())
    order by o.created_at
    limit 1
    for update of o;
    if not found then
      raise exception using errcode = 'P0001', message = 'PROMOTION_UNAVAILABLE';
    end if;
    if v_offer.max_redemptions is not null then
      select count(*) into v_count from public.promotion_redemptions where offer_id = v_offer.id;
      if v_count >= v_offer.max_redemptions then
        raise exception using errcode = 'P0001', message = 'PROMOTION_UNAVAILABLE';
      end if;
    end if;
    begin
      insert into public.promotion_redemptions (offer_id, establishment_id, subscription_id, redeemed_by)
      values (v_offer.id, p_establishment_id, v_sub_id, (select auth.uid()));
    exception when unique_violation then
      raise exception using errcode = 'P0001', message = 'PROMOTION_ALREADY_USED';
    end;
  end if;

  -- Implantação (BILLING §4.2): coberta pela oferta, isenta, na 1ª fatura ou em fatura separada.
  v_setup := coalesce(p_setup_fee_cents, (select default_setup_fee_cents from public.billing_settings limit 1));
  if v_setup < 0 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  insert into public.billing_charges (establishment_id, subscription_id, kind, description, unit_price_cents, status, created_by)
  values (p_establishment_id, v_sub_id, 'setup_fee', 'Implantação completa', v_setup,
          case
            when v_offer.id is not null and v_offer.waives_setup_fee then 'covered_by_promotion'::public.billing_charge_status
            when p_setup_mode = 'waive' or v_setup = 0 then 'waived'::public.billing_charge_status
            else 'pending'::public.billing_charge_status end,
          (select auth.uid()));

  if p_setup_mode = 'separate' and v_offer.id is null and v_setup > 0 then
    perform public.billing_invoice_pending_charges(p_establishment_id, p_issue);
  end if;

  v_invoice := private.build_cycle_invoice(v_sub_id);
  if p_issue then
    perform private.issue_invoice(v_invoice);
  end if;

  perform private.write_audit('billing.subscription_assigned', p_establishment_id, 'subscription', v_sub_id,
    jsonb_build_object('plan_version_id', p_plan_version_id, 'offer', v_offer.id, 'setup_mode', p_setup_mode,
                       'setup_fee_cents', v_setup, 'price_override_cents', p_price_override_cents,
                       'extra_professionals', v_extra));
  return jsonb_build_object('subscription_id', v_sub_id, 'invoice_id', v_invoice);
end;
$$;

-- Fatura avulsa com as cobranças únicas pendentes (ex.: implantação separada, serviço adicional).
create or replace function public.billing_invoice_pending_charges(p_establishment_id uuid, p_issue boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv    public.invoices;
  v_charge public.billing_charges;
begin
  perform private.assert_billing_manager();
  if not exists (select 1 from public.billing_charges where establishment_id = p_establishment_id and status = 'pending') then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  insert into public.invoices (establishment_id, kind, due_date, original_due_date, created_by)
  values (p_establishment_id, 'standalone', private.billing_today(), private.billing_today(), (select auth.uid()))
  returning * into v_inv;
  for v_charge in
    select * from public.billing_charges where establishment_id = p_establishment_id and status = 'pending'
    order by created_at for update
  loop
    perform private.add_invoice_item(v_inv,
      case v_charge.kind when 'setup_fee' then 'setup_fee'::public.invoice_item_kind else 'one_time'::public.invoice_item_kind end,
      v_charge.description, v_charge.quantity, v_charge.unit_price_cents, jsonb_build_object('charge_id', v_charge.id));
    update public.billing_charges set status = 'invoiced', invoice_id = v_inv.id where id = v_charge.id;
  end loop;
  perform private.recalc_invoice_totals(v_inv.id);
  if p_issue then
    perform private.issue_invoice(v_inv.id);
  end if;
  return v_inv.id;
end;
$$;

-- Próxima fatura de ciclo (manual até a rotina automática da fase B4).
create or replace function public.billing_generate_next_invoice(p_subscription_id uuid, p_issue boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.assert_billing_manager();
  v_id := private.build_cycle_invoice(p_subscription_id);
  if p_issue then
    perform private.issue_invoice(v_id);
  end if;
  return v_id;
end;
$$;

create or replace function public.billing_issue_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_billing_manager();
  perform private.issue_invoice(p_invoice_id);
end;
$$;

-- Cancelamento auditado; cobranças únicas voltam a pendentes e o ciclo pode ser reemitido.
create or replace function public.billing_cancel_invoice(p_invoice_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invoices;
begin
  perform private.assert_billing_manager();
  if char_length(coalesce(trim(p_reason), '')) < 3 then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_inv.status not in ('draft', 'open', 'overdue') or v_inv.amount_paid_cents > 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
  end if;
  update public.invoices set status = 'canceled', canceled_at = now(), cancel_reason = trim(p_reason)
  where id = p_invoice_id;
  update public.billing_charges set status = 'pending', invoice_id = null where invoice_id = p_invoice_id;
  if v_inv.status <> 'draft' then
    update public.subscription_discounts d set cycles_applied = greatest(cycles_applied - 1, 0)
    where d.id in (select (x.metadata ->> 'discount_id')::uuid from public.invoice_items x
                   where x.invoice_id = v_inv.id and x.kind = 'discount');
  end if;
  -- Fatura de ciclo cancelada: o mesmo ciclo pode ser gerado de novo (nova revisão).
  if v_inv.kind = 'subscription_cycle' then
    update public.subscriptions set next_cycle_index = least(next_cycle_index, v_inv.cycle_index)
    where id = v_inv.subscription_id;
  end if;
  perform private.write_audit('billing.invoice_canceled', v_inv.establishment_id, 'invoice', v_inv.id,
    jsonb_build_object('reason', trim(p_reason), 'total_cents', v_inv.total_cents));
end;
$$;

create or replace function public.billing_extend_due_date(p_invoice_id uuid, p_due_date date, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invoices;
begin
  perform private.assert_billing_manager();
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_inv.status not in ('open', 'overdue', 'partially_paid') or p_due_date is null or p_due_date < v_inv.due_date then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  update public.invoices set due_date = p_due_date where id = p_invoice_id;
  perform private.refresh_invoice(p_invoice_id);
  perform private.write_audit('billing.invoice_due_date_extended', v_inv.establishment_id, 'invoice', v_inv.id,
    jsonb_build_object('from', v_inv.due_date, 'to', p_due_date, 'reason', p_reason));
end;
$$;

-- Pagamento manual (BILLING §10.1). Sem fatura ou acima do saldo → "saldo a alocar".
create or replace function public.billing_record_payment(
  p_establishment_id uuid,
  p_invoice_id       uuid,
  p_amount_cents     integer,
  p_method           public.billing_payment_method,
  p_received_on      date,
  p_reference        text,
  p_notes            text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv     public.invoices;
  v_payment uuid;
  v_alloc   integer;
begin
  perform private.assert_billing_manager();
  if p_amount_cents is null or p_amount_cents <= 0 or p_method is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  if p_invoice_id is not null then
    select * into v_inv from public.invoices where id = p_invoice_id and establishment_id = p_establishment_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    if v_inv.status in ('draft', 'canceled', 'refunded') then
      raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
    end if;
  end if;

  insert into public.payments (establishment_id, method, amount_cents, received_on, reference, notes, recorded_by)
  values (p_establishment_id, p_method, p_amount_cents, coalesce(p_received_on, private.billing_today()),
          nullif(trim(p_reference), ''), nullif(trim(p_notes), ''), (select auth.uid()))
  returning id into v_payment;

  if v_inv.id is not null then
    v_alloc := least(p_amount_cents, greatest(v_inv.total_cents - v_inv.amount_paid_cents, 0));
    if v_alloc > 0 then
      insert into public.payment_allocations (establishment_id, payment_id, invoice_id, amount_cents)
      values (p_establishment_id, v_payment, v_inv.id, v_alloc);
    end if;
    perform private.refresh_invoice(v_inv.id);
  end if;

  perform private.write_audit('billing.payment_recorded', p_establishment_id, 'payment', v_payment,
    jsonb_build_object('amount_cents', p_amount_cents, 'method', p_method, 'invoice_id', p_invoice_id));
  return v_payment;
end;
$$;

-- Correção: o lançamento é marcado como revertido (nunca editado) e as faturas recalculadas.
create or replace function public.billing_reverse_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_invoice uuid;
begin
  perform private.assert_billing_manager();
  if char_length(coalesce(trim(p_reason), '')) < 3 then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_payment.status = 'reversed' then
    raise exception using errcode = 'P0001', message = 'APPEND_ONLY';
  end if;
  update public.payments
     set status = 'reversed', reversed_at = now(), reversed_by = (select auth.uid()), reverse_reason = trim(p_reason)
   where id = p_payment_id;
  for v_invoice in select distinct invoice_id from public.payment_allocations where payment_id = p_payment_id
  loop
    update public.invoices set status = 'open', paid_at = null where id = v_invoice and status = 'paid';
    perform private.refresh_invoice(v_invoice);
  end loop;
  perform private.write_audit('billing.payment_reversed', v_payment.establishment_id, 'payment', p_payment_id,
    jsonb_build_object('amount_cents', v_payment.amount_cents, 'reason', trim(p_reason)));
end;
$$;

create or replace function public.billing_transition_subscription(
  p_subscription_id uuid, p_to public.subscription_status, p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_billing_manager();
  if p_to in ('suspended', 'canceled') and char_length(coalesce(trim(p_reason), '')) < 3 then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;
  perform private.transition_subscription(p_subscription_id, p_to, nullif(trim(p_reason), ''));
end;
$$;

-- Mudança de plano/vagas imediata (BILLING §13). Downgrade nunca desativa profissionais.
create or replace function public.billing_change_plan(
  p_subscription_id     uuid,
  p_plan_version_id     uuid,
  p_extra_professionals integer,
  p_reason              text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub     public.subscriptions;
  v_version public.subscription_plan_versions;
  v_active  integer;
  v_extra   integer := coalesce(p_extra_professionals, 0);
begin
  perform private.assert_billing_manager();
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found or v_sub.status = 'canceled' then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  select * into v_version from public.subscription_plan_versions where id = coalesce(p_plan_version_id, v_sub.plan_version_id);
  if not found or (v_extra > 0 and v_version.extra_professional_price_cents is null) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('professional-limit:' || v_sub.establishment_id::text, 0));
  select count(*) into v_active from public.professionals where establishment_id = v_sub.establishment_id and is_active;
  if v_active > v_version.included_professionals + v_extra then
    raise exception using errcode = 'P0001', message = 'PLAN_LIMIT_REACHED';
  end if;
  update public.subscriptions
     set plan_version_id = v_version.id, extra_professionals = v_extra
   where id = v_sub.id;
  insert into public.subscription_events (establishment_id, subscription_id, event_type, actor_user_id, reason, metadata)
  values (v_sub.establishment_id, v_sub.id, 'plan_changed', (select auth.uid()), nullif(trim(p_reason), ''),
          jsonb_build_object('from_version', v_sub.plan_version_id, 'to_version', v_version.id,
                             'from_extra', v_sub.extra_professionals, 'to_extra', v_extra));
  perform private.write_audit('billing.plan_changed', v_sub.establishment_id, 'subscription', v_sub.id,
    jsonb_build_object('from_version', v_sub.plan_version_id, 'to_version', v_version.id, 'extra', v_extra));
end;
$$;

-- Cobrança única (serviço adicional, ajuste) para a próxima fatura ou fatura avulsa imediata.
create or replace function public.billing_add_charge(
  p_establishment_id uuid,
  p_add_on_id        uuid,
  p_description      text,
  p_quantity         integer,
  p_unit_price_cents integer,
  p_standalone       boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_charge uuid;
begin
  perform private.assert_billing_manager();
  if char_length(coalesce(trim(p_description), '')) < 2 or coalesce(p_quantity, 0) < 1
     or coalesce(p_unit_price_cents, -1) < 0 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  insert into public.billing_charges (establishment_id, subscription_id, add_on_id, kind, description, quantity,
                                      unit_price_cents, created_by)
  values (p_establishment_id, (private.current_subscription(p_establishment_id)).id, p_add_on_id,
          case when p_add_on_id is null then 'adjustment' else 'add_on' end, trim(p_description), p_quantity,
          p_unit_price_cents, (select auth.uid()))
  returning id into v_charge;
  perform private.write_audit('billing.charge_added', p_establishment_id, 'billing_charge', v_charge,
    jsonb_build_object('amount_cents', p_quantity * p_unit_price_cents, 'standalone', p_standalone));
  if p_standalone then
    return public.billing_invoice_pending_charges(p_establishment_id, true);
  end if;
  return null;
end;
$$;

create or replace function public.billing_grant_discount(
  p_subscription_id uuid,
  p_name            text,
  p_kind            public.discount_kind,
  p_value           integer,
  p_duration        public.discount_duration,
  p_cycles          integer,
  p_reason          text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
  v_id  uuid;
begin
  perform private.assert_billing_manager();
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  begin
    insert into public.subscription_discounts (establishment_id, subscription_id, name, kind, value, duration,
                                               cycles_total, reason, granted_by)
    values (v_sub.establishment_id, v_sub.id, trim(p_name), p_kind, coalesce(p_value, 0), p_duration,
            case when p_duration = 'repeating' then p_cycles end, trim(p_reason), (select auth.uid()))
    returning id into v_id;
  exception when check_violation or not_null_violation then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end;
  perform private.write_audit('billing.discount_granted', v_sub.establishment_id, 'subscription_discount', v_id,
    jsonb_build_object('kind', p_kind, 'value', p_value, 'duration', p_duration, 'cycles', p_cycles, 'reason', p_reason));
  return v_id;
end;
$$;

create or replace function public.billing_revoke_discount(p_discount_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_disc public.subscription_discounts;
begin
  perform private.assert_billing_manager();
  select * into v_disc from public.subscription_discounts where id = p_discount_id for update;
  if not found or v_disc.revoked_at is not null then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  update public.subscription_discounts set revoked_at = now() where id = p_discount_id;
  perform private.write_audit('billing.discount_revoked', v_disc.establishment_id, 'subscription_discount',
    p_discount_id, jsonb_build_object('reason', p_reason));
end;
$$;

-- Nova versão de preço (nunca altera contratos existentes; BILLING §2.2).
create or replace function public.billing_create_plan_version(
  p_plan_id                        uuid,
  p_monthly_price_cents            integer,
  p_annual_price_cents             integer,
  p_included_professionals         integer,
  p_extra_professional_price_cents integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid;
  v_version integer;
begin
  perform private.assert_billing_manager();
  select coalesce(max(version), 0) + 1 into v_version from public.subscription_plan_versions where plan_id = p_plan_id;
  if v_version = 1 and not exists (select 1 from public.subscription_plans where id = p_plan_id) then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  update public.subscription_plan_versions set is_current = false where plan_id = p_plan_id and is_current;
  begin
    insert into public.subscription_plan_versions (plan_id, version, monthly_price_cents, annual_price_cents,
                                                   included_professionals, extra_professional_price_cents, created_by)
    values (p_plan_id, v_version, p_monthly_price_cents, p_annual_price_cents, p_included_professionals,
            p_extra_professional_price_cents, (select auth.uid()))
    returning id into v_id;
  exception when check_violation or not_null_violation then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end;
  insert into public.subscription_plan_features (plan_version_id, feature_key, enabled, limit_value)
  values (v_id, 'max_active_professionals', true, p_included_professionals);
  perform private.write_audit('billing.plan_version_created', null, 'subscription_plan_version', v_id,
    jsonb_build_object('plan_id', p_plan_id, 'version', v_version, 'monthly_price_cents', p_monthly_price_cents,
                       'included_professionals', p_included_professionals));
  return v_id;
end;
$$;

-- Configurações de cobrança: somente Super Admin (BILLING §20).
create or replace function public.billing_update_settings(
  p_pix_key_type            text,
  p_pix_key                 text,
  p_pix_receiver_name       text,
  p_payment_instructions    text,
  p_support_whatsapp_e164   text,
  p_default_setup_fee_cents integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_platform_admin();
  begin
    update public.billing_settings
       set pix_key_type = nullif(p_pix_key_type, ''),
           pix_key = nullif(trim(p_pix_key), ''),
           pix_receiver_name = nullif(trim(p_pix_receiver_name), ''),
           payment_instructions = nullif(trim(p_payment_instructions), ''),
           support_whatsapp_e164 = nullif(trim(p_support_whatsapp_e164), ''),
           default_setup_fee_cents = p_default_setup_fee_cents;
  exception when check_violation or not_null_violation then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end;
  perform private.write_audit('billing.settings_updated', null, 'billing_settings', null,
    jsonb_build_object('pix_key_type', p_pix_key_type, 'default_setup_fee_cents', p_default_setup_fee_cents));
end;
$$;

-- Revisão de comprovante: aceitar cria pagamento + alocação na mesma transação (BILLING §10.3).
create or replace function public.billing_review_proof(
  p_proof_id     uuid,
  p_accept       boolean,
  p_amount_cents integer,
  p_method       public.billing_payment_method,
  p_reason       text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proof   public.payment_proofs;
  v_payment uuid;
begin
  perform private.assert_billing_manager();
  select * into v_proof from public.payment_proofs where id = p_proof_id for update;
  if not found or v_proof.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if p_accept then
    v_payment := public.billing_record_payment(v_proof.establishment_id, v_proof.invoice_id, p_amount_cents,
                                               coalesce(p_method, 'pix'), private.billing_today(),
                                               'Comprovante enviado pelo estabelecimento', null);
    update public.payment_proofs
       set status = 'accepted', reviewed_by = (select auth.uid()), reviewed_at = now(), payment_id = v_payment
     where id = p_proof_id;
  else
    if char_length(coalesce(trim(p_reason), '')) < 3 then
      raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
    end if;
    update public.payment_proofs
       set status = 'rejected', reviewed_by = (select auth.uid()), reviewed_at = now(), rejection_reason = trim(p_reason)
     where id = p_proof_id;
  end if;
  perform private.write_audit(case when p_accept then 'billing.proof_accepted' else 'billing.proof_rejected' end,
    v_proof.establishment_id, 'payment_proof', p_proof_id, jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.billing_resolve_request(p_request_id uuid, p_status text, p_response text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_billing_manager();
  if p_status not in ('done', 'dismissed') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  update public.billing_requests
     set status = p_status, response = nullif(trim(p_response), ''), resolved_by = (select auth.uid()), resolved_at = now()
   where id = p_request_id and status = 'open';
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
end;
$$;

-- Visão geral do financeiro (o painel completo de indicadores é a fase B3).
create or replace function public.billing_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date;
begin
  perform private.assert_billing_manager();
  v_today := private.billing_today();
  return jsonb_build_object(
    'mrr_cents', coalesce((
      select sum(private.subscription_plan_price(s)
                 + s.extra_professionals * coalesce(v.extra_professional_price_cents, 0))
      from public.subscriptions s join public.subscription_plan_versions v on v.id = s.plan_version_id
      where s.status in ('active', 'past_due')), 0),
    'subscriptions', coalesce((select jsonb_object_agg(status, n) from (
        select status, count(*) n from public.subscriptions group by status) x), '{}'::jsonb),
    'receivable_cents', coalesce((select sum(total_cents - amount_paid_cents) from public.invoices
        where status in ('open', 'partially_paid', 'overdue') and due_date >= v_today), 0),
    'overdue_cents', coalesce((select sum(total_cents - amount_paid_cents) from public.invoices
        where status in ('open', 'partially_paid', 'overdue') and due_date < v_today), 0),
    'received_month_cents', coalesce((select sum(amount_cents) from public.payments
        where status = 'confirmed' and received_on >= date_trunc('month', v_today)::date), 0),
    'pending_proofs', (select count(*) from public.payment_proofs where status = 'submitted'),
    'open_requests', (select count(*) from public.billing_requests where status = 'open')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs do estabelecimento (owner/admin): só comprovante e solicitações. Nenhum valor vem do cliente.
-- -----------------------------------------------------------------------------
create or replace function public.billing_submit_proof(p_invoice_id uuid, p_storage_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invoices;
  v_id  uuid;
begin
  select * into v_inv from public.invoices where id = p_invoice_id;
  if not found or not private.is_establishment_admin(v_inv.establishment_id) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if v_inv.status not in ('open', 'overdue', 'partially_paid') then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
  end if;
  if p_storage_path is null or p_storage_path not like v_inv.establishment_id::text || '/' || v_inv.id::text || '/%' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  insert into public.payment_proofs (establishment_id, invoice_id, storage_path, submitted_by)
  values (v_inv.establishment_id, v_inv.id, p_storage_path, (select auth.uid()))
  returning id into v_id;
  perform private.write_audit('billing.proof_submitted', v_inv.establishment_id, 'payment_proof', v_id, '{}'::jsonb);
  return v_id;
end;
$$;

create or replace function public.billing_create_request(p_establishment_id uuid, p_kind text, p_message text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.is_establishment_admin(p_establishment_id) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  begin
    insert into public.billing_requests (establishment_id, kind, message, created_by)
    values (p_establishment_id, p_kind, trim(p_message), (select auth.uid()))
    returning id into v_id;
  exception when check_violation then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end;
  return v_id;
end;
$$;

-- Situação para o painel do estabelecimento (banner, vagas). Qualquer membro; valores só para admin.
create or replace function public.get_establishment_billing_status(p_establishment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sub   public.subscriptions;
  v_admin boolean := private.is_establishment_admin(p_establishment_id);
begin
  if not private.is_member(p_establishment_id) and not private.has_platform_permission('billing.manage') then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  v_sub := private.current_subscription(p_establishment_id);
  return jsonb_build_object(
    'mode', private.establishment_mode(p_establishment_id),
    'subscription_status', v_sub.status,
    'plan_name', (select p.name from public.subscription_plan_versions v join public.subscription_plans p on p.id = v.plan_id
                  where v.id = v_sub.plan_version_id),
    'professional_limit', private.entitlement(p_establishment_id, 'max_active_professionals'),
    'active_professionals', (select count(*) from public.professionals
                             where establishment_id = p_establishment_id and is_active),
    'next_invoice', case when v_admin then (
      select jsonb_build_object('id', i.id, 'number', i.number, 'total_cents', i.total_cents,
                                'amount_paid_cents', i.amount_paid_cents, 'due_date', i.due_date, 'status', i.status)
      from public.invoices i
      where i.establishment_id = p_establishment_id and i.status in ('open', 'partially_paid', 'overdue')
      order by i.due_date limit 1) end
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Storage: comprovantes em bucket PRIVADO (leitura só por URL assinada gerada no servidor)
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage.buckets inexistente: bucket billing-proofs não criado (ambiente de teste).';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('billing-proofs', 'billing-proofs', false, 10485760,
          array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
end
$$;

-- -----------------------------------------------------------------------------
-- RLS: owner/admin veem o próprio estabelecimento (sem rascunhos); financeiro vê tudo.
-- -----------------------------------------------------------------------------
alter table public.invoice_number_counters enable row level security;
alter table public.invoices                enable row level security;
alter table public.invoice_items           enable row level security;
alter table public.payments                enable row level security;
alter table public.payment_allocations     enable row level security;
alter table public.payment_proofs          enable row level security;
alter table public.billing_requests        enable row level security;

create policy invoices_select on public.invoices for select to authenticated using (
  (select private.has_platform_permission('billing.manage'))
  or (status <> 'draft' and (select private.is_establishment_admin(establishment_id)))
);
create policy invoice_items_select on public.invoice_items for select to authenticated using (
  (select private.has_platform_permission('billing.manage'))
  or exists (select 1 from public.invoices i where i.id = invoice_id and i.status <> 'draft'
             and private.is_establishment_admin(i.establishment_id))
);
create policy payments_select on public.payments for select to authenticated using (
  (select private.has_platform_permission('billing.manage')) or (select private.is_establishment_admin(establishment_id))
);
create policy payment_allocations_select on public.payment_allocations for select to authenticated using (
  (select private.has_platform_permission('billing.manage')) or (select private.is_establishment_admin(establishment_id))
);
create policy payment_proofs_select on public.payment_proofs for select to authenticated using (
  (select private.has_platform_permission('billing.manage')) or (select private.is_establishment_admin(establishment_id))
);
create policy billing_requests_select on public.billing_requests for select to authenticated using (
  (select private.has_platform_permission('billing.manage')) or (select private.is_establishment_admin(establishment_id))
);

revoke all on public.invoice_number_counters, public.invoices, public.invoice_items, public.payments,
              public.payment_allocations, public.payment_proofs, public.billing_requests from anon, authenticated;
grant select on public.invoices, public.invoice_items, public.payments, public.payment_allocations,
                public.payment_proofs, public.billing_requests to authenticated;
grant select, insert, update on public.invoice_number_counters, public.invoices, public.invoice_items, public.payments,
      public.payment_proofs, public.billing_requests to service_role;
grant select, insert on public.payment_allocations to service_role;

revoke execute on all functions in schema private from public, anon;

do $$
declare
  f text;
begin
  foreach f in array array[
    'billing_assign_subscription(uuid, uuid, date, boolean, text, integer, integer, text, integer, boolean, text)',
    'billing_invoice_pending_charges(uuid, boolean)',
    'billing_generate_next_invoice(uuid, boolean)',
    'billing_issue_invoice(uuid)',
    'billing_cancel_invoice(uuid, text)',
    'billing_extend_due_date(uuid, date, text)',
    'billing_record_payment(uuid, uuid, integer, public.billing_payment_method, date, text, text)',
    'billing_reverse_payment(uuid, text)',
    'billing_transition_subscription(uuid, public.subscription_status, text)',
    'billing_change_plan(uuid, uuid, integer, text)',
    'billing_add_charge(uuid, uuid, text, integer, integer, boolean)',
    'billing_grant_discount(uuid, text, public.discount_kind, integer, public.discount_duration, integer, text)',
    'billing_revoke_discount(uuid, text)',
    'billing_create_plan_version(uuid, integer, integer, integer, integer)',
    'billing_update_settings(text, text, text, text, text, integer)',
    'billing_review_proof(uuid, boolean, integer, public.billing_payment_method, text)',
    'billing_resolve_request(uuid, text, text)',
    'billing_overview()',
    'billing_submit_proof(uuid, text)',
    'billing_create_request(uuid, text, text)',
    'get_establishment_billing_status(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;
