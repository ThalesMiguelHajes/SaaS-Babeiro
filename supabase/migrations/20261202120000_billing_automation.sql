-- =============================================================================
-- 18 · Financeiro do SaaS — automação (B4)
-- Referência: BILLING.md §11, §13, §16
-- Rotina diária no próprio banco (pg_cron): mudanças agendadas, faturas de ciclo, atrasos,
-- suspensão opcional e régua de lembretes in-app. Idempotente e com lock.
-- =============================================================================

-- Data de cobrança "de hoje". Dentro da rotina (e nos testes) pode ser fixada por app.billing_today.
create or replace function private.billing_today()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('app.billing_today', true), '')::date,
    (now() at time zone (select timezone from public.billing_settings limit 1))::date
  );
$$;

-- -----------------------------------------------------------------------------
-- Configuração da régua (BILLING §11.1) e exceções por assinatura
-- -----------------------------------------------------------------------------
alter table public.billing_settings
  add column dunning_offsets smallint[] not null default '{-5,-1,0,1,5}'
    check (cardinality(dunning_offsets) between 1 and 12);

alter table public.subscriptions
  add column auto_suspend_override boolean,
  add column grace_days_override smallint check (grace_days_override is null or grace_days_override between 0 and 90);

-- -----------------------------------------------------------------------------
-- Mudanças de plano agendadas (BILLING §13): aplicadas pela rotina no início do ciclo
-- -----------------------------------------------------------------------------
create table public.subscription_scheduled_changes (
  id                  uuid primary key default gen_random_uuid(),
  establishment_id    uuid not null,
  subscription_id     uuid not null,
  plan_version_id     uuid not null references public.subscription_plan_versions (id),
  extra_professionals smallint not null default 0 check (extra_professionals between 0 and 500),
  effective_on        date not null,
  status              text not null default 'pending' check (status in ('pending', 'applied', 'blocked', 'canceled')),
  reason              text check (reason is null or char_length(reason) <= 300),
  result              text,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  applied_at          timestamptz,
  constraint subscription_scheduled_changes_subscription_fk foreign key (establishment_id, subscription_id)
    references public.subscriptions (establishment_id, id)
);
create index subscription_scheduled_changes_due_idx on public.subscription_scheduled_changes (effective_on)
  where status = 'pending';

-- -----------------------------------------------------------------------------
-- Régua de cobrança (in-app; e-mail na fase B4-6) e log da rotina
-- -----------------------------------------------------------------------------
create table public.billing_notifications (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  invoice_id       uuid not null,
  kind             text not null check (kind ~ '^d[+-]?\d{1,3}$'),
  channel          text not null default 'in_app' check (channel in ('in_app', 'email')),
  days_from_due    smallint not null,
  status           text not null default 'pending' check (status in ('pending', 'sent', 'dismissed')),
  sent_at          timestamptz,
  sent_by          uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint billing_notifications_invoice_fk foreign key (establishment_id, invoice_id)
    references public.invoices (establishment_id, id),
  -- Idempotência: um aviso por fatura, etapa e canal.
  constraint billing_notifications_once_uk unique (invoice_id, kind, channel)
);
create index billing_notifications_pending_idx on public.billing_notifications (status, created_at);

create table public.billing_job_runs (
  id                    bigint generated always as identity primary key,
  run_date              date not null,
  started_at            timestamptz not null default now(),
  finished_at           timestamptz,
  status                text not null check (status in ('running', 'ok', 'partial', 'skipped', 'failed')),
  trigger               text not null default 'cron' check (trigger in ('cron', 'manual')),
  subscriptions_processed integer not null default 0,
  invoices_created      integer not null default 0,
  notifications_created integer not null default 0,
  changes_applied       integer not null default 0,
  status_changes        integer not null default 0,
  errors                jsonb not null default '[]'::jsonb
);
create index billing_job_runs_started_idx on public.billing_job_runs (started_at desc);

