-- Uma tentativa de criação por fatura. Uma falha de rede pode ocorrer depois
-- de o gateway aceitar a cobrança, por isso novas consultas só buscam a referência.
create table private.asaas_sandbox_charges (
  invoice_id uuid primary key references public.invoices(id),
  amount_cents integer not null check (amount_cents between 1 and 100000000),
  received_charge_id text unique
);
alter table private.asaas_sandbox_charges enable row level security;

create function public.billing_reserve_asaas_sandbox_charge(
  p_invoice_id uuid, p_establishment_id uuid, p_amount_cents integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.invoices i
    where i.id = p_invoice_id and i.establishment_id = p_establishment_id
      and i.status in ('open', 'overdue', 'partially_paid')
      and i.total_cents - i.amount_paid_cents = p_amount_cents
    for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'INVOICE_BALANCE_CHANGED';
  end if;

  insert into private.asaas_sandbox_charges (invoice_id, amount_cents)
    values (p_invoice_id, p_amount_cents) on conflict do nothing;
  return found;
end;
$$;

create function public.billing_confirm_asaas_sandbox_payment(
  p_invoice_id uuid, p_charge_id text, p_amount_cents integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
  v_payment_id uuid;
  v_alloc integer;
  v_charge private.asaas_sandbox_charges;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  select * into v_charge from private.asaas_sandbox_charges where invoice_id = p_invoice_id;
  if not found or v_charge.amount_cents is distinct from p_amount_cents
    or p_charge_id is null or p_charge_id !~ '^pay_[a-zA-Z0-9]+$'
    or (v_charge.received_charge_id is not null and v_charge.received_charge_id <> p_charge_id)
  then
    raise exception using errcode = 'P0001', message = 'INVALID_ASAAS_CHARGE';
  end if;

  -- O identificador da cobrança também deduplica webhooks distintos para o mesmo Pix.
  insert into public.payments (
    establishment_id, method, amount_cents, received_on, provider, provider_payment_id
  ) values (
    v_invoice.establishment_id, 'pix', p_amount_cents, private.billing_today(),
    'asaas_sandbox', p_charge_id
  ) on conflict (provider, provider_payment_id) where provider is not null do nothing
  returning id into v_payment_id;
  if not found then
    return false;
  end if;

  update private.asaas_sandbox_charges set received_charge_id = p_charge_id where invoice_id = p_invoice_id;

  -- Se houve baixa manual ou cancelamento enquanto o QR estava aberto,
  -- conserva o recebimento excedente como saldo a alocar.
  if v_invoice.status in ('open', 'overdue', 'partially_paid') then
    v_alloc := least(p_amount_cents, v_invoice.total_cents - v_invoice.amount_paid_cents);
    if v_alloc > 0 then
      insert into public.payment_allocations (establishment_id, payment_id, invoice_id, amount_cents)
        values (v_invoice.establishment_id, v_payment_id, v_invoice.id, v_alloc);
      perform private.refresh_invoice(v_invoice.id);
    end if;
  end if;

  perform private.write_audit(
    'billing.sandbox_pix_received', v_invoice.establishment_id, 'payment', v_payment_id,
    jsonb_build_object('invoice_id', v_invoice.id, 'provider_charge_id', p_charge_id,
      'amount_cents', p_amount_cents, 'allocated_cents', coalesce(v_alloc, 0))
  );
  return true;
end;
$$;

revoke all on function public.billing_reserve_asaas_sandbox_charge(uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.billing_confirm_asaas_sandbox_payment(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.billing_reserve_asaas_sandbox_charge(uuid, uuid, integer) to service_role;
grant execute on function public.billing_confirm_asaas_sandbox_payment(uuid, text, integer) to service_role;
