# BACKLOG

> Prioridades: **P0** obrigatório para o MVP e bloqueante · **P1** obrigatório para o MVP · **P2** desejável/pós-MVP.
> Status: ⬜ pendente · 🟨 em andamento · ✅ concluído · ⛔ bloqueado.
> Dono = agente responsável (ver CLAUDE.md §8).

## E0 — Planejamento (Fase 0)

| ID | Tarefa | Pri. | Dep. | Dono | Status |
|---|---|:-:|---|---|:-:|
| E0-1 | Análise de requisitos, riscos e casos extremos | P0 | — | 00 | ✅ |
| E0-2 | Arquitetura e decisões técnicas (MASTER_PLAN) | P0 | E0-1 | 00 | ✅ |
| E0-3 | Modelagem, ER, RLS, motor (DATABASE) | P0 | E0-2 | 00/01 | ✅ |
| E0-4 | Matriz de permissões e segurança (SECURITY) | P0 | E0-3 | 00 | ✅ |
| E0-5 | Design System | P0 | E0-2 | 02 | ✅ |
| E0-6 | CLAUDE.md, README, .env.example, BACKLOG, PROGRESS | P0 | E0-2 | 00 | ✅ |
| E0-7 | **Aprovação do planejamento pelo usuário** | P0 | E0-1..6 | usuário | ✅ |
| E0-8 | Planejamento do módulo financeiro (BILLING.md) e solução de recebimentos por atendimento | P0 | E0-7 | 00/11 | ✅ |
| E0-9 | Confirmação dos pontos de BILLING §23 | P1 | E0-8 | usuário | ⬜ (padrão: recomendações) |

## E1 — Fundação (Fase 1)

| ID | Tarefa | Pri. | Dep. | Dono | Critérios de aceitação | Status |
|---|---|:-:|---|---|---|:-:|
| E1-1 | Inicializar Next.js + TS strict + Tailwind v4 + shadcn + ESLint/Prettier + pnpm | P0 | E0-7 | 10 | `pnpm dev`, `lint`, `typecheck` funcionam; versões fixadas | ✅ |
| E1-2 | Supabase CLI local, `config.toml`, scripts `db:*` | P0 | E1-1 | 01 | `pnpm db:start/reset` funcionam | ✅ |
| E1-3 | Migrations 1–4 (extensões, identidade, estabelecimentos, helpers de autorização) + RLS | P0 | E1-2 | 01 | Tabelas conforme DATABASE §5.1–5.7; RLS em todas | ✅ |
| E1-4 | Geração de tipos + verificação no CI | P0 | E1-3 | 01 | `src/types/database.ts` gerado; CI falha se desatualizado | ✅ |
| E1-5 | Clientes Supabase (`server`, `browser`, `admin`, proxy de sessão) | P0 | E1-1 | 03 | `admin.ts` com `server-only`; sessão renovada | ✅ |
| E1-6 | Login, logout, recuperar e redefinir senha | P0 | E1-5 | 03 | Fluxos em pt-BR; mensagens de erro neutras (sem revelar se e-mail existe) | ✅ |
| E1-7 | Helpers `requirePlatformAdmin`, `requireMembership`, `requireProfessional` + redirecionamento pós-login e seletor de estabelecimento | P0 | E1-3, E1-5 | 03 | Sem vínculo → 404; testes unitários | ✅ |
| E1-8 | Layout base: sidebar, topbar, tema claro/escuro, tokens, componentes shared iniciais | P0 | E1-1 | 02 | Layout responsivo; DESIGN_SYSTEM §5.1 | ✅ |
| E1-9 | Infra de testes: Vitest (unit/integration), pgTAP, Playwright; CI no GitHub Actions | P0 | E1-2 | 09/10 | CI executa lint, typecheck, unit, pgTAP, integração | ✅ |
| E1-10 | Script `bootstrap:super-admin` + documentação | P0 | E1-3 | 03 | Cria registro em `platform_admins` + auditoria; idempotente | ✅ |
| E1-11 | Testes de isolamento base + teste "nenhuma tabela sem RLS" | P0 | E1-3, E1-9 | 09 | Admin A não lê/escreve B; usuário comum não acessa `platform_admins` | ✅ |
| E1-12 | Cabeçalhos de segurança e CSP | P1 | E1-1 | 10 | Cabeçalhos presentes em todas as rotas | ✅ |

