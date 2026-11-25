-- =============================================================================
-- 19 · Financeiro do SaaS — indicadores, cupons e serviços recorrentes (B3, B2-3, B2-4)
-- Referência: BILLING.md §5, §6, §17
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Serviços adicionais recorrentes (ex.: automação de WhatsApp vendida como projeto)
-- -----------------------------------------------------------------------------
create table public.subscription_items (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  subscription_id  uuid not null,
  add_on_id        uuid references public.add_on_services (id),
  description      text not null check (char_length(description) between 2 and 200),
  quantity         integer not null default 1 check (quantity between 1 and 1000),
  unit_price_cents integer not null check (unit_price_cents between 0 and 10000000),
  starts_on        date not null,
  ends_on          date,
  end_reason       text,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint subscription_items_subscription_fk foreign key (establishment_id, subscription_id)
    references public.subscriptions (establishment_id, id),
  constraint subscription_items_period check (ends_on is null or ends_on > starts_on)
);
create index subscription_items_subscription_idx on public.subscription_items (subscription_id);

-- -----------------------------------------------------------------------------
-- Cupons (catálogo reutilizável; BILLING §6.2)
-- -----------------------------------------------------------------------------
create table public.coupons (
  id              uuid primary key default gen_random_uuid(),
  code            extensions.citext not null unique check (code ~* '^[A-Z0-9_-]{3,30}$'),
  name            text not null check (char_length(name) between 2 and 120),
  kind            public.discount_kind not null,
  value           integer not null default 0 check (value >= 0),
  duration        public.discount_duration not null,
  cycles          smallint check (cycles is null or cycles > 0),
  valid_until     date,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  is_active       boolean not null default true,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint coupons_shape check (
    (kind = 'percent' and value between 1 and 10000) or (kind = 'fixed' and value > 0) or kind = 'free'
  ),
  constraint coupons_cycles check ((duration = 'repeating') = (cycles is not null))
);

alter table public.subscription_discounts add column coupon_id uuid references public.coupons (id);
-- Um resgate por cupom e assinatura.
create unique index subscription_discounts_coupon_uk on public.subscription_discounts (coupon_id, subscription_id)
  where coupon_id is not null;

-- Fatura de ciclo agora inclui os adicionais recorrentes (recriada a partir da versão anterior).
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
  v_item      public.subscription_items;
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

  -- Serviços adicionais recorrentes vigentes no início do ciclo (BILLING §5).
  for v_item in
    select * from public.subscription_items si
    where si.subscription_id = v_sub.id and si.starts_on <= v_start and (si.ends_on is null or si.ends_on > v_start)
    order by si.created_at
  loop
    perform private.add_invoice_item(v_invoice, 'add_on', v_item.description, v_item.quantity, v_item.unit_price_cents,
      jsonb_build_object('subscription_item_id', v_item.id));
    v_recurring := v_recurring + v_item.quantity * v_item.unit_price_cents;
  end loop;

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

-- Receita recorrente mensal de uma assinatura (BILLING §17): plano (ou negociado) + vagas +
-- recorrentes vigentes − descontos permanentes. Anual ÷ 12. Não inclui avulsos nem oferta.
create or replace function private.subscription_mrr(p_sub public.subscriptions, p_on date)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_version public.subscription_plan_versions;
  v_base    integer;
  v_disc    public.subscription_discounts;
  v_left    integer;
begin
  select * into v_version from public.subscription_plan_versions where id = p_sub.plan_version_id;
  v_base := case when p_sub.interval = 'year'
                 then coalesce(v_version.annual_price_cents, v_version.monthly_price_cents * 12) / 12
                 else coalesce(p_sub.price_override_cents, v_version.monthly_price_cents) end
          + p_sub.extra_professionals * coalesce(v_version.extra_professional_price_cents, 0)
          + coalesce((select sum(quantity * unit_price_cents) from public.subscription_items si
                      where si.subscription_id = p_sub.id and si.starts_on <= p_on
                        and (si.ends_on is null or si.ends_on > p_on)), 0);
  v_left := v_base;
  for v_disc in
    select * from public.subscription_discounts d
    where d.subscription_id = p_sub.id and d.revoked_at is null and d.duration = 'forever'
    order by case d.kind when 'percent' then 1 when 'fixed' then 2 else 3 end
  loop
    v_left := v_left - least(v_left, case v_disc.kind
      when 'percent' then round(v_base * v_disc.value / 10000.0)::integer
      when 'fixed' then v_disc.value else v_left end);
  end loop;
  return greatest(v_left, 0);
end;
$$;

