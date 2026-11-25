-- E2-1: cadastro de um tenant, configurações e auditoria na mesma transação.
create function public.create_establishment(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.assert_platform_admin();

  if jsonb_typeof(payload) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'INVALID_PAYLOAD';
  end if;

  -- Identidade, status e trilha de auditoria são definidos pelo banco.
  if exists (
    select 1 from jsonb_each(payload) as field(key, value)
    where field.key not in (
      'slug', 'name', 'business_type', 'timezone', 'owner_name', 'owner_email',
      'description', 'phone_e164', 'whatsapp_e164', 'instagram_handle', 'accent_color',
      'address_street', 'address_number', 'address_complement', 'address_district',
      'address_city', 'address_state', 'address_postal_code'
    ) or jsonb_typeof(field.value) not in ('string', 'null')
  ) then
    raise exception using errcode = '22023', message = 'INVALID_PAYLOAD';
  end if;

  if payload->>'owner_email' is not null
     and payload->>'owner_email' !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'INVALID_OWNER_EMAIL';
  end if;

  insert into public.establishments (
    slug, name, business_type, timezone, owner_name, owner_email, description,
    phone_e164, whatsapp_e164, instagram_handle, accent_color, address_street,
    address_number, address_complement, address_district, address_city,
    address_state, address_postal_code, created_by
  ) values (
    payload->>'slug', trim(payload->>'name'),
    coalesce(payload->>'business_type', 'barbershop')::public.business_type,
    coalesce(payload->>'timezone', 'America/Sao_Paulo'),
    payload->>'owner_name', payload->>'owner_email', payload->>'description',
    payload->>'phone_e164', payload->>'whatsapp_e164', payload->>'instagram_handle',
    coalesce(payload->>'accent_color', '#18181B'), payload->>'address_street',
    payload->>'address_number', payload->>'address_complement', payload->>'address_district',
    payload->>'address_city', payload->>'address_state', payload->>'address_postal_code',
    auth.uid()
  ) returning id into v_id;

  -- O trigger establishments_create_settings já aplica os padrões cadastrados no schema.
  perform private.write_audit('establishment.created', v_id, 'establishment', v_id);
  return v_id;
end;
$$;

revoke all on function public.create_establishment(jsonb) from public, anon, service_role;
grant execute on function public.create_establishment(jsonb) to authenticated;
