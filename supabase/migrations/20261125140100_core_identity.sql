-- =============================================================================
-- 02 · Identidade: profiles, platform_admins, platform_settings, audit_logs
-- Referência: DATABASE.md §5.1–§5.3, §5.21; SECURITY.md §5–§6, §10
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles (1:1 com auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 1 and 120),
  phone_e164  text check (phone_e164 is null or private.is_e164(phone_e164)),
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Cria o profile automaticamente quando um usuário é criado no Auth.
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

  insert into public.profiles (id, full_name)
  values (new.id, left(v_name, 120))
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- platform_admins (Super Admin) — sem escrita pela API, nunca
-- -----------------------------------------------------------------------------
create table public.platform_admins (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  platform_role public.platform_role not null default 'super_admin',
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- platform_settings (configurações globais chave/valor)
-- -----------------------------------------------------------------------------
create table public.platform_settings (
  key        text primary key check (key ~ '^[a-z][a-z0-9_]{1,62}$'),
  value      jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function private.set_updated_at();

insert into public.platform_settings (key, value) values
  ('reserved_slugs', '["admin","painel","profissional","agendar","reserva","convite","login","logout","api","auth","inicio","recuperar-senha","redefinir-senha","assinatura","financeiro","configuracoes","suporte","ajuda","app","www","static","public","_next"]'::jsonb);

-- -----------------------------------------------------------------------------
-- audit_logs (append-only)
-- establishment_id sem FK de propósito: o log sobrevive a qualquer mudança no tenant.
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id               bigint generated always as identity primary key,
  establishment_id uuid,
  actor_user_id    uuid,
  actor_type       public.actor_type not null,
  action           text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  entity_type      text,
  entity_id        uuid,
  metadata         jsonb not null default '{}'::jsonb,
  ip_hash          text,
  created_at       timestamptz not null default now()
);

create index audit_logs_establishment_created_idx on public.audit_logs (establishment_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function private.forbid_update_delete();

-- -----------------------------------------------------------------------------
-- Auxiliares de autorização de plataforma
-- -----------------------------------------------------------------------------
create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = (select auth.uid())
      and pa.platform_role = 'super_admin'
  );
$$;

-- 'billing.manage' → super_admin e billing_manager; demais permissões → só super_admin.
create or replace function private.has_platform_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = (select auth.uid())
      and (
        pa.platform_role = 'super_admin'
        or (p_permission = 'billing.manage' and pa.platform_role = 'billing_manager')
      )
  );
$$;

create or replace function private.assert_platform_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
end;
$$;

-- Registro de auditoria a partir de RPCs (mesma transação da ação).
create or replace function private.write_audit(
  p_action           text,
  p_establishment_id uuid default null,
  p_entity_type      text default null,
  p_entity_id        uuid default null,
  p_metadata         jsonb default '{}'::jsonb,
  p_actor_type       public.actor_type default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  insert into public.audit_logs (establishment_id, actor_user_id, actor_type, action, entity_type, entity_id, metadata)
  values (
    p_establishment_id,
    v_uid,
    coalesce(
      p_actor_type,
      case
        when v_uid is null then 'system'::public.actor_type
        when private.is_platform_admin() then 'platform_admin'::public.actor_type
        else 'member'::public.actor_type
      end
    ),
    p_action,
    p_entity_type,
    p_entity_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_platform_admin() to authenticated, service_role;
grant execute on function private.has_platform_permission(text) to authenticated, service_role;
grant execute on function private.assert_platform_admin() to authenticated, service_role;
-- write_audit: somente funções privilegiadas (owner) e service_role.
grant execute on function private.write_audit(text, uuid, text, uuid, jsonb, public.actor_type) to service_role;

-- -----------------------------------------------------------------------------
-- Grants (defesa em profundidade além do RLS)
-- -----------------------------------------------------------------------------
revoke all on public.profiles, public.platform_admins, public.platform_settings, public.audit_logs from anon;

revoke insert, update, delete, truncate on public.profiles from authenticated;
grant update (full_name, phone_e164, avatar_path) on public.profiles to authenticated;

revoke insert, update, delete, truncate on public.platform_admins from authenticated;
revoke insert, update, delete, truncate on public.audit_logs from authenticated;
revoke delete, truncate on public.platform_settings from authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.platform_admins   enable row level security;
alter table public.platform_settings enable row level security;
alter table public.audit_logs        enable row level security;

-- profiles: o próprio, o Super Admin. (Membros do mesmo estabelecimento: migration 03.)
create policy profiles_select_self_or_platform on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_platform_admin()));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- platform_admins: cada um vê o próprio registro; Super Admin vê todos. Sem escrita.
create policy platform_admins_select on public.platform_admins
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_platform_admin()));

-- platform_settings: somente Super Admin.
create policy platform_settings_select on public.platform_settings
  for select to authenticated
  using ((select private.is_platform_admin()));

create policy platform_settings_insert on public.platform_settings
  for insert to authenticated
  with check ((select private.is_platform_admin()));

create policy platform_settings_update on public.platform_settings
  for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

-- audit_logs: Super Admin vê tudo (a política por estabelecimento é criada na migration 03).
create policy audit_logs_select_platform on public.audit_logs
  for select to authenticated
  using ((select private.is_platform_admin()));