-- -----------------------------------------------------------------------------
-- Painel financeiro (B3-1): recorrente × avulso, faturado × recebido
-- -----------------------------------------------------------------------------
create or replace function public.billing_dashboard(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today       date;
  v_mrr         bigint;
  v_counted     integer;
  v_start_count integer;
  v_canceled    integer;
  v_exigible    bigint;
  v_overdue     bigint;
begin
  perform private.assert_billing_manager();
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 800 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  v_today := private.billing_today();

  select coalesce(sum(private.subscription_mrr(s, v_today)), 0), count(*)
    into v_mrr, v_counted
  from public.subscriptions s where s.status in ('active', 'past_due');

  -- Churn: cancelamentos no período ÷ assinaturas ativas no início do período.
  select count(*) into v_start_count from public.subscriptions s
  where s.activated_at::date < p_from and (s.canceled_at is null or s.canceled_at::date >= p_from);
  select count(*) into v_canceled from public.subscriptions s
  where s.canceled_at::date between p_from and p_to and s.activated_at is not null;

  -- Inadimplência: valor vencido ÷ valor exigível (faturas com vencimento no período).
  select coalesce(sum(total_cents), 0), coalesce(sum(case when due_date < v_today then total_cents - amount_paid_cents else 0 end), 0)
    into v_exigible, v_overdue
  from public.invoices
  where status not in ('draft', 'canceled') and due_date between p_from and least(p_to, v_today);

  return jsonb_build_object(
    'mrr_cents', v_mrr,
    'arr_cents', v_mrr * 12,
    'counted_subscriptions', v_counted,
    'average_ticket_cents', case when v_counted > 0 then v_mrr / v_counted else 0 end,
    'subscriptions', coalesce((select jsonb_object_agg(status, n) from (
        select status, count(*) n from public.subscriptions group by status) x), '{}'::jsonb),
    'new_subscriptions', (select count(*) from public.subscriptions where activated_at::date between p_from and p_to),
    'churn_rate', case when v_start_count > 0 then round(v_canceled::numeric / v_start_count, 4) else 0 end,
    'canceled', v_canceled,
    'invoiced_cents', coalesce((select sum(total_cents) from public.invoices
        where status not in ('draft', 'canceled') and issued_at::date between p_from and p_to), 0),
    'invoiced_by_kind', coalesce((
        select jsonb_object_agg(k, cents) from (
          select case
                   when x.kind in ('plan', 'extra_professional', 'add_on', 'discount') then 'recurring'
                   when x.kind = 'promotional_bundle' then 'entry_offer'
                   else 'one_time' end as k,
                 sum(x.amount_cents) as cents
          from public.invoice_items x join public.invoices i on i.id = x.invoice_id
          where i.status not in ('draft', 'canceled') and i.issued_at::date between p_from and p_to
          group by 1) g), '{}'::jsonb),
    'received_cents', coalesce((select sum(amount_cents) from public.payments
        where status = 'confirmed' and received_on between p_from and p_to), 0),
    'receivable_cents', coalesce((select sum(total_cents - amount_paid_cents) from public.invoices
        where status in ('open', 'partially_paid', 'overdue') and due_date >= v_today), 0),
    'overdue_cents', coalesce((select sum(total_cents - amount_paid_cents) from public.invoices
        where status in ('open', 'partially_paid', 'overdue') and due_date < v_today), 0),
    'delinquency_rate', case when v_exigible > 0 then round(v_overdue::numeric / v_exigible, 4) else 0 end,
    'by_plan', coalesce((
        select jsonb_agg(jsonb_build_object('plan', name, 'subscriptions', n, 'mrr_cents', mrr) order by sort_order)
        from (
          select p.name, p.sort_order, count(*) n, sum(private.subscription_mrr(s, v_today)) mrr
          from public.subscriptions s
          join public.subscription_plan_versions v on v.id = s.plan_version_id
          join public.subscription_plans p on p.id = v.plan_id
          where s.status in ('active', 'past_due')
          group by p.name, p.sort_order) t), '[]'::jsonb),
    'monthly', coalesce((
        select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
                 'invoiced_cents', coalesce((select sum(total_cents) from public.invoices i
                    where i.status not in ('draft', 'canceled')
                      and date_trunc('month', i.issued_at at time zone 'America/Sao_Paulo') = m), 0),
                 'received_cents', coalesce((select sum(amount_cents) from public.payments p
                    where p.status = 'confirmed' and date_trunc('month', p.received_on) = m), 0))
               order by m)
        from generate_series(date_trunc('month', p_to::timestamp) - interval '11 months',
                             date_trunc('month', p_to::timestamp), interval '1 month') m), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs: adicionais recorrentes e cupons
-- -----------------------------------------------------------------------------
create or replace function public.billing_add_recurring_item(
  p_subscription_id uuid, p_add_on_id uuid, p_description text, p_quantity integer,
  p_unit_price_cents integer, p_starts_on date
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
  if not found or v_sub.status = 'canceled' then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  begin
    insert into public.subscription_items (establishment_id, subscription_id, add_on_id, description, quantity,
                                           unit_price_cents, starts_on, created_by)
    values (v_sub.establishment_id, v_sub.id, p_add_on_id, trim(p_description), coalesce(p_quantity, 1),
            p_unit_price_cents, coalesce(p_starts_on, private.billing_today()), (select auth.uid()))
    returning id into v_id;
  exception when check_violation or not_null_violation then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end;
  perform private.write_audit('billing.recurring_item_added', v_sub.establishment_id, 'subscription_item', v_id,
    jsonb_build_object('description', p_description, 'quantity', p_quantity, 'unit_price_cents', p_unit_price_cents));
  return v_id;
end;
$$;

create or replace function public.billing_end_recurring_item(p_item_id uuid, p_ends_on date, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.subscription_items;
begin
  perform private.assert_billing_manager();
  select * into v_item from public.subscription_items where id = p_item_id for update;
  if not found or v_item.ends_on is not null then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if p_ends_on is null or p_ends_on <= v_item.starts_on then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  update public.subscription_items set ends_on = p_ends_on, end_reason = nullif(trim(p_reason), '') where id = p_item_id;
  perform private.write_audit('billing.recurring_item_ended', v_item.establishment_id, 'subscription_item', p_item_id,
    jsonb_build_object('ends_on', p_ends_on, 'reason', p_reason));
end;
$$;

create or replace function public.billing_create_coupon(
  p_code text, p_name text, p_kind public.discount_kind, p_value integer, p_duration public.discount_duration,
  p_cycles integer, p_valid_until date, p_max_redemptions integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.assert_billing_manager();
  begin
    insert into public.coupons (code, name, kind, value, duration, cycles, valid_until, max_redemptions, created_by)
    values (upper(trim(p_code)), trim(p_name), p_kind, coalesce(p_value, 0), p_duration,
            case when p_duration = 'repeating' then p_cycles end, p_valid_until, p_max_redemptions, (select auth.uid()))
    returning id into v_id;
  exception
    when unique_violation then
      raise exception using errcode = 'P0001', message = 'COUPON_CODE_TAKEN';
    when check_violation or not_null_violation then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end;
  perform private.write_audit('billing.coupon_created', null, 'coupon', v_id,
    jsonb_build_object('code', upper(trim(p_code)), 'kind', p_kind, 'value', p_value));
  return v_id;
end;
$$;

create or replace function public.billing_set_coupon_active(p_coupon_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_billing_manager();
  update public.coupons set is_active = p_active where id = p_coupon_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  perform private.write_audit('billing.coupon_active_changed', null, 'coupon', p_coupon_id,
    jsonb_build_object('active', p_active));
end;
$$;

-- Aplica um cupom à assinatura: validade e limite de resgates com lock (sem reuso indevido).
create or replace function public.billing_apply_coupon(p_subscription_id uuid, p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub    public.subscriptions;
  v_coupon public.coupons;
  v_used   integer;
  v_id     uuid;
begin
  perform private.assert_billing_manager();
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found or v_sub.status = 'canceled' then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  select * into v_coupon from public.coupons where code = upper(trim(p_code)) for update;
  if not found or not v_coupon.is_active
     or (v_coupon.valid_until is not null and v_coupon.valid_until < private.billing_today()) then
    raise exception using errcode = 'P0001', message = 'COUPON_INVALID';
  end if;
  if v_coupon.max_redemptions is not null then
    select count(*) into v_used from public.subscription_discounts where coupon_id = v_coupon.id;
    if v_used >= v_coupon.max_redemptions then
      raise exception using errcode = 'P0001', message = 'COUPON_INVALID';
    end if;
  end if;
  begin
    insert into public.subscription_discounts (establishment_id, subscription_id, name, kind, value, duration,
                                               cycles_total, reason, granted_by, coupon_id)
    values (v_sub.establishment_id, v_sub.id, v_coupon.name, v_coupon.kind, v_coupon.value, v_coupon.duration,
            v_coupon.cycles, format('Cupom %s', v_coupon.code), (select auth.uid()), v_coupon.id)
    returning id into v_id;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'COUPON_ALREADY_USED';
  end;
  perform private.write_audit('billing.coupon_redeemed', v_sub.establishment_id, 'subscription_discount', v_id,
    jsonb_build_object('code', v_coupon.code));
  return v_id;
end;
$$;

-- Visão geral (cartões do topo) passa a usar o mesmo cálculo de MRR do painel.
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
    'mrr_cents', coalesce((select sum(private.subscription_mrr(s, v_today)) from public.subscriptions s
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
-- RLS e grants
-- -----------------------------------------------------------------------------
alter table public.subscription_items enable row level security;
alter table public.coupons            enable row level security;

create policy subscription_items_select on public.subscription_items for select to authenticated using (
  (select private.has_platform_permission('billing.manage')) or (select private.is_establishment_admin(establishment_id))
);
create policy coupons_select on public.coupons for select to authenticated
  using ((select private.has_platform_permission('billing.manage')));

revoke all on public.subscription_items, public.coupons from anon, authenticated;
grant select on public.subscription_items, public.coupons to authenticated;
grant select, insert, update on public.subscription_items, public.coupons to service_role;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.establishment_mode(uuid) to authenticated, service_role;
grant execute on function private.billing_cycle_start(date, integer, public.billing_interval, integer) to authenticated, service_role;

do $$
declare
  f text;
begin
  foreach f in array array[
    'billing_dashboard(date, date)',
    'billing_add_recurring_item(uuid, uuid, text, integer, integer, date)',
    'billing_end_recurring_item(uuid, date, text)',
    'billing_create_coupon(text, text, public.discount_kind, integer, public.discount_duration, integer, date, integer)',
    'billing_set_coupon_active(uuid, boolean)',
    'billing_apply_coupon(uuid, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;
