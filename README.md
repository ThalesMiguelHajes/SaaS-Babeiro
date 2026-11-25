# SaaS de Agendamento para Barbearias e Salões

Plataforma multi-tenant para estabelecimentos de beleza gerenciarem profissionais, serviços, horários, clientes e agendamentos, com página pública de reservas por estabelecimento (`/agendar/[slug]`).

> **Status:** Fase 2 (plataforma administrativa) concluída. Para publicar e testar online, siga o [DEPLOY.md](./DEPLOY.md). Andamento em [PROGRESS.md](./PROGRESS.md).

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [MASTER_PLAN.md](./MASTER_PLAN.md) | Visão, arquitetura, escopo, decisões, fases |
| [DATABASE.md](./DATABASE.md) | Modelo de dados, ER, RLS, motor de disponibilidade |
| [SECURITY.md](./SECURITY.md) | Autorização, isolamento, riscos, checklist |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Identidade visual e padrões de UI |
| [BACKLOG.md](./BACKLOG.md) | Épicos, tarefas, critérios de aceitação |
| [BILLING.md](./BILLING.md) | Planos, assinaturas, faturas e pagamentos do SaaS |
| [DEPLOY.md](./DEPLOY.md) | Passo a passo para publicar (Supabase + Vercel) |
| [PROGRESS.md](./PROGRESS.md) | Estado atual e decisões |
| [CLAUDE.md](./CLAUDE.md) | Regras para desenvolvimento assistido por IA |

## Stack

Next.js 16 (App Router, `src/proxy.ts`) · TypeScript · Supabase (PostgreSQL, Auth, Storage, RLS) · Tailwind CSS · shadcn/ui · Zod · React Hook Form · date-fns · Vitest · Playwright · Vercel.

## Pré-requisitos

- Node.js LTS (22+) e pnpm
- Docker (para o Supabase local)
- Supabase CLI (já incluída como dependência de desenvolvimento: `pnpm exec supabase`)

## Configuração local

```bash
pnpm install
```

```bash
cp .env.example .env.local
```

```bash
pnpm db:start
```

`pnpm db:start` exibe a URL da API e as chaves locais; copie-as para `.env.local`.

```bash
pnpm db:reset
```

Aplica todas as migrations e o `supabase/seed.sql` (dados de desenvolvimento). Usuários de teste (senha `Senha123`, apenas local):

| E-mail | Papel |
|---|---|
| `super@local.dev` | Super Administrador |
| `dono.a@local.dev` / `admin.a@local.dev` | owner / admin da Barbearia A |
| `staff.a@local.dev` | profissional da Barbearia A |
| `dono.b@local.dev` | owner da Barbearia B |
| `multi@local.dev` | admin em A e profissional em B (seletor `/inicio`) |

```bash
pnpm db:types
```

```bash
pnpm dev
```

Aplicação em `http://localhost:3000`; Supabase Studio em `http://localhost:54323`; e-mails locais (Inbucket/Mailpit) em `http://localhost:54324`.

O cadastro público está **desligado** (`enable_signup: false`): contas são criadas pelo servidor ao aceitar um convite (Fase 2) ou pelo Studio.

## Variáveis de ambiente