-- -----------------------------------------------------------------------------
-- Uma assinatura por vez, em subtransação: falha de uma não derruba as demais
-- -----------------------------------------------------------------------------
create or replace function private.billing_process_subscription(p_subscription_id uuid, p_today date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sub         public.subscriptions;
  v_set         public.billing_settings;
  v_change      public.subscription_scheduled_changes;
  v_version     public.subscription_plan_versions;
  v_active      integer;
  v_invoice     uuid;
  v_inv         public.invoices;
  v_offset      integer;
  v_days        integer;
  v_worst       integer;
  v_grace       integer;
  v_auto        boolean;
  v_created     integer := 0;
  v_notified    integer := 0;
  v_applied     integer := 0;
  v_transitions integer := 0;
  v_rows        integer;
begin
  select * into v_set from public.billing_settings limit 1;
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if v_sub.status = 'canceled' then
    return jsonb_build_object('invoices', 0);
  end if;

  -- 1. Mudanças agendadas que venceram (downgrade acima do limite fica bloqueado).
  for v_change in
    select * from public.subscription_scheduled_changes
    where subscription_id = v_sub.id and status = 'pending' and effective_on <= p_today
    order by effective_on, created_at
  loop
    select * into v_version from public.subscription_plan_versions where id = v_change.plan_version_id;
    perform pg_advisory_xact_lock(hashtextextended('professional-limit:' || v_sub.establishment_id::text, 0));
    select count(*) into v_active from public.professionals where establishment_id = v_sub.establishment_id and is_active;
    if v_active > v_version.included_professionals + v_change.extra_professionals then
      update public.subscription_scheduled_changes
         set status = 'blocked', applied_at = now(),
             result = format('%s profissionais ativos; o novo plano permite %s.', v_active,
                             v_version.included_professionals + v_change.extra_professionals)
       where id = v_change.id;
    else
      update public.subscriptions
         set plan_version_id = v_change.plan_version_id, extra_professionals = v_change.extra_professionals
       where id = v_sub.id;
      update public.subscription_scheduled_changes set status = 'applied', applied_at = now() where id = v_change.id;
      insert into public.subscription_events (establishment_id, subscription_id, event_type, reason, metadata)
      values (v_sub.establishment_id, v_sub.id, 'plan_changed', v_change.reason,
              jsonb_build_object('scheduled_change_id', v_change.id, 'to_version', v_change.plan_version_id));
      v_applied := v_applied + 1;
    end if;
  end loop;

  -- 2. Faturas de ciclo devidas (inclusive ciclos atrasados se a rotina ficou parada).
  if v_sub.status in ('trialing', 'active', 'past_due') then
    loop
      select * into v_sub from public.subscriptions where id = p_subscription_id;
      exit when private.billing_cycle_start(v_sub.anchor_date, v_sub.anchor_day, v_sub.interval, v_sub.next_cycle_index)
                - v_set.issue_days_before_due > p_today;
      exit when v_created >= 24; -- proteção contra laços inesperados
      v_invoice := private.build_cycle_invoice(v_sub.id);
      perform private.issue_invoice(v_invoice);
      v_created := v_created + 1;
    end loop;
  end if;

  -- 3. Status das faturas em aberto e régua (só a etapa atual de cada fatura).
  for v_inv in
    select * from public.invoices
    where subscription_id = v_sub.id and status in ('open', 'partially_paid', 'overdue')
  loop
    perform private.refresh_invoice(v_inv.id);
    v_days := p_today - v_inv.due_date;
    select max(o) into v_offset from unnest(v_set.dunning_offsets) o where o <= v_days;
    if v_offset is not null and v_days - v_offset <= 3 then
      insert into public.billing_notifications (establishment_id, invoice_id, kind, days_from_due)
      values (v_inv.establishment_id, v_inv.id,
              'd' || case when v_offset > 0 then '+' else '' end || v_offset, v_offset)
      on conflict (invoice_id, kind, channel) do nothing;
      get diagnostics v_rows = row_count;
      v_notified := v_notified + v_rows;
    end if;
  end loop;

  -- 4. Inadimplência (BILLING §11): atraso → past_due; suspensão só se habilitada.
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  select max(p_today - i.due_date) into v_worst
  from public.invoices i
  where i.subscription_id = v_sub.id and i.status in ('open', 'partially_paid', 'overdue') and i.due_date < p_today;

  v_grace := coalesce(v_sub.grace_days_override, v_set.grace_days);
  v_auto := coalesce(v_sub.auto_suspend_override, v_set.auto_suspend_enabled);

  if v_worst is not null and v_worst >= v_set.past_due_after_days and v_sub.status in ('active', 'trialing') then
    perform private.transition_subscription(v_sub.id, 'past_due', format('Fatura vencida há %s dia(s)', v_worst));
    v_transitions := v_transitions + 1;
    v_sub.status := 'past_due';
  end if;
  if v_worst is not null and v_auto and v_worst >= v_grace and v_sub.status = 'past_due' then
    perform private.transition_subscription(v_sub.id, 'suspended',
      format('Suspensão automática: fatura vencida há %s dia(s)', v_worst));
    v_transitions := v_transitions + 1;
  elsif v_worst is null and v_sub.status = 'past_due' then
    perform private.transition_subscription(v_sub.id, 'active', 'Sem faturas vencidas');
    v_transitions := v_transitions + 1;
  end if;

  return jsonb_build_object('invoices', v_created, 'notifications', v_notified,
                            'changes', v_applied, 'transitions', v_transitions);
end;
$$;

create or replace function private.billing_run(p_today date, p_trigger text)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_run    bigint;
  v_sub    uuid;
  v_res    jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_count  integer := 0;
  v_inv    integer := 0;
  v_not    integer := 0;
  v_chg    integer := 0;
  v_trn    integer := 0;
begin
  perform set_config('app.billing_today', p_today::text, true);

  -- Execução simultânea: a segunda termina e registra "skipped".
  if not pg_try_advisory_xact_lock(hashtextextended('billing_run_daily', 0)) then
    insert into public.billing_job_runs (run_date, status, trigger, finished_at)
    values (p_today, 'skipped', p_trigger, now()) returning id into v_run;
    return v_run;
  end if;

  insert into public.billing_job_runs (run_date, status, trigger) values (p_today, 'running', p_trigger)
  returning id into v_run;

  for v_sub in select id from public.subscriptions where status <> 'canceled' order by created_at
  loop
    begin
      v_res := private.billing_process_subscription(v_sub, p_today);
      v_count := v_count + 1;
      v_inv := v_inv + coalesce((v_res ->> 'invoices')::integer, 0);
      v_not := v_not + coalesce((v_res ->> 'notifications')::integer, 0);
      v_chg := v_chg + coalesce((v_res ->> 'changes')::integer, 0);
      v_trn := v_trn + coalesce((v_res ->> 'transitions')::integer, 0);
    exception when others then
      v_errors := v_errors || jsonb_build_object('subscription_id', v_sub, 'error', sqlerrm);
    end;
  end loop;

  update public.billing_job_runs
     set finished_at = now(),
         status = case when jsonb_array_length(v_errors) > 0 then 'partial' else 'ok' end,
         subscriptions_processed = v_count, invoices_created = v_inv, notifications_created = v_not,
         changes_applied = v_chg, status_changes = v_trn, errors = v_errors
   where id = v_run;
  perform set_config('app.billing_today', '', true);
  return v_run;
end;
$$;

-- Executada pelo pg_cron (papel postgres). Nenhum papel da API tem EXECUTE (BILLING §16).
create or replace function public.billing_run_daily()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.billing_run(
    (now() at time zone (select timezone from public.billing_settings limit 1))::date, 'cron');
end;
$$;

-- Execução manual pelo financeiro ("Executar rotina agora"): mesma lógica e mesmo lock.
create or replace function public.billing_run_now()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_billing_manager();
  return private.billing_run(private.billing_today(), 'manual');
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs do financeiro
-- -----------------------------------------------------------------------------
create or replace function public.billing_schedule_plan_change(
  p_subscription_id     uuid,
  p_plan_version_id     uuid,
  p_extra_professionals integer,
  p_reason              text
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
  if coalesce(p_extra_professionals, 0) > 0 and (
    select extra_professional_price_cents from public.subscription_plan_versions where id = p_plan_version_id
  ) is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  update public.subscription_scheduled_changes set status = 'canceled'
  where subscription_id = v_sub.id and status = 'pending';
  insert into public.subscription_scheduled_changes
    (establishment_id, subscription_id, plan_version_id, extra_professionals, effective_on, reason, created_by)
  values (v_sub.establishment_id, v_sub.id, p_plan_version_id, coalesce(p_extra_professionals, 0),
          private.billing_cycle_start(v_sub.anchor_date, v_sub.anchor_day, v_sub.interval, v_sub.next_cycle_index)
            - (select issue_days_before_due from public.billing_settings limit 1),
          nullif(trim(p_reason), ''), (select auth.uid()))
  returning id into v_id;
  perform private.write_audit('billing.plan_change_scheduled', v_sub.establishment_id, 'subscription', v_sub.id,
    jsonb_build_object('to_version', p_plan_version_id, 'extra', p_extra_professionals));
  return v_id;
end;
$$;

create or replace function public.billing_set_subscription_dunning(
  p_subscription_id uuid, p_auto_suspend_override boolean, p_grace_days_override integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
begin
  perform private.assert_billing_manager();
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  begin
    update public.subscriptions
       set auto_suspend_override = p_auto_suspend_override, grace_days_override = p_grace_days_override
     where id = p_subscription_id;
  exception when check_violation then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end;
  perform private.write_audit('billing.dunning_override_set', v_sub.establishment_id, 'subscription', v_sub.id,
    jsonb_build_object('auto_suspend_override', p_auto_suspend_override, 'grace_days_override', p_grace_days_override));
end;
$$;

-- Régua e prazos: somente Super Admin (configuração de cobrança).
create or replace function public.billing_update_dunning(
  p_issue_days_before_due smallint,
  p_past_due_after_days   smallint,
  p_grace_days            smallint,
  p_auto_suspend_enabled  boolean,
  p_dunning_offsets       smallint[]
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
       set issue_days_before_due = p_issue_days_before_due,
           past_due_after_days = p_past_due_after_days,
           grace_days = p_grace_days,
           auto_suspend_enabled = p_auto_suspend_enabled,
           dunning_offsets = (select array_agg(distinct o order by o) from unnest(p_dunning_offsets) o
                              where o between -30 and 60)
     where id;
  exception when check_violation or not_null_violation then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end;
  perform private.write_audit('billing.dunning_updated', null, 'billing_settings', null,
    jsonb_build_object('issue_days', p_issue_days_before_due, 'past_due_after', p_past_due_after_days,
                       'grace_days', p_grace_days, 'auto_suspend', p_auto_suspend_enabled,
                       'offsets', p_dunning_offsets));
end;
$$;

-- Correção: o Supabase exige WHERE em todo UPDATE (pg-safeupdate); a linha única é id = true.
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
           default_setup_fee_cents = p_default_setup_fee_cents
     where id;
  exception when check_violation or not_null_violation then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end;
  perform private.write_audit('billing.settings_updated', null, 'billing_settings', null,
    jsonb_build_object('pix_key_type', p_pix_key_type, 'default_setup_fee_cents', p_default_setup_fee_cents));
end;
$$;

-- "Cobranças do dia": avisos pendentes com o necessário para o envio manual pelo WhatsApp.
create or replace function public.billing_collections_today()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_billing_manager();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', n.id, 'kind', n.kind, 'days_from_due', n.days_from_due, 'created_at', n.created_at,
             'invoice_id', i.id, 'number', i.number, 'due_date', i.due_date,
             'balance_cents', i.total_cents - i.amount_paid_cents, 'invoice_status', i.status,
             'establishment_id', e.id, 'establishment_name', e.name, 'slug', e.slug,
             'whatsapp_e164', e.whatsapp_e164,
             'pix_key', i.payment_instructions ->> 'pix_key',
             'pix_receiver_name', i.payment_instructions ->> 'pix_receiver_name')
           order by n.days_from_due desc, n.created_at)
    from public.billing_notifications n
    join public.invoices i on i.id = n.invoice_id
    join public.establishments e on e.id = n.establishment_id
    where n.status = 'pending' and n.channel = 'in_app'
      and i.status in ('open', 'partially_paid', 'overdue')
  ), '[]'::jsonb);