Notas da Fase 1:
- E1-2: harness Docker (Postgres 17 + shim do Supabase) porque as imagens do Supabase não puderam ser baixadas no ambiente de desenvolvimento remoto; `supabase start` continua sendo o fluxo local recomendado.
- E1-7: `requireProfessional` será implementado em E3-4 (depende de `professionals`); até lá a área do profissional usa `requireMembership`.
- E1-9: testes de integração com supabase-js entram com as RPCs da Fase 2.

## E2 — Plataforma administrativa (Fase 2)

| ID | Tarefa | Pri. | Dep. | Dono | Critérios de aceitação | Status |
|---|---|:-:|---|---|---|:-:|
| E2-1 | RPC `create_establishment` + settings padrão + auditoria | P0 | E1-* | 01 | Somente PA; slug validado (formato, reservado, único) | ✅ |
| E2-2 | Lista de estabelecimentos (busca, filtro por status, paginação) | P0 | E2-1 | 04 | Tabela conforme referência visual do admin | ✅ |
| E2-3 | Formulário de criação/edição (dados, endereço, fuso, contatos) | P0 | E2-1 | 04 | Zod; telefone E.164; fuso válido | ✅ |
| E2-4 | Upload de logo e capa (Storage + políticas) | P1 | E2-3 | 04/01 | Apenas JPEG/PNG/WebP ≤ 5 MB; caminho por estabelecimento | ✅ |
| E2-5 | Convites: `create_invitation`, `revoke_invitation`, **link copiável** + botão "Enviar pelo WhatsApp" (`wa.me`) | P0 | E2-1 | 03 | Token mostrado uma vez; hash no banco; expira em 7 dias; sem dependência de SMTP | ✅ |
| E2-5b | Gerar link de redefinição de senha para copiar (Super Admin) | P1 | E2-5 | 03 | Auditado | ✅ |
| E2-5c | Envio de convites/recuperação por e-mail via Resend | P2 | E2-5 | 03/10 | Somente quando aprovado | ⬜ |
| E2-6 | Página `/convite/[token]`: criar conta/entrar e `accept_invitation` | P0 | E2-5 | 03 | E-mail precisa coincidir; uso único; erros claros | ✅ |
| E2-7 | Ativar/suspender/desativar com confirmação e motivo | P0 | E2-1 | 04 | Auditado; efeitos conforme MASTER_PLAN §4.1 | ✅ |
| E2-8 | Dashboard do Super Admin (contagens, novos, crescimento, atividades) | P1 | E2-2 | 08 | Somente dados agregados (D14) | ✅ |
| E2-9 | Auditoria `/admin/auditoria` (filtros por estabelecimento, ação, período) | P1 | E2-1 | 04 | Append-only; paginação | ✅ |
| E2-10 | `/admin/usuarios` (usuários e vínculos, somente leitura + reenviar convite) | P1 | E2-5 | 04 | Sem alteração de papel de plataforma via UI | ✅ |
| E2-11 | `/admin/configuracoes` (slugs reservados, padrões de novos estabelecimentos) | P2 | E2-1 | 04 | Auditado | ⬜ |

Notas da Fase 2:
- E2-4: uploads pelo servidor (sem políticas de escrita no Storage para a API) — ver DATABASE §13.
- E2-8: dashboard com contagens, novos em 30 dias e atividade recente; gráfico de crescimento fica para quando houver volume (B3).
- E2-9: filtros por ação e período em `/admin/auditoria`; o histórico por estabelecimento fica na aba "Histórico" do estabelecimento.
- E2-11 (configurações globais) segue P2 — slugs reservados continuam editáveis via `platform_settings`.