| Variável | Onde | Descrição |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | cliente/servidor | URL base (links de convite e reserva) |
| `NEXT_PUBLIC_APP_NAME` | cliente/servidor | Nome exibido da plataforma |
| `NEXT_PUBLIC_SUPABASE_URL` | cliente/servidor | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | cliente/servidor | Chave publicável (ou `anon` legada) |
| `SUPABASE_SECRET_KEY` | **somente servidor** | Chave secreta (ou `service_role` legada). Nunca usar prefixo `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | cliente | Cloudflare Turnstile |
| `TURNSTILE_SECRET_KEY` | **somente servidor** | Cloudflare Turnstile |
| `IP_HASH_SECRET` | **somente servidor** | Segredo para hash de IPs (rate limit/auditoria) |
| `RESEND_API_KEY` | **somente servidor** | Opcional (futuro): e-mails transacionais |
| `BILLING_CRON_SECRET` | **somente servidor** | Futuro: rota chamada pelo `pg_cron`/`pg_net` para envio de e-mails de cobrança |
| `PAYMENT_PROVIDER_API_KEY` / `PAYMENT_PROVIDER_WEBHOOK_SECRET` | **somente servidor** | Futuro (fase B5): gateway aprovado |

## Supabase

- Migrations em `supabase/migrations/` (nunca editar uma migration já aplicada em ambiente compartilhado).
- Testes de banco (pgTAP) em `supabase/tests/`: `pnpm db:test` (com `supabase start`) ou `pnpm db:test:harness` (Postgres 17 em Docker com um shim do Supabase — não precisa das imagens do Supabase; é o que o CI usa).
- Tipos TypeScript: `pnpm db:types` (Supabase local) ou `pnpm db:types:harness`. O CI falha se `src/types/database.ts` estiver desatualizado.
- E-mail de recuperação de senha: template em `supabase/templates/recovery.html` (link `…/auth/confirm?token_hash=…&type=recovery`). Em produção, copie-o para Authentication → Email Templates.
- O schema `private` **não** deve ser adicionado aos schemas expostos da API.
- Aplicar migrations em um projeto remoto:

```bash
supabase link --project-ref <ref-do-projeto>
```

```bash
supabase db push
```

### Primeiro Super Administrador

1. Crie o usuário (cadastro pelo Supabase Studio → Authentication, ou convite).
2. Execute, com as variáveis do ambiente alvo configuradas:

```bash
pnpm bootstrap:super-admin voce@exemplo.com
```

Alternativa via SQL Editor do Supabase:

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'voce@exemplo.com';
```

Não existe rota, tela ou política que permita a um usuário tornar-se Super Admin.

## Testes

```bash
pnpm lint && pnpm typecheck
```

```bash
pnpm test
```

```bash
pnpm db:test:harness
```

```bash
pnpm build && pnpm test:e2e
```

Com o Supabase local rodando e o seed aplicado (`pnpm db:start && pnpm db:reset`), os testes de fluxo completo (cadastro, convites, suspensão, upload, isolamento) também rodam:

```bash
E2E_DB=1 pnpm test:e2e
```

O CI executa as três camadas: harness de banco, `supabase test db` + E2E com o Supabase local, e lint/tipos/unitários/build.

Atalho para tudo (lint, tipos, unitários e banco):

```bash
pnpm check
```

## Deploy na Vercel

**Passo a passo completo e simplificado: [DEPLOY.md](./DEPLOY.md).** Resumo técnico:

Fase atual (demonstração/vendas): **Vercel Hobby + Supabase Free**. Ao fechar o primeiro cliente pagante, migrar para Vercel Pro e Supabase Pro.

1. Crie o projeto Supabase (região `sa-east-1`) e aplique as migrations (`supabase db push`). Confirme que a extensão `pg_cron` está habilitada (rotinas de cobrança).
2. Convites são enviados por link copiável. Quando necessário, configure SMTP próprio (Resend) no Supabase Auth com templates em pt-BR.
3. Em Authentication → URL Configuration, defina o Site URL e as Redirect URLs do domínio de produção.
4. Importe o repositório na Vercel, defina as variáveis de ambiente acima (chaves secretas apenas no ambiente de servidor) e a região de funções `gru1`.
5. Crie o primeiro Super Admin conforme acima.
6. Conclua o checklist de produção de [SECURITY.md §13](./SECURITY.md#13-checklist-de-produção-fase-7).

Observação: o plano Hobby da Vercel não permite uso comercial; o plano Free do Supabase pausa projetos após 7 dias sem uso e não inclui backups diários — adequados para demonstração, não para clientes pagantes. Ver custos em [MASTER_PLAN.md §6](./MASTER_PLAN.md#6-dependências-e-custos).
