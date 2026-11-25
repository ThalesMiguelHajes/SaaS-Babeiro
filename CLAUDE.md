# CLAUDE.md — Contexto permanente do projeto

> Leia este arquivo no início de toda sessão. Depois leia `PROGRESS.md` e a tarefa correspondente em `BACKLOG.md`.

## 1. O que é este projeto

SaaS multi-tenant de agendamento para barbearias e salões (e, no futuro, outros negócios com hora marcada). Uma aplicação, um banco, isolamento por estabelecimento via RLS. Papéis: Super Admin (plataforma), owner/admin e staff (estabelecimento), cliente final sem conta.

Documentos de referência: `MASTER_PLAN.md` (escopo e decisões), `DATABASE.md` (modelo, RLS, motor), `BILLING.md` (assinaturas e financeiro do SaaS), `SECURITY.md` (autorização e riscos), `DESIGN_SYSTEM.md` (UI), `BACKLOG.md` (tarefas), `PROGRESS.md` (estado atual).

## 2. Stack

Next.js (App Router) · TypeScript strict · Supabase (Postgres, Auth, Storage, RLS) · Tailwind CSS v4 · shadcn/ui · Lucide · Zod · React Hook Form · date-fns v4 + @date-fns/tz · libphonenumber-js · Vitest · Playwright · pgTAP · Vercel. Gerenciador de pacotes: **pnpm**.

## 3. Regras invioláveis

1. **Nunca** expor a chave secreta/service role no cliente. Ela só é lida em `src/lib/supabase/admin.ts` (`import 'server-only'`).
2. **Toda tabela nova** em `public` tem RLS habilitado, políticas e testes de isolamento na **mesma** migration/PR.
3. **Slug na URL não é autorização.** Toda página/action protegida chama `requirePlatformAdmin()`, `requireMembership(slug, roles)` ou `requireProfessional(slug)`.
4. **Toda Server Action**: `'use server'` → valida entrada com Zod → autoriza → executa → retorna `Result` tipado. Nunca confiar em `establishment_id`, papel, preço, duração ou status vindos do cliente.
5. **Escritas de agendamentos, papéis, convites, horários e status somente via RPC** (ver DATABASE §10). Não fazer INSERT/UPDATE direto nessas tabelas pelo cliente JS.
6. **Funções `SECURITY DEFINER`**: `set search_path = ''`, nomes qualificados, assert de autorização na primeira instrução, `revoke` de `public`/`anon`, grant explícito, teste pgTAP.
7. **Dinheiro em centavos (`integer`)**; nada de `float`/`number` com casas decimais para valores.
8. **Datas**: instantes em `timestamptz`; "dia local" sempre no fuso do estabelecimento; conversões autoritativas no banco.
9. **Regras de negócio fora de componentes React.** Componentes chamam actions/queries; regras puras em `rules.ts`.
10. **Não simular funcionalidades** (pagamentos, WhatsApp, lembretes etc.). Se não existe, não aparece como pronto.
11. **Não editar migrations já aplicadas** em ambientes compartilhados; criar nova.
12. **Nada destrutivo em produção** sem autorização explícita do usuário.
13. **Financeiro**: nunca editar ou apagar fatura emitida, pagamento ou evento — corrigir com cancelamento/reemissão ou lançamento de reversão auditado. Preços e limites vêm do banco (versões de plano), nunca de constantes no código. Nenhum pagamento é confirmado por redirecionamento ou comprovante enviado.
14. **Status efetivo do estabelecimento** vem só de `private.establishment_mode()`; não recalcular regras de suspensão em outro lugar.
15. Não confundir `payments` (SaaS cobrando estabelecimentos) com `appointment_payments` (estabelecimento recebendo de clientes finais).
16. Mudanças de escopo, arquitetura, custo ou regra de negócio → pedir aprovação. Decisões menores → decidir e registrar em `PROGRESS.md` (seção Decisões).

## 4. Estrutura de pastas

