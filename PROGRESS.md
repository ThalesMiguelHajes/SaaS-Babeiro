# PROGRESS

> Estado atual do projeto. Atualizar ao final de cada sessão/tarefa.

**Fase atual:** B3 — Indicadores, cupons e recorrentes · **Status:** concluída. Em andamento: B4-6 (e-mail via Resend) e B5 (gateway), autorizados pelo usuário.
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

### Fase 2 — Plataforma administrativa (concluída em 2026-11-25)

- Banco: RPCs de estabelecimento (criar, editar, status com motivo, imagens) e de convites (criar/reenviar, revogar, ler por token só no servidor, aceitar), `profiles.email`, bucket de imagens. Tudo auditado na mesma transação.
- Super Admin: visão geral (contagens + atividade recente), lista com busca/filtro/paginação, cadastro com slug automático e geração do convite do responsável (link para copiar ou enviar pelo WhatsApp), página do estabelecimento com abas Dados (logo/capa, edição), Equipe (convites pendentes, revogar, membros) e Histórico, ativar/suspender/desativar com confirmação e motivo, usuários (com link de nova senha para copiar), auditoria com filtros.
- Convite: `/convite/[token]` cobre conta nova (servidor cria a conta com o e-mail do convite), conta existente (entrar e aceitar), conta errada (recusa) e convite inválido/expirado/revogado/usado.
- Publicação: `vercel.json` (região gru1), GitHub Action **Banco de dados (Supabase)** que aplica as migrations no projeto hospedado, guia `DEPLOY.md`.
- Qualidade: **91 testes pgTAP** (rodando no harness **e** no Supabase real), **50 unitários**, **18 E2E de fumaça** + **12 E2E de fluxo completo contra o Supabase real** (cadastro, slug duplicado, suspender/reativar, upload e arquivo inválido, aceite de convite, uso único, convite com conta errada, isolamento entre estabelecimentos, link de nova senha). CI ganhou o job "E2E com Supabase local".

### Fase 3 — Painel do estabelecimento (concluída em 2026-11-25)

- Banco: profissionais, categorias, serviços (centavos, duração, preparo/limpeza, público/ativo, arquivamento) e habilitações com chaves de tenant; RPCs de perfil do profissional, foto, vínculo de conta, papel e ativação de membros; auditoria de preço/duração; contexto da sessão com o profissional vinculado.
- Telas: visão geral com checklist de primeiros passos; Profissionais (lista, cadastro, foto, serviços, vincular acesso); Serviços (por categoria, preço em R$, atalhos de duração, quem realiza, arquivar) e Categorias; Equipe (convites, papel, remover/reativar acesso com as regras de quem pode o quê); Página pública (link, logo, capa, descrição, contatos, endereço, cor); Configurações (regras de agendamento); Meu perfil (profissional).
- Produção: banco recriado em **São Paulo (sa-east-1)**; site na Vercel em São Paulo (gru1).
- Qualidade: 130 testes pgTAP, 50 unitários, 38 E2E (18 de fumaça + 12 da plataforma + 8 do painel) contra o Supabase real.

### Fase 4 — Motor de agendamento (concluída em 2026-11-25)

