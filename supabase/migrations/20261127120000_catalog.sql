-- =============================================================================
-- 09 · Catálogo: profissionais, categorias, serviços e habilitações
-- Referência: DATABASE.md §5.8–§5.11, §6; SECURITY.md §3
-- Escrita de cadastro simples direto na tabela (owner/admin via RLS); perfil do próprio
-- profissional, foto e vínculo com usuário via RPC.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- professionals
-- -----------------------------------------------------------------------------
create table public.professionals (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  user_id          uuid references public.profiles (id) on delete set null,
  display_name     text not null check (char_length(display_name) between 1 and 80),
  bio              text check (bio is null or char_length(bio) <= 500),
  specialties      text[] not null default '{}' check (cardinality(specialties) <= 10),
  photo_path       text check (photo_path is null or char_length(photo_path) <= 300),
  is_bookable      boolean not null default true,
  is_active        boolean not null default true,
  sort_order       smallint not null default 0,
  deactivated_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint professionals_tenant_uk unique (establishment_id, id)
);

create unique index professionals_one_per_user on public.professionals (establishment_id, user_id)
  where user_id is not null;
create index professionals_establishment_active_idx on public.professionals (establishment_id, sort_order)
  where is_active;

create trigger professionals_set_updated_at before update on public.professionals
  for each row execute function private.set_updated_at();
create trigger professionals_tenant_immutable before update on public.professionals
  for each row execute function private.prevent_tenant_change();

-- Regras: deactivated_at acompanha is_active; especialidades curtas; user_id só por RPC
-- e somente para quem é membro ativo do mesmo estabelecimento.
create or replace function private.validate_professional()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.is_active is distinct from old.is_active then
    new.deactivated_at := case when new.is_active then null else now() end;
  end if;

  if exists (select 1 from unnest(new.specialties) s where char_length(s) not between 1 and 40) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if (tg_op = 'INSERT' and new.user_id is not null)
     or (tg_op = 'UPDATE' and new.user_id is distinct from old.user_id) then
    if not private.is_privileged_context() then
      raise exception using errcode = 'P0001', message = 'FORBIDDEN_COLUMN';
    end if;
  end if;

  return new;
end;
$$;

create trigger professionals_validate before insert or update on public.professionals
  for each row execute function private.validate_professional();

-- -----------------------------------------------------------------------------
-- service_categories
-- -----------------------------------------------------------------------------
create table public.service_categories (
  id               uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 60),
  sort_order       smallint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint service_categories_tenant_uk unique (establishment_id, id)
);

create unique index service_categories_name_uk on public.service_categories (establishment_id, lower(name));

create trigger service_categories_set_updated_at before update on public.service_categories
  for each row execute function private.set_updated_at();
create trigger service_categories_tenant_immutable before update on public.service_categories
  for each row execute function private.prevent_tenant_change();

-- -----------------------------------------------------------------------------
-- services
-- -----------------------------------------------------------------------------
create table public.services (
  id                    uuid primary key default gen_random_uuid(),
  establishment_id      uuid not null references public.establishments (id) on delete cascade,
  category_id           uuid,
  name                  text not null check (char_length(name) between 1 and 80),
  description           text check (description is null or char_length(description) <= 500),
  price_cents           integer not null check (price_cents between 0 and 10000000),
  duration_minutes      smallint not null check (duration_minutes between 5 and 720),
  buffer_before_minutes smallint not null default 0 check (buffer_before_minutes between 0 and 120),
  buffer_after_minutes  smallint not null default 0 check (buffer_after_minutes between 0 and 120),
  is_active             boolean not null default true,
  is_public             boolean not null default true,
  sort_order            smallint not null default 0,
  archived_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint services_tenant_uk unique (establishment_id, id),
  -- Categoria do mesmo estabelecimento; ao excluir a categoria, só category_id vira nulo.
  constraint services_category_fk foreign key (establishment_id, category_id)
    references public.service_categories (establishment_id, id) on delete set null (category_id),
  -- Serviço arquivado nunca fica ativo.
  constraint services_archived_inactive check (archived_at is null or not is_active)
);

create index services_establishment_idx on public.services (establishment_id, is_active, sort_order);

create trigger services_set_updated_at before update on public.services
  for each row execute function private.set_updated_at();
create trigger services_tenant_immutable before update on public.services
  for each row execute function private.prevent_tenant_change();

-- Mudanças de preço/duração ficam na auditoria (histórico comercial do estabelecimento).
create or replace function private.audit_service_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.price_cents is distinct from old.price_cents or new.duration_minutes is distinct from old.duration_minutes then
    perform private.write_audit('service.price_changed', new.establishment_id, 'service', new.id,
      jsonb_build_object(
        'name', new.name,
        'price_from', old.price_cents, 'price_to', new.price_cents,
        'duration_from', old.duration_minutes, 'duration_to', new.duration_minutes
      ));
  end if;
  return new;
end;
$$;

create trigger services_audit after update on public.services
  for each row execute function private.audit_service_change();