## E3 — Gerenciamento do estabelecimento (Fase 3)

| ID | Tarefa | Pri. | Dep. | Dono | Critérios de aceitação | Status |
|---|---|:-:|---|---|---|:-:|
| E3-1 | Migration 5 (catálogo) + RLS + testes de isolamento | P0 | E2-1 | 01 | FKs compostas; testes A×B | ✅ |
| E3-2 | Layout `/painel/[slug]`, navegação, banner de suspensão | P0 | E1-8 | 05 | Suspenso: aviso; desativado: sem acesso | ✅ |
| E3-3 | Equipe: listar membros, convidar admin/staff, alterar papel, desativar | P0 | E2-5 | 05 | Matriz SECURITY §3; ninguém altera o próprio papel | ✅ |
| E3-4 | Profissionais: CRUD, foto, especialidades, agendável, ordem, vínculo com usuário | P0 | E3-1 | 05 | Desativação bloqueada com agendamentos futuros | ✅ |
| E3-5 | Categorias e serviços: CRUD, preço (centavos), duração, buffers, público/ativo, arquivar | P0 | E3-1 | 05 | Alterar preço não altera histórico (teste) | ✅ |
| E3-6 | Habilitação profissional × serviço | P0 | E3-4, E3-5 | 05 | Matriz editável; afeta disponibilidade | ✅ |
| E3-7 | Configurações de agendamento (`establishment_settings`) | P0 | E3-2 | 05 | Valores validados conforme DATABASE §5.5 | ✅ |
| E3-8 | Personalização da página pública (descrição, contatos, cor com verificação de contraste, tema, logo/capa) + copiar link | P1 | E2-4 | 05 | Pré-visualização; contraste AA | ✅ |
| E3-9 | Clientes: lista, busca, detalhe, notas internas, deduplicação por telefone, anonimizar | P1 | E4-6 | 05 | Staff sem notas internas; LGPD | ✅ |
| E3-10 | Perfil do profissional (staff edita bio/foto/especialidades) | P1 | E3-4 | 05 | Só o próprio | ✅ |

Notas da Fase 3:
- E3-3: o vínculo conta ↔ profissional é feito na página do profissional ("Vincular acesso"), não no convite — mais simples e sem alterar o fluxo de convites. `establishment_invitations.professional_id` deixa de ser necessário.
- E3-4: o bloqueio de desativação com agendamentos futuros entra com a tabela de agendamentos (E4-5); ao remover o acesso de um membro, o perfil profissional dele é desativado (histórico preservado).
- E3-9 (clientes) segue dependente de E4-6.

## E4 — Motor de agendamento (Fase 4)

| ID | Tarefa | Pri. | Dep. | Dono | Critérios de aceitação | Status |
|---|---|:-:|---|---|---|:-:|
| E4-1 | Migration 6 (horários, exceções, bloqueios) + RLS + EXCLUDE de intervalos | P0 | E3-1 | 01 | Sem sobreposição de intervalos; testes | ✅ |
| E4-2 | Editor de horário do estabelecimento e feriados/exceções | P0 | E4-1 | 06 | Múltiplos intervalos/dia; copiar dias | ✅ |
| E4-3 | Editor de jornada do profissional, exceções e bloqueios (admin e staff) | P0 | E4-1 | 06 | Respeita permissões de staff | ✅ |
| E4-4 | Funções de núcleo do motor (`private.*`) | P0 | E4-1 | 06/01 | pgTAP: exemplo de referência (22 horários), almoço, fechamento, buffers, exceções, férias, fuso com horário de verão | ✅ |
| E4-5 | Migration 7 (clientes, agendamentos, eventos, tokens, EXCLUDE, máquina de status) | P0 | E4-1 | 01 | Snapshots; trigger de transição; eventos | ✅ |
| E4-6 | RPCs autenticadas: slots, criar, reagendar, status, cancelar, `find_or_create_customer` | P0 | E4-4, E4-5 | 06/01 | Lock + revalidação + EXCLUDE; versionamento otimista | ⬜ |
| E4-7 | Pré-visualização e listagem de conflitos (`get_schedule_conflicts`) | P0 | E4-6 | 06 | Nada é cancelado automaticamente | ✅ |
| E4-8 | Testes de concorrência (reserva, "qualquer profissional", reagendamento cruzado) | P0 | E4-6 | 09 | 20 paralelas → 1 sucesso | ✅ |
| E4-9 | Wrapper TS `src/modules/availability` + agrupamento Manhã/Tarde/Noite | P0 | E4-6 | 06 | Tipado; testes unitários | ✅ |
| E4-10 | Oferecer também o início de cada intervalo livre (reduz ociosidade) | P2 | E4-4 | 06 | Configurável | ⬜ |