```
src/
  app/                          # rotas finas: compõem módulos, sem regra de negócio
  modules/<dominio>/
    schemas.ts                  # Zod (entrada/saída)
    queries.ts                  # leituras server-only (cliente do usuário, RLS)
    actions.ts                  # Server Actions
    rules.ts                    # funções puras (testes unitários)
    types.ts
    components/
  components/ui/                # shadcn (gerado; editar com parcimônia)
  components/shared/            # componentes do produto
  lib/
    supabase/{server,browser,admin,proxy}.ts
    authz/                      # requirePlatformAdmin, requireMembership, requireProfessional
    dates/ money/ phone/ tokens/ rate-limit/ turnstile/ errors/ result.ts
  types/database.ts             # GERADO — não editar à mão
supabase/migrations/ supabase/tests/ supabase/seed.sql
tests/unit/ tests/integration/ tests/e2e/
scripts/
```

Domínios: `auth`, `platform`, `establishments`, `members`, `professionals`, `services`, `schedules`, `availability`, `appointments`, `booking` (público), `customers`, `dashboards`, `audit`, `billing` (financeiro do SaaS: `rules/`, `providers/`).

Regra de dependência: `app → modules → lib`. Um módulo pode importar `schemas`/`types` de outro, mas **não** `actions`/`queries` de outro (compor na rota ou em um módulo de orquestração explícito).

## 5. Padrões de código

- **Next.js 16**: leia `node_modules/next/dist/docs/` antes de usar APIs que você não conhece desta versão (ver `AGENTS.md`). `middleware` agora é `src/proxy.ts`; `cacheComponents` está desligado (D22).
- **Triggers de guarda** que usam `private.is_privileged_context()` precisam ser `SECURITY INVOKER` (em `SECURITY DEFINER`, `current_user` vira o owner e a guarda nunca dispara).
- Cada migration termina com `revoke execute on all functions in schema private from public, anon;` seguido de grants explícitos. O teste `000_schema_security.sql` falha se isso for esquecido.
- Nunca `select *` em tabelas com colunas sem grant (ex.: `establishment_invitations.token_hash`).

- TypeScript strict, sem `any` (usar `unknown` + validação). `noUncheckedIndexedAccess` ativo.
- Server Components por padrão; `'use client'` só para interatividade (formulários, agenda, seletor de horários).
- Formulários: React Hook Form + `zodResolver` com o **mesmo** schema usado na action.
- Retorno de actions: `type Result<T> = { ok: true; data: T } | { ok: false; error: { code: DomainErrorCode; message: string; fieldErrors?: Record<string, string[]> } }`.
- Erros do banco: mapear `SQLSTATE`/código de domínio em `src/lib/errors` para mensagens pt-BR. Nunca mostrar mensagem SQL ao usuário.
- Revalidação: `revalidatePath`/`revalidateTag` após mutações.
- Nomes: arquivos `kebab-case.ts(x)`, componentes `PascalCase`, funções `camelCase`, SQL `snake_case`. Código e identificadores em **inglês**; textos de UI, docs e mensagens de commit em **português**.
- Sem abstrações especulativas; arquivos com mais de ~300 linhas devem ser divididos.
- Imports absolutos com `@/`.

## 6. Convenções de banco

Ver DATABASE.md §1. Resumo: UUID, `establishment_id` em toda tabela do tenant, FKs compostas `(establishment_id, id)`, `created_at`/`updated_at`, enums em inglês, helpers em `private`, RPCs em `public`.

## 7. Comandos

```
pnpm dev               # Next.js local
pnpm db:start          # supabase start
pnpm db:reset          # recria banco local com migrations + seed
pnpm db:types          # gera src/types/database.ts
pnpm db:test           # pgTAP via supabase test db (requer supabase start)
pnpm db:test:harness   # migrations + pgTAP + seed em Postgres 17 (Docker) — usado no CI
pnpm db:types:harness  # gera tipos a partir do harness
pnpm lint && pnpm typecheck
pnpm test              # Vitest (unit)
pnpm test:e2e          # Playwright (requer pnpm build)
pnpm check             # lint + tipos + unit + banco
```