- Banco: horário semanal do estabelecimento e do profissional (vários intervalos/dia, EXCLUDE contra sobreposição), exceções por data (fechado/horário especial), bloqueios (profissional ou casa toda), clientes (deduplicação por telefone), agendamentos com snapshots, `occupied_range` e EXCLUDE anti-sobreposição, eventos append-only, tokens de acesso (para a Fase 5), máquina de status por trigger, versão para concorrência otimista.
- Motor em SQL (`private.free_time`/`available_slots`/`booking_error`): mesma lógica para listar e validar; grade alinhada à meia-noite local; buffers precisam caber; antecedência e limite de dias só na página pública; "qualquer profissional" escolhe quem tem menos atendimentos no dia, com locks em ordem de id.
- RPCs: `save_weekly_hours`, `save_date_override`, `delete_date_override`, `save_availability_block`, `delete_availability_block` (com pré-visualização de conflitos — nada é cancelado), `get_available_slots`, `get_schedule_conflicts`, `create_appointment` (encaixe só admin), `reschedule_appointment` (atômico), `update_appointment_status`.
- Telas: Horários (funcionamento, feriados, bloqueios da casa, consulta de horários livres agrupados em Manhã/Tarde/Noite), Horários do profissional (jornada, folgas, bloqueios e férias, horários livres), Minha disponibilidade (profissional, conforme permissões), aviso "Agendamentos que precisam de atenção" e item de checklist do horário.
- Qualidade: 198 pgTAP (exemplo de referência com 22 horários, 20/50/60 min, buffers, almoço, férias, feriado, horário de verão, isolamento, máquina de status, conflitos), 61 unitários, 5 de concorrência (20 reservas simultâneas → 1 sucesso; parcialmente sobrepostas; qualquer profissional; reagendamento cruzado; cancelamento libera), 44 E2E.

### Fase 5 — Agendamento público (concluída em 2026-11-25)

- Banco: núcleo `private.book_appointment` compartilhado entre painel e página pública; RPCs públicas só para a service_role (`public_get_booking_page`, `public_get_available_dates`, `public_get_available_slots`, `public_create_booking`, `public_get_booking`, `public_cancel_booking`, `public_reschedule_booking`); rate limit em `private.rate_limits` (5 reservas/h/IP, 60 consultas/min/IP, 20/h por token, 30/h/IP em links); limite de reservas ativas por telefone; token de gestão de 256 bits (só o hash no banco, expira 30 dias após o atendimento); política de cancelamento/remarcação; suspenso só permite cancelar.
- Telas: `/agendar/[slug]` (vitrine com capa, logo, contatos, horário; etapas serviço → profissional → dia/horário → dados, estado na URL, cor do estabelecimento, "qualquer profissional", aviso quando o horário é tomado) e `/reserva/[token]` (confirmação, código, .ics, WhatsApp, copiar link, remarcar, cancelar; `noindex` e `no-referrer`). Metadados de compartilhamento com capa/logo.
- Anti-abuso: honeypot, tempo mínimo de preenchimento, Turnstile opcional, IP só como HMAC.
- Qualidade: 233 pgTAP, 72 unitários, 5 de concorrência, 49 E2E (inclui fluxo completo em 360×640 e 390×844).

### Fase 6 — Operação (concluída em 2026-11-25)

- Banco: `appointment_payments` (append-only; anulação com motivo e auditoria), `complete_appointment` (valor cobrado + vários pagamentos em uma transação), `record_appointment_payment`, `void_appointment_payment`, `get_agenda_day` (colunas com tempo de trabalho, bloqueios e agendamentos) e `get_dashboard` (Previsto × Realizado × Recebido, por forma, por profissional, concluídos sem pagamento) — ambos com escopo automático: profissional só vê o próprio.
- Telas: **Agenda** (dia em colunas por profissional com expediente, bloqueios e linha do "agora"; clique no horário livre cria agendamento; visão Lista com filtros), **novo agendamento** (cliente existente/novo, horários livres do motor, encaixe só admin), **painel do agendamento** (confirmar, iniciar, concluir com pagamento, falta, remarcar, cancelar com motivo, recebimentos, anulação, histórico, WhatsApp do cliente), **Visão geral** com indicadores e caixa, área do profissional com **Minha agenda** e **Meu resumo**.
- Qualidade: 260 pgTAP, 78 unitários, 5 de concorrência, 52 E2E.

### B1/B2 — Financeiro do SaaS (concluído em 2026-11-25)