Notas da Fase 4:
- E4-3: profissional sem jornada própria segue o horário do estabelecimento (D23). Staff altera a própria jornada/folgas só com `staff_can_manage_own_hours`, e bloqueios com `staff_can_manage_own_blocks`.
- E4-6: `cancel_appointment` foi unificado em `update_appointment_status(..., 'cancelled', motivo, versão)`. `complete_appointment` com recebimentos entra na Fase 6 (D19); por ora "concluído" grava `final_price_cents` = preço de tabela.
- E3-4: desativar profissional com agendamentos futuros agora é bloqueado (`HAS_FUTURE_APPOINTMENTS`).
- A criação de agendamentos pela interface (agenda visual) é a Fase 6; na Fase 4 a tela "Horários livres" mostra o resultado do motor.

## E5 — Agendamento público (Fase 5)

| ID | Tarefa | Pri. | Dep. | Dono | Critérios de aceitação | Status |
|---|---|:-:|---|---|---|:-:|
| E5-1 | RPCs públicas (somente `service_role`) + DTOs mínimos | P0 | E4-6 | 01/07 | `anon` sem EXECUTE (teste) | ✅ |
| E5-2 | Rate limit (Postgres) + Turnstile + honeypot | P0 | E5-1 | 07 | Limites de SECURITY §8 testados | ✅ |
| E5-3 | Página do estabelecimento (etapa 1) com identidade visual e tema | P0 | E5-1 | 07 | Mobile-first; suspenso → aviso; desativado → 404 | ✅ |
| E5-4 | Etapas serviço → profissional → data/horário (estado na URL) | P0 | E5-3 | 07 | Datas sem horário desabilitadas | ✅ |
| E5-5 | Dados do cliente + confirmação + sucesso (código, .ics, link, wa.me) | P0 | E5-4, E5-2 | 07 | Sem cadastro; conflito → mensagem e recarga | ✅ |
| E5-6 | `/reserva/[token]`: consultar, cancelar, reagendar conforme política | P0 | E5-5 | 07 | Reagendamento atômico; `noindex` | ✅ |
| E5-7 | Metadados de compartilhamento (Open Graph com logo/capa) | P1 | E5-3 | 07 | Prévia correta no WhatsApp | ✅ |
| E5-8 | E2E mobile do fluxo completo | P0 | E5-6 | 09 | 360×640 e 390×844 | ✅ |

Notas da Fase 5:
- E5-2: Turnstile é ativado só quando as chaves existem (DEPLOY.md Parte G); honeypot, tempo mínimo e limites no banco valem sempre. Tentativas que falham não consomem a cota de 5 reservas/hora por IP (a transação é desfeita).
- E5-6: o cliente remarca com o mesmo profissional; trocar de profissional continua com a equipe.
- E5-8: com `loading.tsx` a página inexistente é transmitida com status 200 (o Next adiciona `noindex`); o conteúdo é o 404.

## E6 — Operação (Fase 6)