Após mudanças significativas: `pnpm lint && pnpm typecheck && pnpm test` + testes de integração/pgTAP do módulo alterado.

## 8. Trabalho com múltiplos agentes

Quando a sessão usar subagentes, cada um atua com a responsabilidade abaixo. O **Agent 00 (Architect)** coordena, é o único que altera documentos de arquitetura (`MASTER_PLAN`, `DATABASE`, `SECURITY`) e integra o trabalho.

| Agente | Responsabilidade | Pastas sob sua posse |
|---|---|---|
| 00 — Architect | Arquitetura, planejamento, coordenação, revisão final | docs raiz, `src/lib/result.ts`, `src/lib/errors` |
| 01 — Database | Migrations, RLS, funções SQL, seed, tipos | `supabase/**`, `src/types/database.ts` |
| 02 — Design System | Tokens, componentes compartilhados, layouts | `src/components/**`, `src/app/globals.css`, layouts base |
| 03 — Auth | Autenticação, sessões, convites, helpers de autorização | `src/modules/auth`, `src/lib/authz`, `src/lib/supabase`, rotas `(auth)` |
| 04 — Platform | Painel do Super Admin | `src/modules/platform`, `src/modules/audit`, `src/app/admin` |
| 05 — Establishments | Painel do estabelecimento (equipe, serviços, clientes, configurações) | `src/modules/{establishments,members,professionals,services,customers}`, `src/app/painel` (exceto agenda) |
| 06 — Scheduling | Motor de disponibilidade, horários, agendamentos, agendas | `src/modules/{schedules,availability,appointments}`, agendas em `painel` e `profissional` (SQL do motor é escrito em par com o 01) |
| 07 — Public Booking | Página pública e gestão por token | `src/modules/booking`, `src/app/(public)`, `src/lib/{turnstile,rate-limit}` |
| 08 — Analytics | Dashboards e indicadores | `src/modules/dashboards` |
| 09 — QA | Testes de integração/E2E, revisão de segurança | `tests/**` |
| 10 — DevOps | CI, Vercel, ambientes, variáveis | `.github/**`, `vercel.json`, `.env.example`, `next.config.*` |
| 11 — Billing | Planos, assinaturas, faturas, pagamentos, régua, gateway futuro | `src/modules/billing`, `src/app/admin/financeiro`, `src/app/painel/[slug]/assinatura` (SQL em par com o 01) |

Regras de coordenação:
1. Um módulo tem **um** dono por vez; alterações fora da própria pasta exigem pedido ao dono ou ao Architect.
2. **Migrations são sequenciais** e só o Agent 01 as cria (outros agentes descrevem a necessidade). Nunca dois agentes gerando migration ao mesmo tempo.
3. Contratos entre módulos (`schemas.ts`, `types.ts`, assinaturas de RPC) são definidos antes da implementação e registrados em DATABASE.md.
4. Cada agente atualiza o status da sua tarefa no `BACKLOG.md` e registra entregas em `PROGRESS.md`.
5. Dependências seguem o BACKLOG; não iniciar tarefa com dependência pendente.

## 9. Definição de pronto (por tarefa)

- [ ] Funciona ponta a ponta no ambiente local
- [ ] Autorização no servidor e RLS/RPC no banco
- [ ] Validação Zod (cliente e servidor)
- [ ] Estados de carregamento, vazio e erro
- [ ] Testes (unit / pgTAP / integração / E2E conforme o caso) passando
- [ ] `pnpm lint && pnpm typecheck` sem erros
- [ ] Documentação e `BACKLOG.md`/`PROGRESS.md` atualizados

## 10. Git

- Commits pequenos, mensagem em português no imperativo (`feat(booking): adiciona seleção de horários`), seguindo Conventional Commits.
- Nunca commitar `.env*` (exceto `.env.example`), chaves ou dumps de banco.
- Branch de trabalho conforme instruções da sessão; PR apenas quando solicitado.
