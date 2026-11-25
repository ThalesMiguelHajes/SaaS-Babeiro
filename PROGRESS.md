# PROGRESS

> Estado atual do projeto. Atualizar ao final de cada sessão/tarefa.

**Fase atual:** 2 — Plataforma administrativa · **Status:** em andamento.
**Última atualização:** 2026-11-25

## Concluído

- Fase 0: análise de requisitos, arquitetura, modelagem (ER, tabelas, RLS, motor de disponibilidade), matriz de permissões, design system, backlog e documentação inicial (`MASTER_PLAN.md`, `CLAUDE.md`, `DATABASE.md`, `DESIGN_SYSTEM.md`, `SECURITY.md`, `BACKLOG.md`, `README.md`, `.env.example`).
- Referências visuais do usuário incorporadas ao `DESIGN_SYSTEM.md` (admin em tabela, agenda em colunas por profissional, página pública escura com destaque).
- Simulação de disponibilidade do briefing registrada como caso de teste de referência (`DATABASE.md` §7.3.1 — 22 horários).
- Papéis de agentes (00–10) e posse de módulos definidos em `CLAUDE.md` §8 (Agent 11 — Billing adicionado).
- Planejamento do módulo financeiro do SaaS (`BILLING.md`): planos versionados, assinaturas, oferta de entrada, implantação, adicionais, descontos, faturas, pagamentos manuais, comprovantes, régua, `pg_cron`, estratégia de gateway.
- Solução do "faturamento": registro de recebimentos por atendimento (`appointment_payments`, MASTER_PLAN §4.2).

### Fase 1 — Fundação (concluída em 2026-11-25)

- Next.js 16.4 + React 19.3 + TypeScript strict (`noUncheckedIndexedAccess`) + Tailwind v4 + shadcn/ui (Radix, preset Nova/Geist) + pnpm.
- Supabase: `config.jsonc` (cadastro público desligado, senha ≥ 8 com letras e números, template de recuperação em pt-BR) e 3 migrations: extensões/tipos/utilitários; identidade (profiles, platform_admins, platform_settings, audit_logs); estabelecimentos (establishments, settings, members, invitations) com auxiliares de autorização e RLS.
- Proteções no banco: RLS em todas as tabelas, chaves de tenant, `establishment_id` imutável, guarda de colunas sensíveis (slug, status, fuso, nome), um owner por estabelecimento e "nunca sem owner" (checagem adiada), `token_hash` de convites ilegível pela API, auditoria append-only, slugs reservados, fuso validado.
- Aplicação: clientes Supabase (usuário, navegador, admin `server-only`), `src/proxy.ts` (renova sessão, CSP com nonce, redireciona áreas privadas), `requireUser`/`requirePlatformAdmin`/`requireMembership`, login, logout, recuperar/redefinir senha, `/auth/confirm`, redirecionamento pós-login, seletor `/inicio`, layout base dos painéis (sidebar escura, tema claro/escuro), áreas `/admin`, `/painel/[slug]`, `/profissional/[slug]`, 404 em pt-BR.
- Utilitários testados: dinheiro em centavos, telefone E.164/BR, datas no fuso do estabelecimento, tokens (256 bits + SHA-256), mapeamento de erros de domínio.
- Script `pnpm bootstrap:super-admin <email>` (idempotente, auditado). Seed de desenvolvimento com 2 barbearias e 6 usuários.
- Qualidade: 54 testes pgTAP (segurança estrutural, identidade, isolamento A×B, regras de owner), 38 testes unitários, 18 E2E (desktop + mobile), lint, typecheck, build, verificação de segredos no bundle e CI no GitHub Actions.

### Fase 2 — Cadastro e consulta de estabelecimentos

- A base importada em `main` corresponde aos arquivos do ZIP do commit de origem `ce751377e69ac495cee2cfc75dada674b9f469e2`. O histórico Git desta cópia começa no repositório de ThalesMiguelHajes.
- O Super Administrador acessa **Estabelecimentos** para buscar por nome, filtrar por status ou iniciar um cadastro. A criação registra a auditoria e usa o mecanismo de configurações padrão da Fase 1.
- Cadastrar um estabelecimento e conceder acesso ao responsável são operações independentes. O aceite de convite será entregue em uma etapa posterior.