| ID | Tarefa | Pri. | Dep. | Dono | Critérios de aceitação | Status |
|---|---|:-:|---|---|---|:-:|
| E6-1 | Agenda dia em colunas por profissional (`ScheduleGrid`) | P0 | E4-6 | 06 | Expediente/bloqueios visíveis; linha do "agora" | ✅ |
| E6-2 | Agenda semana, mês e lista com filtros | P0 | E6-1 | 06 | Filtros por profissional, serviço, data, status | 🟡 |
| E6-3 | Criação manual de agendamento (cliente existente/novo, encaixe) | P0 | E6-1 | 06 | Origem registrada; encaixe só admin | ✅ |
| E6-4 | Painel lateral do agendamento: status, reagendar, cancelar, histórico de eventos | P0 | E6-1 | 06 | Só transições válidas | ✅ |
| E6-5 | Área do profissional: agenda, disponibilidade, histórico, perfil | P0 | E6-1, E4-3 | 06 | Só dados próprios | ✅ |
| E6-4b | Recebimentos por atendimento: "Concluir e registrar pagamento", múltiplas formas, anulação (`appointment_payments`) | P0 | E6-4 | 06 | D19; staff conforme configuração; anulação auditada | ✅ |
| E6-6 | Dashboard do estabelecimento: Previsto × Realizado × Recebido, por forma de pagamento, "concluídos sem pagamento" | P1 | E6-4b | 08 | Valores conferidos com dados de teste; escopo correto | ✅ |
| E6-6b | Fechamento de caixa do dia (recebido por forma de pagamento e por profissional) | P1 | E6-4b | 08 | | ✅ |
| E6-7 | Dashboard do profissional | P1 | E6-5 | 08 | | ✅ |
| E6-8 | Relatórios `/painel/[slug]/relatorios` (período, profissional, serviço) | P1 | E6-6 | 08 | | ⬜ |
| E6-9 | Histórico do cliente (atendimentos, total concluído) | P1 | E3-9 | 05 | | ⬜ |

Notas da Fase 6:
- E6-2: visões **Dia** (colunas por profissional) e **Lista** (filtros de período, profissional e situação; padrão = próximos 7 dias). A visão Mês fica para depois.
- E6-4b: "Concluir atendimento" sai de *confirmado* direto (o banco registra a passagem por *em atendimento*); só a partir de 15 min antes do horário. Pagamentos aceitam várias formas, gorjeta (recebido > cobrado) e anulação com motivo (auditada).
- E6-6/E6-6b: o resumo da visão geral traz Previsto × Realizado × Recebido, caixa por forma de pagamento e por profissional (Hoje / 7 dias / mês). "Recebido" usa a data do pagamento.
- E6-8 (relatórios) e E6-9 (histórico do cliente, junto com E3-9) ficam para a próxima etapa.

## E7 — Qualidade e deploy (Fase 7)

| ID | Tarefa | Pri. | Dep. | Dono | Critérios de aceitação | Status |
|---|---|:-:|---|---|---|:-:|
| E7-1 | Revisão de segurança completa (RLS, RPCs, actions, headers) | P0 | E6-* | 09 | Checklist SECURITY §13 | ⬜ |
| E7-2 | Suite E2E dos fluxos críticos (Super Admin, admin, staff, cliente) | P0 | E6-* | 09 | Cenários obrigatórios abaixo | ⬜ |
| E7-3 | Acessibilidade (axe + teclado) e responsividade | P1 | E6-* | 02/09 | Sem violações críticas | ⬜ |
| E7-4 | Performance (Lighthouse mobile ≥ 90 na página pública, índices revisados) | P1 | E6-* | 10 | | ⬜ |
| E7-5 | Deploy de demonstração: Vercel Hobby + Supabase Free, URLs de Auth, `pg_cron` | P0 | E6-* | 10 | Site navegável para vendas | ⬜ |
| E7-5b | Migração para Vercel Pro + Supabase Pro (+ Resend se necessário) | P0 | 1º cliente pagante | 10 | Antes do uso comercial | ⬜ |
| E7-6 | Documentação final sincronizada | P0 | E7-* | 00 | | ⬜ |

