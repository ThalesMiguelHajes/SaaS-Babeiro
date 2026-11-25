-- =============================================================================
-- 05 · Storage: bucket público de imagens dos estabelecimentos
-- Referência: DATABASE.md §13
--
-- Decisão (Fase 2): uploads passam pelo servidor (Server Action valida permissão, tipo real
-- do arquivo e tamanho) e são gravados com a chave secreta. Por isso NÃO há políticas de
-- INSERT/UPDATE/DELETE em storage.objects para usuários da API, e também não há política de
-- SELECT (o bucket é público para leitura por URL, mas não pode ser listado).
-- =============================================================================

do $$
begin
  -- O harness de testes (Postgres puro) não tem o schema storage.
  if to_regclass('storage.buckets') is null then
    raise notice 'storage.buckets inexistente: bucket não criado (ambiente de teste).';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('establishment-assets', 'establishment-assets', true, 5242880,
          array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
end
$$;
