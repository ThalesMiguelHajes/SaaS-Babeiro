# Ambiente de teste do banco (fora de supabase/tests: o `supabase test db` executa tudo que está lá) quando o stack completo do Supabase (`supabase start`) não está disponível
# (ex.: CI sem acesso aos registries de imagens do Supabase). NÃO é usado em produção.
# Postgres 17 + pgTAP + pg_prove + pg_cron.
FROM postgres:17
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-17-pgtap postgresql-17-cron libtap-parser-sourcehandler-pgtap-perl \
 && rm -rf /var/lib/apt/lists/*