## Módulo financeiro do SaaS (BILLING.md)

Ordem: após E3 → **B1 → B2**; após E6 → **B3 → B4**; **B5** só com gateway aprovado. Dono: Agent 11 (SQL em par com o 01).

### B1 — Fundação comercial

| ID | Tarefa | Pri. | Dep. | Critérios de aceitação | Status |
|---|---|:-:|---|---|:-:|
| B1-1 | Migration `billing_core`: enums, `billing_settings`, `billing_features`, planos, versões (imutáveis após uso), features, `subscriptions`, `subscription_items`, `subscription_events`, `subscription_scheduled_changes` + RLS | P0 | E3-1 | BILLING §15; testes de isolamento | ✅ |
| B1-2 | `platform_role` + `has_platform_permission` | P0 | B1-1 | `billing_manager` só opera financeiro | ✅ |
| B1-3 | `private.establishment_mode()` e aplicação em RPCs/RLS de escrita e rotas públicas | P0 | B1-1 | F24; matriz BILLING §12 | ✅ |
| B1-4 | `private.entitlement()` + trigger de limite de profissionais com lock | P0 | B1-1 | F4, F5, F7, F23 | ✅ |
| B1-5 | Migration `billing_catalog_seed` (4 planos, adicionais, oferta de entrada) idempotente | P0 | B1-1 | Valores de BILLING §2.1/§5 | ✅ |
| B1-6 | `private.transition_subscription` + trigger que bloqueia UPDATE direto de status | P0 | B1-1 | Diagrama BILLING §7.2 | ✅ |
| B1-7 | Função de ciclo `billing_cycle_start` + espelho TS | P0 | B1-1 | F21; casos 29/30/31/bissexto | ✅ |
| B1-8 | UI planos e versões (`/admin/financeiro/planos`) + reajuste agendado | P1 | B1-5 | Nova versão nunca altera contratos | ✅ |
| B1-9 | Atribuir plano no cadastro do estabelecimento (`billing_assign_subscription`) | P0 | B1-6, E2-3 | Assinatura `pending_activation` criada | ✅ |
| B1-10 | Mudança de plano e vagas extras (imediata/próximo ciclo, validação de downgrade) | P1 | B1-9 | F18 | ✅ |

### B2 — Cobranças manuais

| ID | Tarefa | Pri. | Dep. | Critérios de aceitação | Status |
|---|---|:-:|---|---|:-:|
| B2-1 | Migration `billing_invoicing`: faturas, itens, numeração, cobranças, descontos, promoções, pagamentos, alocações, comprovantes, solicitações + RLS + imutabilidade | P0 | B1-* | F8, F11; sem DELETE | ✅ |
| B2-2 | Geração da fatura de ciclo (cálculo de itens, descontos com piso zero, oferta, implantação) | P0 | B2-1 | F1, F2, F3, F6, F19 | ✅ |
| B2-3 | Ofertas e cupons (resgate único, limite com lock, override auditado) | P0 | B2-2 | Sem reuso indevido | ✅ |
| B2-4 | Serviços adicionais: catálogo, itens recorrentes, cobranças únicas (próxima fatura/avulsa) | P1 | B2-2 | Indisponíveis tecnicamente marcados "em breve" | ✅ |
| B2-5 | Emitir/cancelar/reemitir/prorrogar fatura | P0 | B2-2 | Auditoria; valores imutáveis | ✅ |
| B2-6 | Registrar pagamento, alocação, parcial, reversão, estorno | P0 | B2-1 | F10; F22 | ✅ |
| B2-7 | Configurações de cobrança (Pix, instruções, implantação padrão) | P0 | B2-1 | Cópia das instruções na fatura | ✅ |
| B2-8 | Comprovantes: upload privado (owner/admin), revisão pelo Super Admin | P0 | B2-6 | F9; URL assinada | ✅ |
| B2-9 | Aba "Financeiro" do estabelecimento no admin + fluxo "cadastrar → plano → fatura → WhatsApp → pagamento" | P0 | B2-2..8 | Objetivo inicial do usuário atendido ponta a ponta | ✅ |
| B2-10 | Visualização/impressão da fatura ("sem valor fiscal") | P1 | B2-5 | | ✅ |

