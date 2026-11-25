-- =============================================================================
-- 04 · Plataforma: e-mail no profile, RPCs de estabelecimentos e convites
-- Referência: DATABASE.md §10.3; SECURITY.md §3, §5, §6; BACKLOG E2-1, E2-5, E2-6, E2-7
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles.email (espelho de auth.users.email, para listagens do painel)
-- -----------------------------------------------------------------------------
alter table public.profiles add column email extensions.citext;

update public.profiles p set email = u.email from auth.users u where u.id = p.id;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  if v_name is null then
    v_name := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Usuário');
  end if;

  insert into public.profiles (id, full_name, email)
  values (new.id, left(v_name, 120), new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function private.sync_auth_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id and email is distinct from new.email;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function private.sync_auth_user_email();

-- -----------------------------------------------------------------------------
-- Tokens de convite
-- -----------------------------------------------------------------------------

-- 256 bits aleatórios em base64url (43 caracteres). Só o SHA-256 é gravado.
create or replace function private.new_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
$$;

create or replace function private.hash_token(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select extensions.digest(convert_to(p_token, 'UTF8'), 'sha256');
$$;

-- Emite um convite (revoga o pendente anterior para o mesmo e-mail) e devolve o token UMA vez.
create or replace function private.issue_invitation(
  p_establishment_id uuid,
  p_email            text,
  p_role             public.member_role
)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := private.new_token();
  v_email extensions.citext := lower(trim(p_email));
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_role = 'owner' and exists (
    select 1 from public.establishment_members m
    where m.establishment_id = p_establishment_id and m.role = 'owner' and m.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'OWNER_EXISTS';
  end if;

  if exists (
    select 1
    from public.establishment_members m
    join public.profiles p on p.id = m.user_id
    where m.establishment_id = p_establishment_id and m.is_active and p.email = v_email
  ) then
    raise exception using errcode = 'P0001', message = 'ALREADY_MEMBER';
  end if;

  update public.establishment_invitations i
     set revoked_at = now()
   where i.establishment_id = p_establishment_id
     and i.email = v_email
     and i.accepted_at is null
     and i.revoked_at is null;

  return query
  insert into public.establishment_invitations (establishment_id, email, role, token_hash, invited_by)
  values (p_establishment_id, v_email, p_role, private.hash_token(v_token), (select auth.uid()))
  returning id, v_token, establishment_invitations.expires_at;
end;
$$;

-- Quem pode convidar quem (SECURITY.md §3): owner só pelo Super Admin; admin convida admin/staff.
create or replace function private.assert_can_manage_invitation(
  p_establishment_id uuid,
  p_role             public.member_role
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.is_platform_admin() then
    return;
  end if;
  if p_role = 'owner' or not private.is_establishment_admin(p_establishment_id) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Estabelecimentos (Super Admin)
-- -----------------------------------------------------------------------------

create or replace function public.create_establishment(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id         uuid;
  v_slug       text;
  v_invite_id  uuid;
  v_token      text;
  v_expires_at timestamptz;
begin
  perform private.assert_platform_admin();

  begin
    insert into public.establishments (
      slug, name, business_type, timezone, description, owner_name, owner_email,
      phone_e164, whatsapp_e164, instagram_handle,
      address_street, address_number, address_complement, address_district,
      address_city, address_state, address_postal_code, accent_color, created_by
    ) values (
      lower(trim(p_data ->> 'slug')),
      trim(p_data ->> 'name'),
      coalesce(nullif(p_data ->> 'business_type', '')::public.business_type, 'barbershop'),
      coalesce(nullif(p_data ->> 'timezone', ''), 'America/Sao_Paulo'),
      nullif(trim(p_data ->> 'description'), ''),
      nullif(trim(p_data ->> 'owner_name'), ''),
      nullif(lower(trim(p_data ->> 'owner_email')), ''),
      nullif(p_data ->> 'phone_e164', ''),
      nullif(p_data ->> 'whatsapp_e164', ''),
      nullif(trim(p_data ->> 'instagram_handle'), ''),
      nullif(trim(p_data ->> 'address_street'), ''),
      nullif(trim(p_data ->> 'address_number'), ''),
      nullif(trim(p_data ->> 'address_complement'), ''),
      nullif(trim(p_data ->> 'address_district'), ''),
      nullif(trim(p_data ->> 'address_city'), ''),
      nullif(upper(trim(p_data ->> 'address_state')), ''),
      nullif(p_data ->> 'address_postal_code', ''),
      coalesce(nullif(p_data ->> 'accent_color', ''), '#18181B'),
      (select auth.uid())
    )
    returning id, slug into v_id, v_slug;
  exception
    when unique_violation then
      raise exception using errcode = 'P0001', message = 'SLUG_TAKEN';
  end;

  perform private.write_audit('establishment.created', v_id, 'establishment', v_id,
    jsonb_build_object('slug', v_slug, 'name', trim(p_data ->> 'name')));

  if nullif(trim(p_data ->> 'owner_email'), '') is not null then
    select i.invitation_id, i.token, i.expires_at into v_invite_id, v_token, v_expires_at
    from private.issue_invitation(v_id, p_data ->> 'owner_email', 'owner') i;
    perform private.write_audit('member.invited', v_id, 'invitation', v_invite_id,
      jsonb_build_object('role', 'owner'));
  end if;

  return jsonb_build_object(
    'id', v_id,
    'slug', v_slug,
    'invitation_token', v_token,
    'invitation_expires_at', v_expires_at
  );
end;
$$;

create or replace function public.update_establishment(p_id uuid, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.establishments;
  v_after  public.establishments;
  v_changed text[];
begin
  perform private.assert_platform_admin();

  select * into v_before from public.establishments where id = p_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  begin
    update public.establishments set
      slug                = lower(trim(p_data ->> 'slug')),
      name                = trim(p_data ->> 'name'),
      business_type       = coalesce(nullif(p_data ->> 'business_type', '')::public.business_type, business_type),
      timezone            = coalesce(nullif(p_data ->> 'timezone', ''), timezone),
      description         = nullif(trim(p_data ->> 'description'), ''),
      owner_name          = nullif(trim(p_data ->> 'owner_name'), ''),
      owner_email         = nullif(lower(trim(p_data ->> 'owner_email')), ''),
      phone_e164          = nullif(p_data ->> 'phone_e164', ''),
      whatsapp_e164       = nullif(p_data ->> 'whatsapp_e164', ''),
      instagram_handle    = nullif(trim(p_data ->> 'instagram_handle'), ''),
      address_street      = nullif(trim(p_data ->> 'address_street'), ''),
      address_number      = nullif(trim(p_data ->> 'address_number'), ''),
      address_complement  = nullif(trim(p_data ->> 'address_complement'), ''),
      address_district    = nullif(trim(p_data ->> 'address_district'), ''),
      address_city        = nullif(trim(p_data ->> 'address_city'), ''),
      address_state       = nullif(upper(trim(p_data ->> 'address_state')), ''),
      address_postal_code = nullif(p_data ->> 'address_postal_code', ''),
      accent_color        = coalesce(nullif(p_data ->> 'accent_color', ''), accent_color)
    where id = p_id
    returning * into v_after;
  exception
    when unique_violation then
      raise exception using errcode = 'P0001', message = 'SLUG_TAKEN';
  end;

  select coalesce(array_agg(b.key order by b.key), '{}')
    into v_changed
  from jsonb_each(to_jsonb(v_before)) b
  join jsonb_each(to_jsonb(v_after)) a using (key)
  where a.value is distinct from b.value and b.key not in ('updated_at');

  perform private.write_audit('establishment.updated', p_id, 'establishment', p_id,
    jsonb_build_object('changed', v_changed)
      || case when v_before.slug is distinct from v_after.slug
              then jsonb_build_object('slug_from', v_before.slug, 'slug_to', v_after.slug)
              else '{}'::jsonb end);
end;
$$;

create or replace function public.set_establishment_status(
  p_id     uuid,
  p_status public.establishment_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from public.establishment_status;
begin
  perform private.assert_platform_admin();

  select status into v_from from public.establishments where id = p_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_from = p_status then
    return;
  end if;
  if p_status <> 'active' and char_length(coalesce(trim(p_reason), '')) < 3 then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;

  update public.establishments set status = p_status where id = p_id;

  perform private.write_audit('establishment.status_changed', p_id, 'establishment', p_id,
    jsonb_build_object('from', v_from, 'to', p_status, 'reason', nullif(trim(p_reason), '')));
end;
$$;

-- Logo e capa: Super Admin ou owner/admin do estabelecimento. O upload é feito pelo servidor
-- (validação de tipo/tamanho) e o caminho precisa estar na pasta do próprio estabelecimento.
create or replace function public.set_establishment_image(p_id uuid, p_kind text, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (private.is_platform_admin() or private.is_establishment_admin(p_id)) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if p_kind not in ('logo', 'cover') then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;
  if p_path is not null and p_path not like p_id::text || '/' || p_kind || '/%' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_kind = 'logo' then
    update public.establishments set logo_path = p_path where id = p_id;
  else
    update public.establishments set cover_path = p_path where id = p_id;
  end if;

  perform private.write_audit('establishment.image_updated', p_id, 'establishment', p_id,
    jsonb_build_object('kind', p_kind, 'removed', p_path is null));
end;
$$;

-- -----------------------------------------------------------------------------
-- Convites
-- -----------------------------------------------------------------------------

create or replace function public.create_invitation(
  p_establishment_id uuid,
  p_email            text,
  p_role             public.member_role
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite record;
  v_status public.establishment_status;
begin
  perform private.assert_can_manage_invitation(p_establishment_id, p_role);

  select status into v_status from public.establishments where id = p_establishment_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_status = 'deactivated' then
    raise exception using errcode = 'P0001', message = 'ESTABLISHMENT_UNAVAILABLE';
  end if;

  select * into v_invite from private.issue_invitation(p_establishment_id, p_email, p_role);

  perform private.write_audit('member.invited', p_establishment_id, 'invitation', v_invite.invitation_id,
    jsonb_build_object('role', p_role));

  return jsonb_build_object('id', v_invite.invitation_id, 'token', v_invite.token, 'expires_at', v_invite.expires_at);
end;
$$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.establishment_invitations;
begin
  select * into v_inv from public.establishment_invitations where id = p_invitation_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  perform private.assert_can_manage_invitation(v_inv.establishment_id, v_inv.role);

  if v_inv.accepted_at is not null or v_inv.revoked_at is not null then
    raise exception using errcode = 'P0001', message = 'INVITATION_INVALID';
  end if;

  update public.establishment_invitations set revoked_at = now() where id = p_invitation_id;

  perform private.write_audit('member.invitation_revoked', v_inv.establishment_id, 'invitation', p_invitation_id,
    jsonb_build_object('role', v_inv.role));
end;
$$;

-- Leitura do convite pela página pública /convite/[token]. Somente service_role (servidor).
create or replace function public.get_invitation_by_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  select i.id, i.email::text as email, i.role, i.expires_at, i.accepted_at, i.revoked_at,
         e.name as establishment_name, e.status as establishment_status
    into v_row
  from public.establishment_invitations i
  join public.establishments e on e.id = i.establishment_id
  where i.token_hash = private.hash_token(p_token);

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  return jsonb_build_object(
    'status', case
      when v_row.accepted_at is not null then 'accepted'
      when v_row.revoked_at is not null then 'revoked'
      when v_row.expires_at <= now() then 'expired'
      when v_row.establishment_status = 'deactivated' then 'invalid'
      else 'pending'
    end,
    'email', v_row.email,
    'role', v_row.role,
    'establishment_name', v_row.establishment_name,
    'has_account', exists (select 1 from public.profiles p where p.email = v_row.email)
  );
end;
$$;

-- Aceite pelo usuário autenticado cujo e-mail coincide com o do convite.
create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_email text;
  v_inv   public.establishment_invitations;
  v_est   public.establishments;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select * into v_inv
  from public.establishment_invitations
  where token_hash = private.hash_token(p_token)
  for update;

  if not found or v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'INVITATION_INVALID';
  end if;

  select * into v_est from public.establishments where id = v_inv.establishment_id;
  if v_est.status = 'deactivated' then
    raise exception using errcode = 'P0001', message = 'INVITATION_INVALID';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;
  if v_email is null or lower(v_email) <> lower(v_inv.email::text) then
    raise exception using errcode = 'P0001', message = 'INVITATION_EMAIL_MISMATCH';
  end if;

  if v_inv.role = 'owner' and exists (
    select 1 from public.establishment_members m
    where m.establishment_id = v_inv.establishment_id and m.role = 'owner' and m.is_active and m.user_id <> v_uid
  ) then
    raise exception using errcode = 'P0001', message = 'OWNER_EXISTS';
  end if;

  insert into public.establishment_members (establishment_id, user_id, role, invited_by)
  values (v_inv.establishment_id, v_uid, v_inv.role, v_inv.invited_by)
  on conflict (establishment_id, user_id)
  do update set role = excluded.role, is_active = true;

  update public.establishment_invitations
     set accepted_at = now(), accepted_by = v_uid
   where id = v_inv.id;

  perform private.write_audit('member.invitation_accepted', v_inv.establishment_id, 'invitation', v_inv.id,
    jsonb_build_object('role', v_inv.role), 'member');

  return jsonb_build_object('establishment_id', v_est.id, 'slug', v_est.slug, 'role', v_inv.role);
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon;

revoke execute on function public.create_establishment(jsonb) from public, anon;
revoke execute on function public.update_establishment(uuid, jsonb) from public, anon;
revoke execute on function public.set_establishment_status(uuid, public.establishment_status, text) from public, anon;
revoke execute on function public.set_establishment_image(uuid, text, text) from public, anon;
revoke execute on function public.create_invitation(uuid, text, public.member_role) from public, anon;
revoke execute on function public.revoke_invitation(uuid) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
revoke execute on function public.get_invitation_by_token(text) from public, anon, authenticated;

grant execute on function public.create_establishment(jsonb) to authenticated;
grant execute on function public.update_establishment(uuid, jsonb) to authenticated;
grant execute on function public.set_establishment_status(uuid, public.establishment_status, text) to authenticated;
grant execute on function public.set_establishment_image(uuid, text, text) to authenticated;
grant execute on function public.create_invitation(uuid, text, public.member_role) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.get_invitation_by_token(text) to service_role;

-- O e-mail do profile não é editável pelo usuário (vem do Auth).
revoke update on public.profiles from authenticated;
grant update (full_name, phone_e164, avatar_path) on public.profiles to authenticated;