end;
$$;

-- Registra que a cobrança foi enviada manualmente (ou dispensada).
create or replace function public.billing_mark_notification(p_notification_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_billing_manager();
  if p_status not in ('sent', 'dismissed') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  update public.billing_notifications
     set status = p_status, sent_at = now(), sent_by = (select auth.uid())
   where id = p_notification_id and status = 'pending';
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS e grants
-- -----------------------------------------------------------------------------
alter table public.subscription_scheduled_changes enable row level security;
alter table public.billing_notifications          enable row level security;
alter table public.billing_job_runs               enable row level security;

create policy subscription_scheduled_changes_select on public.subscription_scheduled_changes
  for select to authenticated using ((select private.has_platform_permission('billing.manage')));
create policy billing_notifications_select on public.billing_notifications
  for select to authenticated using (
    (select private.has_platform_permission('billing.manage')) or (select private.is_establishment_admin(establishment_id))
  );
create policy billing_job_runs_select on public.billing_job_runs
  for select to authenticated using ((select private.has_platform_permission('billing.manage')));

revoke all on public.subscription_scheduled_changes, public.billing_notifications, public.billing_job_runs
  from anon, authenticated;
grant select on public.subscription_scheduled_changes, public.billing_notifications, public.billing_job_runs
  to authenticated;
grant select, insert, update on public.subscription_scheduled_changes, public.billing_notifications,
      public.billing_job_runs to service_role;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.establishment_mode(uuid) to authenticated, service_role;
grant execute on function private.billing_cycle_start(date, integer, public.billing_interval, integer) to authenticated, service_role;

-- A rotina diária não é executável por nenhum papel da API (só pelo dono/pg_cron).
revoke execute on function public.billing_run_daily() from public, anon, authenticated, service_role;

do $$
declare
  f text;
begin
  foreach f in array array[
    'billing_run_now()',
    'billing_schedule_plan_change(uuid, uuid, integer, text)',
    'billing_set_subscription_dunning(uuid, boolean, integer)',
    'billing_update_dunning(smallint, smallint, smallint, boolean, smallint[])',
    'billing_collections_today()',
    'billing_mark_notification(uuid, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- Agendamento no pg_cron: 06:15 e 18:15 em São Paulo (09:15 e 21:15 UTC) e limpeza do rate limit.
-- Ambientes sem pg_cron (harness de testes) seguem sem agendamento.
-- -----------------------------------------------------------------------------
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron indisponível neste ambiente: rotina não agendada (%).', sqlerrm;
    return;
  end;
  perform cron.schedule('billing-run-daily-am', '15 9 * * *', 'select public.billing_run_daily()');
  perform cron.schedule('billing-run-daily-pm', '15 21 * * *', 'select public.billing_run_daily()');
  perform cron.schedule('rate-limits-cleanup', '7 * * * *',
    $cron$delete from private.rate_limits where window_start < now() - interval '1 day'$cron$);
end
$$;