Notas de B1/B2:
- Vagas adicionais ficam em `subscriptions.extra_professionals` (não em `subscription_items`); serviços recorrentes (ex.: automação de WhatsApp) entram com B3/B4.
- B1-10: mudança de plano é imediata (vale a partir da próxima fatura); agendamento para o próximo ciclo (`subscription_scheduled_changes`) fica para B4, junto com a rotina.
- B2-3: oferta de entrada com uso único e limite com lock ✅; cupons/catálogo de descontos ficam para B3 (descontos por assinatura já existem).
- B2-4: cobranças únicas (próxima fatura ou avulsa) ✅; adicionais recorrentes ficam para B3.
- B2-6: estorno (`refund`) fica para B3; reversão de lançamento ✅.
- Sem rotina automática ainda (B4): o Super Admin gera a próxima fatura na aba Financeiro; "Vencida" é calculado na tela.
- Acesso do `billing_manager` às telas: o painel /admin ainda exige Super Admin (as RPCs já aceitam `billing.manage`).

### B3 — Interfaces financeiras

| ID | Tarefa | Pri. | Dep. | Critérios de aceitação | Status |
|---|---|:-:|---|---|:-:|
| B3-1 | `billing_dashboard` (MRR, ARR, faturado, recebido, a receber, atraso, churn, inadimplência, por plano, avulsos) | P1 | B2-* | F20; recorrente × avulso | ✅ |
| B3-2 | `/admin/financeiro` com gráficos mensais e filtros | P1 | B3-1 | | ✅ |
| B3-3 | Listas: assinaturas, faturas, pagamentos, inadimplência, promoções, adicionais | P1 | B2-* | Filtros e paginação | ✅ |
| B3-4 | `/painel/[slug]/assinatura` (owner/admin): plano, vagas, faturas, Pix, comprovantes, solicitações | P0 | B2-8 | F12, F13; staff 404 | ✅ |
| B3-5 | Exportação CSV | P2 | B3-3 | | ✅ |

Notas de B3:
- `billing_dashboard`: MRR/ARR (plano ou negociado + vagas + recorrentes − descontos permanentes; anual ÷ 12), ticket médio, faturado (recorrente × avulso × oferta de entrada), recebido, a receber, em atraso, inadimplência, novos, churn, por plano e série de 12 meses.
- Cupons (`coupons`, código único, validade, limite com lock, um resgate por assinatura) e adicionais recorrentes (`subscription_items`) completam B2-3/B2-4. Estorno (`refund`) segue pendente para quando houver gateway.

### B4 — Automação

| ID | Tarefa | Pri. | Dep. | Critérios de aceitação | Status |
|---|---|:-:|---|---|:-:|
| B4-1 | `billing_run_daily` (mudanças agendadas, faturas de ciclo, status, régua) + `billing_job_runs` | P0 | B2-* | F14; lock; subtransação por assinatura | ✅ |
| B4-2 | Agendamento no `pg_cron` (06:15 e 18:15 BRT) | P0 | B4-1 | Sem EXECUTE para papéis da API | ✅ |
| B4-3 | Régua in-app + "Cobranças do dia" com envio manual por WhatsApp | P0 | B4-1 | Idempotente por fatura/tipo | ✅ |
| B4-4 | Inadimplência: `past_due`, suspensão (automática desligada por padrão), reativação | P0 | B4-1, B1-3 | F16, F17 | ✅ |
| B4-5 | Configuração da régua e exceções por assinatura | P1 | B4-3 | | ✅ |
| B4-6 | E-mails de cobrança via Resend (`pg_net` → rota protegida) | P2 | B4-3 | Somente quando aprovado | ⬜ |