- Banco: planos versionados (preço nunca no código; versão em uso é imutável), assinaturas com máquina de estados única (`private.transition_subscription`), `private.establishment_mode` como fonte única do acesso (implantação, operacional, restrito), limite de profissionais por trigger com lock, ciclo de cobrança pela âncora (`billing_cycle_start`), oferta de entrada (uso único, limite com lock), implantação (coberta, isenta, na 1ª fatura ou separada, nunca duas vezes), descontos com piso zero, faturas imutáveis após emissão com numeração `FAT-AAAA-NNNNNN`, pagamentos manuais com alocação, parcial e reversão, comprovantes em bucket privado (envio nunca confirma), solicitações do estabelecimento. Modo aplicado a agendamentos, página pública, horários e cadastro de serviços/profissionais.
- Telas: Super Admin → aba **Financeiro** do estabelecimento (atribuir plano com pré-visualização da 1ª fatura, mudar plano/vagas, cobrança avulsa, desconto, gerar próxima fatura, suspender/reativar/cancelar), **Financeiro** (MRR, a receber, em atraso, recebido no mês, comprovantes para conferir, solicitações, faturas em aberto), **Planos e preços** (nova versão), **Configurações de cobrança** (Pix), **Fatura** (registrar pagamento, prorrogar, cancelar, reverter, cobrar pelo WhatsApp). Estabelecimento → **Assinatura** (plano, vagas, faturas, Pix, comprovante, solicitações) e aviso no topo conforme o modo; vagas em uso na página de profissionais.
- Qualidade: 311 pgTAP (F1–F6, F8–F13, F16–F19, F21, F22, F24), 93 unitários, 5 de concorrência, 56 E2E.

### B4 — Automação da cobrança (concluída em 2026-11-25)

- Banco: `billing_run_daily` agendada no **pg_cron** (06:15 e 18:15 de Brasília) + limpeza horária do rate limit; régua configurável (`dunning_offsets`, emissão, atraso, tolerância, suspensão automática) e exceções por assinatura; mudanças de plano agendadas para o próximo ciclo (aplicadas ou bloqueadas pelo limite); `billing_notifications` idempotente por fatura/etapa; `billing_job_runs`.
- Telas: **Cobranças do dia** (mensagem pronta e envio registrado pelo WhatsApp), **Rotina de cobrança** (última execução e "Executar agora"), régua em Configurações de cobrança, exceções e "aplicar no próximo ciclo" na assinatura, aviso de vencimento no painel do estabelecimento.
- Qualidade: 335 pgTAP (idempotência F14, ciclos atrasados, régua, atraso, suspensão opcional, reativação F17, mudança agendada bloqueada F18, permissões), 95 unitários, 5 de concorrência, 57 E2E.

### B3 — Indicadores, cupons e adicionais recorrentes (concluída em 2026-11-25)

- Painel do financeiro com período (mês, 3 e 12 meses): MRR, ARR, ticket médio, faturado (recorrente × avulso), recebido, a receber, em atraso, inadimplência, novos clientes, churn, oferta de entrada, por plano e gráfico faturado × recebido (12 meses, com tabela).
- Listas de assinaturas, faturas (inclui "vencidas") e pagamentos com filtros, paginação e exportação CSV (Excel pt-BR, proteção contra fórmulas).
- Cupons (criar, ativar/desativar, aplicar na assinatura) e adicionais recorrentes (entram em todas as faturas enquanto vigentes; encerramento auditado).
- Qualidade: 351 pgTAP (F20 incluído), 95 unitários, 5 de concorrência, 59 E2E.

## Pendente

- Confirmação dos pontos de `BILLING.md` §23 (seguem as recomendações se não houver objeção).
- Publicar seguindo `DEPLOY.md` (contas Supabase, GitHub Secrets e Vercel são do usuário).
- Fases 3–7 e B1–B5 (ver `BACKLOG.md`).

## Problemas conhecidos

