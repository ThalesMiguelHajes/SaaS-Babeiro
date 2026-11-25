-- Garantias estruturais de segurança que valem para TODO o schema.
-- Se uma migration nova quebrar alguma regra, este teste falha.
begin;
select plan(5);

-- 1. Toda tabela de public tem RLS habilitado.
select is_empty(
  $$ select c.relname
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'todas as tabelas de public têm RLS habilitado'
);

-- 2. anon não executa nenhuma função de public (RPCs públicas passam pelo servidor, D6).
select is_empty(
  $$ select p.proname
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and has_function_privilege('anon', p.oid, 'execute')
       -- construtores gerados automaticamente para tipos range (ex.: timerange)
       and not exists (
         select 1 from pg_type t
         where t.typnamespace = n.oid and t.typname = p.proname and t.typtype in ('r', 'm')
       ) $$,
  'anon não tem EXECUTE em funções de public'
);

-- 3. Toda função SECURITY DEFINER fixa o search_path.
select is_empty(
  $$ select n.nspname || '.' || p.proname
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and p.prosecdef
       and not exists (
         select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%'
       ) $$,
  'funções SECURITY DEFINER definem search_path'
);

-- 4. anon não acessa o schema private.
select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'anon não tem USAGE no schema private'
);

-- 5. Nenhuma função de private é executável por PUBLIC/anon.
select is_empty(
  $$ select p.proname
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon não executa funções de private'
);

select * from finish();
rollback;