Notas de B4:
- Rotina `private.billing_run` (pg_cron às 06:15 e 18:15 BRT, e botão "Executar rotina agora"): mudanças agendadas → faturas de ciclo (5 dias antes; ciclos atrasados em ordem) → status das faturas → régua (só a etapa atual; não despeja avisos antigos) → atraso/suspensão (automática desligada por padrão; exceção por assinatura) → reativação. Lock consultivo, subtransação por assinatura, log em `billing_job_runs`.
- Assinatura suspensa não recebe novas faturas de ciclo até ser regularizada.
- Correção: `billing_update_settings` não tinha WHERE e o Supabase recusa UPDATE sem WHERE (pg-safeupdate); recriada na migration de automação.

### B5 — Gateway (requer aprovação)

| ID | Tarefa | Pri. | Dep. | Critérios de aceitação | Status |
|---|---|:-:|---|---|:-:|
| B5-1 | Comparativo com documentação oficial (BILLING §19.2) e recomendação | P2 | B4-* | Aprovação do usuário | ✅ Asaas Sandbox aprovado |
| B5-2 | `PaymentProvider` + implementação do provedor aprovado | P2 | B5-1 | Capabilities reais | 🟨 Pix no Asaas Sandbox |
| B5-3 | Webhooks (assinatura, idempotência, fora de ordem, conciliação) | P2 | B5-2 | F15 | 🟨 Webhook e consulta por fatura. Conciliação agendada pendente |
| B5-4 | Pix/checkout na área de assinatura | P2 | B5-3 | Sucesso no redirect não confirma | 🟨 QR Code e Copia e Cola no sandbox. Homologação com Asaas pendente |

## Pós-MVP (P2, não iniciar sem aprovação)

Pagamento antecipado de agendamentos (cliente final) · NFS-e · WhatsApp/e-mail/lembretes · fidelidade · cupons · estoque · comissões · financeiro · produtos · avaliações · lista de espera · múltiplas unidades · domínio próprio · PWA · app mobile · impersonação auditada pelo Super Admin · contas de cliente · múltiplos serviços por agendamento · preço/duração por profissional · redirecionamento de slugs antigos.

---

## Cenários obrigatórios de aceitação

| # | Cenário | Teste | Tarefa |
|---|---|---|---|
| A1 | Admin da Barbearia A não acessa dados da Barbearia B | integração RLS + E2E 404 | E1-11, E3-1 |
| A2 | Funcionário não se atribui permissões administrativas | pgTAP `update_member_role` + integração | E3-3 |
| A3 | Usuário comum não acessa o painel do Super Admin | E2E + RLS `platform_admins` | E1-7 |
| A4 | Dois clientes não reservam horários sobrepostos simultaneamente | concorrência | E4-8 |
| A5 | Serviço não ultrapassa o horário de trabalho | pgTAP motor | E4-4 |
| A6 | Serviço não invade o almoço | pgTAP motor (exemplo de referência) | E4-4 |
| A7 | Profissional de férias não aparece disponível | pgTAP motor | E4-4 |
| A8 | Estabelecimento suspenso não aceita novos agendamentos | pgTAP RPC pública + E2E | E5-1 |
| A9 | Cancelamento libera a disponibilidade | pgTAP/integração | E4-6 |
| A10 | Reagendamento malsucedido mantém a reserva original | integração | E4-6, E5-6 |
| A11 | Alteração de preço não modifica o histórico | integração | E3-5 |
| A12 | "Qualquer profissional" respeita habilitações | pgTAP motor | E4-4 |
| A13 | Página pública funciona em dispositivos móveis | Playwright mobile | E5-8 |
| A14 | Agendamento sem cadastro obrigatório | E2E | E5-5 |
| A15 | Dados privados de clientes não expostos por rotas públicas | integração (inspeção de DTOs) + teste `anon` | E5-1 |

Cenários do módulo financeiro: F1–F24 em [BILLING.md §22](./BILLING.md#22-critérios-de-aceitação).