-- -----------------------------------------------------------------------------
-- professional_services (habilitações)
-- -----------------------------------------------------------------------------
create table public.professional_services (
  establishment_id uuid not null,
  professional_id  uuid not null,
  service_id       uuid not null,
  created_at       timestamptz not null default now(),
  primary key (professional_id, service_id),
  constraint professional_services_professional_fk foreign key (establishment_id, professional_id)
    references public.professionals (establishment_id, id) on delete cascade,
  constraint professional_services_service_fk foreign key (establishment_id, service_id)
    references public.services (establishment_id, id) on delete cascade
);

create index professional_services_service_idx on public.professional_services (service_id);

-- -----------------------------------------------------------------------------
-- Auxiliar: profissional do usuário atual no estabelecimento
-- -----------------------------------------------------------------------------
create or replace function private.my_professional_id(p_establishment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.professionals p
  where p.establishment_id = p_establishment_id
    and p.user_id = (select auth.uid())
    and p.is_active
    and private.is_member(p_establishment_id);
$$;

-- -----------------------------------------------------------------------------
-- RPCs de perfil e vínculo
-- -----------------------------------------------------------------------------

-- O próprio profissional edita nome de exibição, bio e especialidades (E3-10).
create or replace function public.update_my_professional_profile(
  p_establishment_id uuid,
  p_display_name     text,
  p_bio              text,
  p_specialties      text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := private.my_professional_id(p_establishment_id);
begin
  if v_id is null then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  update public.professionals
     set display_name = trim(p_display_name),
         bio = nullif(trim(p_bio), ''),
         specialties = coalesce(p_specialties, '{}')
   where id = v_id;
end;
$$;

-- Foto: owner/admin para qualquer profissional; o próprio profissional para si.
create or replace function public.set_professional_photo(p_professional_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_est uuid;
begin
  select establishment_id into v_est from public.professionals where id = p_professional_id;
  if v_est is null then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if not (private.is_establishment_admin(v_est) or private.my_professional_id(v_est) = p_professional_id) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if p_path is not null and p_path not like v_est::text || '/professionals/' || p_professional_id::text || '/%' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  update public.professionals set photo_path = p_path where id = p_professional_id;
end;
$$;

-- Vincula (ou desvincula, com p_user_id nulo) a conta de um membro da equipe ao profissional.
create or replace function public.link_professional_user(p_professional_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_est uuid;
begin
  select establishment_id into v_est from public.professionals where id = p_professional_id for update;
  if v_est is null then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if not private.is_establishment_admin(v_est) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  if p_user_id is not null and not exists (
    select 1 from public.establishment_members m
    where m.establishment_id = v_est and m.user_id = p_user_id and m.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'NOT_A_MEMBER';
  end if;

  begin
    update public.professionals set user_id = p_user_id where id = p_professional_id;
  exception
    when unique_violation then
      raise exception using errcode = 'P0001', message = 'ALREADY_LINKED';
  end;

  perform private.write_audit('professional.user_linked', v_est, 'professional', p_professional_id,
    jsonb_build_object('linked', p_user_id is not null));
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs da equipe (SECURITY.md §3 e §6)
-- -----------------------------------------------------------------------------

-- Quem pode alterar o vínculo de quem:
--   Super Admin: qualquer vínculo (exceto transformar em owner — use o fluxo de convite);
--   owner: admin e staff; admin: apenas staff. Ninguém altera o próprio vínculo.
create or replace function private.assert_can_manage_member(p_member public.establishment_members)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_my_role public.member_role := private.member_role(p_member.establishment_id);
begin
  if p_member.user_id = (select auth.uid()) then
    raise exception using errcode = 'P0001', message = 'CANNOT_CHANGE_SELF';
  end if;
  if private.is_platform_admin() then
    return;
  end if;
  if p_member.role = 'owner'
     or v_my_role is null
     or v_my_role = 'staff'
     or (v_my_role = 'admin' and p_member.role <> 'staff') then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
end;
$$;

create or replace function public.update_member_role(p_member_id uuid, p_role public.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.establishment_members;
begin
  select * into v_member from public.establishment_members where id = p_member_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  perform private.assert_can_manage_member(v_member);

  if p_role = 'owner' then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if v_member.role = p_role then
    return;
  end if;

  update public.establishment_members set role = p_role where id = p_member_id;

  perform private.write_audit('member.role_changed', v_member.establishment_id, 'member', p_member_id,
    jsonb_build_object('from', v_member.role, 'to', p_role));
end;
$$;

create or replace function public.set_member_active(p_member_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.establishment_members;
begin
  select * into v_member from public.establishment_members where id = p_member_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  perform private.assert_can_manage_member(v_member);

  if v_member.is_active = p_active then
    return;
  end if;

  update public.establishment_members set is_active = p_active where id = p_member_id;

  -- Quem sai da equipe deixa de atender: o perfil profissional vinculado é desativado
  -- (histórico preservado; pode ser reativado pelo admin).
  if not p_active then
    update public.professionals
       set is_active = false
     where establishment_id = v_member.establishment_id and user_id = v_member.user_id and is_active;
  end if;

  perform private.write_audit(case when p_active then 'member.reactivated' else 'member.deactivated' end,
    v_member.establishment_id, 'member', p_member_id, jsonb_build_object('role', v_member.role));
end;
$$;

-- -----------------------------------------------------------------------------
-- Contexto da sessão: inclui o profissional vinculado em cada estabelecimento
-- -----------------------------------------------------------------------------
create or replace function public.get_session_context()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case when (select auth.uid()) is null then null else
    jsonb_build_object(
      'user_id', (select auth.uid()),
      'full_name', (select p.full_name from public.profiles p where p.id = (select auth.uid())),
      'email', (select p.email from public.profiles p where p.id = (select auth.uid())),
      'platform_role', (
        select pa.platform_role from public.platform_admins pa where pa.user_id = (select auth.uid())
      ),
      'memberships', coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'establishment_id', e.id,
                   'slug', e.slug,
                   'name', e.name,
                   'status', e.status,
                   'role', m.role,
                   'accent_color', e.accent_color,
                   'timezone', e.timezone,
                   'professional_id', (
                     select pr.id from public.professionals pr
                     where pr.establishment_id = e.id and pr.user_id = m.user_id and pr.is_active
                   )
                 )
                 order by m.created_at
               )
        from public.establishment_members m
        join public.establishments e on e.id = m.establishment_id
        where m.user_id = (select auth.uid())
          and m.is_active
          and e.status <> 'deactivated'
      ), '[]'::jsonb)
    )
  end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.professionals          enable row level security;
alter table public.service_categories     enable row level security;
alter table public.services               enable row level security;
alter table public.professional_services  enable row level security;

create policy professionals_select on public.professionals for select to authenticated
  using ((select private.is_member(establishment_id)) or (select private.is_platform_admin()));
create policy professionals_insert on public.professionals for insert to authenticated
  with check ((select private.is_establishment_admin(establishment_id)));
create policy professionals_update on public.professionals for update to authenticated
  using ((select private.is_establishment_admin(establishment_id)))
  with check ((select private.is_establishment_admin(establishment_id)));

create policy service_categories_select on public.service_categories for select to authenticated
  using ((select private.is_member(establishment_id)));
create policy service_categories_insert on public.service_categories for insert to authenticated
  with check ((select private.is_establishment_admin(establishment_id)));
create policy service_categories_update on public.service_categories for update to authenticated
  using ((select private.is_establishment_admin(establishment_id)))
  with check ((select private.is_establishment_admin(establishment_id)));
create policy service_categories_delete on public.service_categories for delete to authenticated
  using ((select private.is_establishment_admin(establishment_id)));

create policy services_select on public.services for select to authenticated
  using ((select private.is_member(establishment_id)));
create policy services_insert on public.services for insert to authenticated
  with check ((select private.is_establishment_admin(establishment_id)));
create policy services_update on public.services for update to authenticated
  using ((select private.is_establishment_admin(establishment_id)))
  with check ((select private.is_establishment_admin(establishment_id)));

create policy professional_services_select on public.professional_services for select to authenticated
  using ((select private.is_member(establishment_id)));
create policy professional_services_insert on public.professional_services for insert to authenticated
  with check ((select private.is_establishment_admin(establishment_id)));
create policy professional_services_delete on public.professional_services for delete to authenticated
  using ((select private.is_establishment_admin(establishment_id)));

-- -----------------------------------------------------------------------------
-- Grants (explícitos — CLAUDE.md §5)
-- -----------------------------------------------------------------------------
revoke all on public.professionals, public.service_categories, public.services,
              public.professional_services from anon, authenticated;
grant select, insert, delete, update on public.professionals, public.service_categories,
      public.services, public.professional_services to service_role;

grant select, insert on public.professionals to authenticated;
-- user_id e establishment_id não são editáveis pela API (vínculo via RPC; tenant imutável).
grant update (display_name, bio, specialties, photo_path, is_bookable, is_active, sort_order)
  on public.professionals to authenticated;

grant select, insert, update, delete on public.service_categories to authenticated;

grant select, insert on public.services to authenticated;
grant update (category_id, name, description, price_cents, duration_minutes, buffer_before_minutes,
              buffer_after_minutes, is_active, is_public, sort_order, archived_at)
  on public.services to authenticated;

grant select, insert, delete on public.professional_services to authenticated;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.my_professional_id(uuid) to authenticated, service_role;

revoke execute on function public.update_my_professional_profile(uuid, text, text, text[]) from public, anon;
revoke execute on function public.set_professional_photo(uuid, text) from public, anon;
revoke execute on function public.link_professional_user(uuid, uuid) from public, anon;
revoke execute on function public.update_member_role(uuid, public.member_role) from public, anon;
revoke execute on function public.set_member_active(uuid, boolean) from public, anon;
revoke execute on function public.get_session_context() from public, anon;
grant execute on function public.update_my_professional_profile(uuid, text, text, text[]) to authenticated;
grant execute on function public.set_professional_photo(uuid, text) to authenticated;
grant execute on function public.link_professional_user(uuid, uuid) to authenticated;
grant execute on function public.update_member_role(uuid, public.member_role) to authenticated;
grant execute on function public.set_member_active(uuid, boolean) to authenticated;
grant execute on function public.get_session_context() to authenticated;