- ~~Stack completo do Supabase indisponível no ambiente remoto~~ — resolvido na Fase 2 (limite do registry expirou); migrations, seed, pgTAP e E2E agora rodam contra o Supabase real.
- Publicação (2026-11-25): site no ar na Vercel; banco aplicado pelo GitHub Action. Ajustes feitos durante a publicação: `supabase db push --remote` (CLI v3), variáveis `NEXT_PUBLIC_*` como *Config* na Vercel, migration `backfill_profiles` para contas criadas antes do banco existir, e migration `explicit_api_grants` — o projeto hospedado foi criado sem os privilégios padrão de tabelas para a API ("permission denied for table profiles"); o harness passou a reproduzir esse cenário restrito.
- Desempenho (2026-11-25): Vercel confirmada em São Paulo (`gru1`); login com chaves ES256 verificado sem ida ao Supabase; contexto da sessão em 1 chamada (`get_session_context`) e contagens do painel em 1 (`platform_overview`); telas de carregamento (`loading.tsx`) em todas as áreas, barra de progresso no topo e indicador no item do menu clicado.
- Um envio de formulário feito durante um redeploy da Vercel pode mostrar "This page couldn't load" (página antiga, servidor novo); recarregar a página resolve.
- Convites e redefinição de senha dependem de envio manual do link (sem SMTP próprio, por decisão D18).
- Uploads antigos de logo/capa são apagados ao trocar a imagem; se a exclusão falhar, o arquivo fica órfão no Storage (sem impacto funcional; limpeza periódica pode ser adicionada depois).

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
| 2026-11-25 | Uploads pelo servidor (validação de conteúdo) em vez de políticas de escrita no Storage | DATABASE §13, SECURITY §5 |
| 2026-11-25 | Conta do convidado criada pelo servidor com o e-mail do convite (cadastro público continua desligado) | SECURITY §5 |
| 2026-11-25 | Convite reenviado revoga o anterior; o link só aparece no momento em que é gerado (o banco guarda apenas o hash) | `private.issue_invitation` |
| 2026-11-25 | Leituras privilegiadas fora de actions em arquivos `*.server.ts` | CLAUDE.md §5 |
| 2026-11-25 | Vínculo conta ↔ profissional na página do profissional (não no convite) | BACKLOG E3-3 |
| 2026-11-25 | Banco de produção recriado em sa-east-1 (o primeiro foi criado em us-west-2) | PROGRESS |
| 2026-11-25 | D23 — Profissional sem jornada própria segue o horário do estabelecimento (onboarding mais simples) | `private.professional_hours` |
| 2026-11-25 | Modo painel do motor: equipe ignora antecedência mínima, limite de dias e visibilidade pública; horário fora da grade aceito no painel | `private.booking_error` |
| 2026-11-25 | Cancelamento pela mesma RPC de status (`update_appointment_status`) | BACKLOG E4-6 |
| 2026-11-25 | Turnstile opcional (ativa com as chaves); demais proteções sempre ativas | DEPLOY.md Parte G |
| 2026-11-25 | Cliente remarca só com o mesmo profissional | BACKLOG E5-6 |
| 2026-11-25 | Reserva pública e do painel usam o mesmo núcleo `private.book_appointment` | migration public_booking |
| 2026-11-25 | "Concluir" a partir de confirmado passa por em atendimento na mesma transação | `complete_appointment` |
| 2026-11-25 | Escopo de leitura da agenda/indicadores decidido no banco (`private.read_scope`) | migration operations |
| 2026-11-25 | D24 — Estabelecimento sem assinatura opera normalmente (contas anteriores ao financeiro e demonstrações) | `private.establishment_mode` |
| 2026-11-25 | Vagas adicionais como coluna da assinatura; recorrentes avulsos depois | BACKLOG B1/B2 |
| 2026-11-25 | Mudança de plano imediata (a partir da próxima fatura); agendamento de mudanças com a rotina (B4) | BACKLOG B1-10 |
| 2026-11-25 | Rotina de cobrança no pg_cron (não Vercel Cron); data simulável por `app.billing_today` nos testes | migration billing_automation |
| 2026-11-25 | Régua guarda só a etapa atual de cada fatura (sem despejar avisos antigos após parada da rotina) | `private.billing_process_subscription` |
| 2026-11-25 | Imagens exibidas sem otimização da Vercel (`<img>`), para não consumir a cota do plano Hobby | `image-uploader.tsx` |

## Próximos passos

1. Usuário publica seguindo `DEPLOY.md` e testa pelo link.
2. Ordem geral: 1 → 2 → 3 → B1 → B2 → 4 → 5 → 6 → B3 → B4 → 7 → B5.