## Pendente

- Confirmação dos pontos de `BILLING.md` §23 (seguem as recomendações se não houver objeção).
- Fases 2–7 e B1–B5 (ver `BACKLOG.md`).
- Validar no computador local o fluxo completo com `supabase start` (login real com os usuários do seed) — ver "Problemas conhecidos".

## Problemas conhecidos

- **O stack completo do Supabase não pôde rodar no ambiente remoto** (download das imagens bloqueado por limite do registry). Por isso o banco é testado com o harness (Postgres 17 + shim de `auth`) e os testes E2E cobrem apenas o que não depende de login. O login real com o seed deve ser conferido localmente com `pnpm db:start && pnpm db:reset && pnpm dev`.
- `supabase/seed.sql` foi validado no harness (aplicado sem erros), mas não contra o GoTrue real.

## Decisões tomadas

| Data | Decisão | Onde |
|---|---|---|
| 2026-11-25 | Monólito modular Next.js organizado por domínio | MASTER_PLAN D1 |
| 2026-11-25 | Anti-sobreposição com EXCLUDE + advisory lock + revalidação na mesma transação | DATABASE §8 |
| 2026-11-25 | FKs compostas `(establishment_id, id)` para consistência entre tenants | DATABASE §6 |
| 2026-11-25 | RPCs públicas executáveis apenas pela `service_role`, chamadas pelo servidor | MASTER_PLAN D6 |
| 2026-11-25 | Dinheiro em centavos; snapshots no agendamento | DATABASE §5.18 |
| 2026-11-25 | Tokens privados armazenados apenas como hash SHA-256 | SECURITY §7 |
| 2026-11-25 | `appointment_events` no lugar de `appointment_status_history`; `*_date_overrides` no lugar de `*_schedule_exceptions` | DATABASE §15 |
| 2026-11-25 | Agenda visual própria (sem biblioteca de calendário paga) | MASTER_PLAN D12 |
| 2026-11-25 | Aprovadas pelo usuário: D2, D9/D10, D14, D15, D16, reservas públicas como Confirmado, nome provisório | MASTER_PLAN §8.1 |
| 2026-11-25 | Vercel Hobby + Supabase Free na fase de demonstração/vendas; Pro ao fechar o 1º cliente | MASTER_PLAN §6.2 |
| 2026-11-25 | Convites por link copiável como fluxo principal; Resend depois | MASTER_PLAN D18 |
| 2026-11-25 | Recebimentos por atendimento (Previsto × Realizado × Recebido) | MASTER_PLAN D19 |
| 2026-11-25 | Status efetivo único `establishment_mode()`; rotinas financeiras em `pg_cron`; auditoria financeira em `audit_logs` | BILLING §12, §16 |
| 2026-11-25 | D22 — Next.js 16 com `cacheComponents: false`: quase todas as páginas são dinâmicas por usuário; evita `<Suspense>` obrigatório em toda leitura de sessão | `next.config.ts` |
| 2026-11-25 | Cadastro público desligado no Supabase Auth; contas criadas pelo servidor ao aceitar convite | `supabase/config.jsonc`, SECURITY §6 |
| 2026-11-25 | Harness de banco (Postgres 17 + shim) para CI e ambientes sem as imagens do Supabase | `scripts/db-test.sh` |
| 2026-11-25 | `audit_logs` antecipada para a migration de identidade | DATABASE §14 |
| 2026-11-25 | Pacote `cn` (oficial do shadcn) no lugar de `clsx` + `tailwind-merge` | `src/lib/utils.ts` |
| 2026-11-25 | Navegação só exibe páginas que já existem; itens entram conforme as fases são entregues | `app-sidebar.tsx` |

## Próximos passos

1. Continuar a Fase 2 com edição dos dados, convites por link copiável, aceite em `/convite/[token]`, transições de status e consulta à auditoria.
2. Ordem geral: 1 → 2 → 3 → B1 → B2 → 4 → 5 → 6 → B3 → B4 → 7 → B5.
