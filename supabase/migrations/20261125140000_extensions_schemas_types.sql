-- =============================================================================
-- 01 · Extensões, schemas, tipos e utilitários compartilhados
-- Referência: DATABASE.md §1–§2
-- =============================================================================

create extension if not exists pgcrypto   with schema extensions;  -- digest (SHA-256), gen_random_bytes
create extension if not exists citext     with schema extensions;  -- e-mail e slug sem diferenciar maiúsculas
create extension if not exists btree_gist with schema extensions;  -- EXCLUDE com igualdade + range

-- Schema privado: funções auxiliares de segurança e tabelas internas.
-- NUNCA adicionar aos schemas expostos da API (supabase/config.jsonc → api.schemas).
create schema if not exists private;
revoke all on schema private from public;
-- As políticas RLS executam funções deste schema no contexto do usuário da API.
grant usage on schema private to authenticated, service_role;
-- Funções de private não são executáveis por padrão: o grant global de EXECUTE para PUBLIC
-- não pode ser removido por schema, então cada migration termina com
-- `revoke execute on all functions in schema private from public, anon;` e grants explícitos.

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.timerange as range (subtype = time);

create type public.establishment_status as enum ('active', 'suspended', 'deactivated');
create type public.business_type        as enum ('barbershop', 'beauty_salon', 'nail_studio', 'aesthetics', 'other');
create type public.member_role          as enum ('owner', 'admin', 'staff');
create type public.appointment_status   as enum ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');
create type public.appointment_source   as enum ('public_page', 'admin_panel', 'professional_panel');
create type public.actor_type           as enum ('customer', 'member', 'platform_admin', 'system');
create type public.block_kind           as enum ('break', 'personal', 'vacation', 'day_off', 'absence', 'holiday', 'other');
create type public.date_override_kind   as enum ('closed', 'custom_hours');
create type public.pos_payment_method   as enum ('pix', 'cash', 'debit_card', 'credit_card', 'other');
create type public.platform_role        as enum ('super_admin', 'billing_manager');

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------

-- Atualiza updated_at em qualquer tabela que possua a coluna.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Verdadeiro quando a escrita vem de código privilegiado (RPC SECURITY DEFINER,
-- service_role no servidor, migrations), e não diretamente de um usuário da API.
-- Usado por triggers de guarda de colunas sensíveis.
-- Só faz sentido dentro de funções SECURITY INVOKER (triggers de guarda).
create or replace function private.is_privileged_context()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select current_user not in ('anon', 'authenticated');
$$;

-- establishment_id (e outras chaves de tenant) são imutáveis após o INSERT.
create or replace function private.prevent_tenant_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.establishment_id is distinct from old.establishment_id then
    raise exception using errcode = 'P0001', message = 'TENANT_IMMUTABLE';
  end if;
  return new;
end;
$$;

-- Tabelas append-only (auditoria, eventos).
create or replace function private.forbid_update_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'APPEND_ONLY';
end;
$$;

-- Validação de telefone E.164 (o formato brasileiro é normalizado na aplicação).
create or replace function private.is_e164(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p ~ '^\+[1-9][0-9]{7,14}$';
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_privileged_context() to authenticated, service_role;
grant execute on function private.is_e164(text) to authenticated, service_role;
