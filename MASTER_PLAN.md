# MASTER_PLAN — Plataforma SaaS de Agendamento para Barbearias e Salões

> Documento mestre do projeto. Fonte de verdade para escopo, arquitetura e fases.
> Status atual: **Fase 1 — Fundação concluída** (ver [PROGRESS.md](./PROGRESS.md)). Próxima: Fase 2.
> Última atualização: 2026-11-25.

Documentos relacionados: [CLAUDE.md](./CLAUDE.md) · [BILLING.md](./BILLING.md) · [DATABASE.md](./DATABASE.md) · [SECURITY.md](./SECURITY.md) · [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) · [BACKLOG.md](./BACKLOG.md) · [PROGRESS.md](./PROGRESS.md) · [README.md](./README.md)

---

## 1. Visão geral do produto

Plataforma SaaS **multi-tenant** e centralizada para estabelecimentos que trabalham com hora marcada (barbearias, salões, manicures, estética). Uma única aplicação e um único banco atendem todos os estabelecimentos, com isolamento de dados garantido no banco (RLS) e no servidor.

```
                     Super Administrador (dono da plataforma)
                                    │
          ┌─────────────────────────┼─────────────────────────┐
     Estabelecimento A        Estabelecimento B        Estabelecimento C
     ├─ Administradores       ├─ ...                   ├─ ...
     ├─ Profissionais
     ├─ Serviços / Horários
     ├─ Clientes / Agenda
     └─ /agendar/slug-a  ◄── Clientes finais (sem cadastro obrigatório)
```

### 1.1. Atores

| Ator | Onde atua | Resumo |
|---|---|---|
| Super Administrador | `/admin` | Cria e gerencia estabelecimentos, convida responsáveis, vê métricas globais e auditoria; gerencia planos, assinaturas, faturas e pagamentos (`/admin/financeiro`). |
| Administrador do estabelecimento (owner/admin) | `/painel/[slug]` | Gerencia equipe, serviços, horários, clientes, agenda, página pública. Pode também atender. |
| Profissional (staff) | `/profissional/[slug]` | Vê a própria agenda, gerencia a própria disponibilidade e o status dos próprios atendimentos. |
| Cliente final | `/agendar/[slug]`, `/reserva/[token]` | Agenda sem conta; consulta, cancela e reagenda pelo link privado. |

### 1.2. Princípios

1. **Segurança e isolamento primeiro** — RLS em todas as tabelas; autorização verificada no servidor e no banco; slug na URL nunca é autorização.
2. **Banco como guardião das invariantes** — conflitos de agenda, consistência entre tenants, transições de status e snapshots históricos são garantidos por constraints, triggers e funções transacionais, não pela interface.
3. **Uma fonte de verdade para disponibilidade** — o mesmo cálculo serve para listar horários e para validar a reserva.
4. **Mobile-first na página pública; eficiência operacional no painel.**
5. **Nada simulado** — funcionalidade inexistente não aparece como pronta.
6. **Entregas incrementais** — cada módulo só é concluído quando funcional, testado e documentado.

---

## 2. Arquitetura

### 2.1. Estilo: monólito modular

Uma aplicação Next.js (App Router) que contém interface e lógica server-side (Server Components, Server Actions, Route Handlers), conversando com o Supabase. Sem back-end separado nem microsserviços.

```
 Navegador ──► Vercel (Next.js)
                 ├─ proxy/middleware: só renova sessão e faz redirecionamento grosseiro
                 ├─ Server Components: leitura com cliente Supabase do usuário (RLS ativo)
                 ├─ Server Actions: validação Zod → autorização → RPC/consulta
                 └─ Rotas públicas: rate limit + anti-bot → RPC pública (chave secreta, só no servidor)
                          │
                          ▼
               Supabase (PostgreSQL 15+/17)
                 ├─ Auth (usuários, sessões, convites, recuperação de senha)
                 ├─ Tabelas com RLS em 100% delas
                 ├─ Funções SQL: motor de disponibilidade + operações transacionais (RPC)
                 ├─ Constraints: EXCLUDE (anti-sobreposição), FKs compostas (tenant)
                 ├─ Storage: logos, capas, fotos (políticas por estabelecimento)
                 └─ pg_cron: limpeza de rate limit e tokens expirados
```

### 2.2. Decisões técnicas principais

| # | Decisão | Justificativa | Status |
|---|---|---|---|
| D1 | **Monólito modular em Next.js** organizado por domínio (`src/modules/*`). | Menor custo e complexidade; evolui por módulos. | Definida (requisito) |
| D2 | **Motor de disponibilidade em SQL** (funções PL/pgSQL usando `tstzmultirange`), com wrapper tipado em TypeScript. | O mesmo cálculo lista horários e valida a reserva **dentro da mesma transação**; elimina duplicação TS × SQL e condições de corrida. PostgreSQL tem álgebra de intervalos nativa (`*`, `-`, `@>`). | Aprovada |
| D3 | **Anti-sobreposição com `EXCLUDE USING gist`** em `(professional_id, occupied_range)` para agendamentos não cancelados + `pg_advisory_xact_lock` por profissional nas RPCs. | Garantia física contra reserva dupla mesmo com requisições simultâneas; o lock serializa a validação completa (bloqueios, expediente). | Definida |
| D4 | **FKs compostas `(establishment_id, id)`** entre entidades do mesmo tenant. | Impossível, no nível do banco, associar um serviço da Barbearia A a um agendamento da Barbearia B. | Definida |
| D5 | **Escritas sensíveis somente via RPC** (`SECURITY DEFINER`, `search_path=''`, autorização explícita no início). CRUD simples (serviços, categorias) via tabela com RLS. | Agendamentos, papéis, convites e status exigem regras transacionais que RLS sozinho não expressa. | Definida |
| D6 | **Operações públicas passam pelo servidor Next.js**; RPCs públicas só executáveis pela `service_role`. | Se fossem executáveis por `anon`, qualquer pessoa poderia chamar a API do Supabase diretamente com a chave pública e contornar rate limit e anti-bot. | Definida |
| D7 | **Dinheiro em centavos (`integer`)**; tempo em `timestamptz`; datas locais calculadas no fuso do estabelecimento. | Sem ponto flutuante; instantes inequívocos. | Definida |
| D8 | **Snapshots no agendamento** (nome do serviço, preço, duração, buffers, nome/telefone do cliente). | Alterações futuras não reescrevem o histórico. | Definida |
| D9 | **Rate limiting em PostgreSQL** (tabela + função atômica), sem serviço externo no MVP. | Custo zero; substituível por Upstash/Redis se o volume crescer. | Aprovada |
| D10 | **Cloudflare Turnstile** + honeypot + limites por telefone/IP no agendamento público. | Proteção anti-bot gratuita, sem quebra-cabeça visual na maioria dos casos. Exige conta Cloudflare (grátis). | Aprovada |
| D11 | **Tokens privados** (convite e gestão de reserva): 32 bytes aleatórios, base64url, **armazenados somente como hash SHA-256**. | Vazamento do banco não expõe links válidos; tokens não enumeráveis. | Definida |
| D12 | **Agenda visual própria** (CSS grid) em vez de biblioteca de calendário. | Visões por recurso (profissional) de bibliotecas populares são pagas; nossa necessidade é específica e controlável. | Definida |
| D13 | **date-fns v4 + `@date-fns/tz`** no front; conversões autoritativas no banco (`AT TIME ZONE`). | Suporte oficial a fusos; o banco decide o que é "dia local". | Definida |
| D14 | **Super Admin não vê dados pessoais de clientes** dos estabelecimentos no MVP (apenas dados do estabelecimento e métricas agregadas). | Minimização de dados (LGPD). Acesso de suporte com auditoria fica para depois. | Aprovada |
| D15 | **Um serviço por agendamento no MVP** (combos são cadastrados como serviço, ex.: "Corte e barba"). | Simplifica motor e histórico; tabela de itens pode ser adicionada depois sem quebra. | Aprovada |
| D16 | **Buffers (preparo/limpeza) precisam caber no expediente** e não podem se sobrepor a outros buffers. | Regra conservadora e previsível; flexibilizável depois. | Aprovada |
| D17 | Região: **Supabase `sa-east-1` (São Paulo)** e funções Vercel em **`gru1`**. | Latência para clientes brasileiros e proximidade de dados (LGPD). | Aprovada |
| D18 | **Convites por link copiável** como fluxo principal (enviado manualmente por WhatsApp/e-mail); envio automático via Resend só quando necessário. | Zero dependência de SMTP na fase de vendas; o SMTP padrão do Supabase é só para testes. | Aprovada |
| D19 | **Registro de recebimento por atendimento** (`appointment_payments`): ao concluir, a equipe informa valor cobrado e forma de pagamento (Pix, dinheiro, débito, crédito, outro). | Resolve o "faturamento": o dashboard passa a mostrar **Previsto**, **Realizado** e **Recebido** de verdade, sem gateway. Ver §4.2. | Aprovada (solução proposta) |
| D20 | **Status efetivo único** `private.establishment_mode()` combinando status administrativo e financeiro (`operational`, `setup`, `restricted`, `disabled`). | Elimina inconsistência entre suspensão administrativa, suspensão financeira e permissões. | Proposta (BILLING §12) |
| D21 | **Módulo financeiro do SaaS** com planos versionados, assinaturas, faturas, pagamentos manuais e rotinas em `pg_cron`; gateway só após aprovação. | Ver [BILLING.md](./BILLING.md). | Proposta |

### 2.3. Organização do código (resumo)

Detalhes e convenções em [CLAUDE.md](./CLAUDE.md).

```
src/
  app/                     # Rotas (finas): só composição, sem regra de negócio
    (auth)/                # /login, /recuperar-senha, /redefinir-senha, /convite/[token]
    (public)/              # /agendar/[slug], /reserva/[token]
    admin/                 # Super Administrador
    painel/[slug]/         # Administrador do estabelecimento
    profissional/[slug]/   # Profissional
  modules/                 # Domínios de negócio
    auth/ platform/ establishments/ members/ professionals/ services/
    schedules/ availability/ appointments/ booking/ customers/
    dashboards/ audit/ billing/
      ├─ schemas.ts        # Zod
      ├─ queries.ts        # leituras (server-only)
      ├─ actions.ts        # Server Actions
      ├─ rules.ts          # regras puras (testáveis)
      ├─ types.ts
      └─ components/       # UI específica do domínio
  components/ui/           # shadcn/ui
  components/shared/       # componentes reutilizáveis do produto
  lib/                     # supabase/, authz/, dates/, money/, phone/, rate-limit/, errors/, tokens/
  types/database.ts        # gerado pelo Supabase CLI
supabase/
  migrations/  seed.sql  tests/ (pgTAP)  config.toml
tests/
  unit/  integration/ (RLS, concorrência)  e2e/ (Playwright)
scripts/                   # bootstrap do Super Admin, geração de tipos
```

### 2.4. Rotas

| Área | Rotas |
|---|---|
| Pública | `/login`, `/recuperar-senha`, `/redefinir-senha`, `/convite/[token]`, `/agendar/[slug]`, `/reserva/[token]` |
| Pós-login | `/` → redireciona conforme vínculos; `/inicio` (seletor quando há vários estabelecimentos) |
| Super Admin | `/admin`, `/admin/estabelecimentos`, `/admin/estabelecimentos/novo`, `/admin/estabelecimentos/[id]` (aba Financeiro), `/admin/usuarios`, `/admin/auditoria`, `/admin/configuracoes` |
| Financeiro (Super Admin) | `/admin/financeiro`, `/assinaturas`, `/planos`, `/faturas`, `/pagamentos`, `/inadimplencia`, `/servicos-adicionais`, `/promocoes`, `/configuracoes` |
| Estabelecimento | `/painel/[slug]`, `/agenda`, `/profissionais`, `/servicos`, `/clientes`, `/clientes/[id]`, `/horarios`, `/relatorios`, `/configuracoes`, `/pagina-publica`, `/assinatura` (owner/admin) |
| Profissional | `/profissional/[slug]`, `/agenda`, `/disponibilidade`, `/historico`, `/perfil` |

Um admin que também atende usa `/painel/[slug]/agenda` (com filtro "minha agenda") e também pode acessar `/profissional/[slug]`.

### 2.5. Motor de disponibilidade (resumo)

Especificação completa em [DATABASE.md §7](./DATABASE.md#7-motor-de-disponibilidade).

Para um profissional `P`, um serviço `S` e uma data local `d` no fuso do estabelecimento:

```
horário_est(d)  = exceção do estabelecimento em d  (fechado | horários especiais)  senão  semanal(dia_da_semana(d))
horário_prof(d) = exceção do profissional em d     (folga | jornada especial)      senão  semanal(dia_da_semana(d))
trabalho        = horário_est(d) ∩ horário_prof(d)            -- tstzmultirange
ocupado         = bloqueios(P) ∪ bloqueios do estabelecimento ∪ agendamentos não cancelados de P (com buffers)
livre           = trabalho − ocupado

para cada t na grade (ex.: :00, :15, :30, :45 a partir da meia-noite local):
    faixa = [t − buffer_antes, t + duração + buffer_depois)
    oferecer t  se  livre ⊇ faixa
                e   t ≥ agora + antecedência mínima
                e   d ≤ hoje + horizonte máximo
                e   estabelecimento ativo, profissional ativo/agendável, serviço ativo e habilitado para P
```

- **"Qualquer profissional"**: união dos horários de todos os profissionais habilitados; na reserva, o banco escolhe, sob lock, o profissional disponível com menos atendimentos no dia.
- **Reserva**: a RPC adquire lock do profissional, recalcula `livre ⊇ faixa` com a mesma função e insere; o `EXCLUDE` é a última barreira.
- **Reagendamento**: `UPDATE` atômico da mesma linha; se falhar, a transação é revertida e a reserva original permanece.

### 2.6. Fluxo de autorização

1. `proxy`/middleware: apenas renova a sessão Supabase e redireciona não autenticados de áreas privadas (camada de conveniência, **não** de segurança).
2. Layout de cada área (Server Component): `requirePlatformAdmin()` / `requireMembership(slug, roles)` / `requireProfessional(slug)` → 404 quando não autorizado (não revela existência).
3. Cada Server Action repete a autorização (actions são endpoints públicos) e valida a entrada com Zod.
4. O banco aplica RLS e as RPCs verificam papel e tenant novamente.

---

## 3. Escopo

### 3.1. MVP (obrigatório)

1. Autenticação e autorização (login, recuperação de senha, convites, papéis).
2. Painel do Super Administrador (dashboard, estabelecimentos, status, convites, auditoria, configurações globais mínimas).
3. Cadastro de estabelecimentos com slug, fuso, identidade visual.
4. Convite de administradores e funcionários.
5. Painel do estabelecimento.
6. Gerenciamento de profissionais (com ou sem conta de acesso).
7. Serviços e categorias, com habilitação por profissional.
8. Horários do estabelecimento e jornadas individuais (múltiplos intervalos/dia).
9. Motor de disponibilidade.
10. Exceções de calendário e bloqueios (férias, folgas, ausências, feriados), com aviso de conflitos.
11. Página pública de agendamento (mobile-first, sem cadastro).
12. Criação, cancelamento e reagendamento (painel e link privado do cliente).
13. Agenda administrativa (dia, semana, mês, lista, por profissional, consolidada).
14. Agenda do profissional.
15. Clientes e histórico.
16. Dashboards básicos (plataforma, estabelecimento, profissional).
17. Personalização da página pública (logo, capa, cor de destaque, contatos).
18. Deploy funcional na Vercel (Hobby na fase de demonstração/vendas; Pro ao fechar o primeiro cliente).
19. Registro de recebimentos por atendimento (D19).
20. Módulo financeiro do SaaS — fases B1 a B4 de [BILLING.md](./BILLING.md) (fundação comercial, cobranças manuais, interfaces, automação). B5 (gateway) depende de aprovação.

### 3.2. Fora do MVP (arquitetura preparada, nada simulado)

Gateway de pagamento do SaaS (B5, após aprovação), pagamento antecipado de agendamentos pelo cliente final, emissão de NFS-e, WhatsApp/e-mail/lembretes automáticos, fidelidade, cupons, estoque, comissões, financeiro, venda de produtos, avaliações, lista de espera, múltiplas unidades, domínio próprio, PWA, app mobile, acesso de suporte (impersonação) do Super Admin, contas de cliente final, múltiplos serviços por agendamento, preço/duração por profissional.

Pontos de extensão já previstos: `business_type` no estabelecimento; `establishment_settings` extensível; `source` no agendamento; `appointment_events` como trilha genérica; `billing_features`/`private.entitlement()` para novas limitações por plano; `PaymentProvider` para gateways; `appointment_payments` preparado para receber pagamentos online no futuro.

---

## 4. Inconsistências, riscos e casos extremos identificados

### 4.1. Ambiguidades resolvidas (decisões tomadas)

| Tema | Decisão |
|---|---|
| Status "Pendente" | Usado apenas se o estabelecimento ativar "exigir confirmação". Padrão: reservas públicas entram como **Confirmado**. Pendente também bloqueia o horário. |
| Suspenso × Desativado | **Suspenso** (administrativo ou financeiro): modo `restricted` — página pública mostra "agendamentos indisponíveis"; equipe consulta tudo, gerencia/cancela reservas existentes e acessa a área de assinatura, mas não cria nada novo. **Desativado**: página pública 404, equipe sem acesso; dados preservados. Regras completas em BILLING §12. |
| Funcionário editando os próprios horários | Permitido somente se a configuração `staff_can_manage_own_schedule` estiver ativa (padrão: ativa para bloqueios/folgas, desativada para jornada semanal). A jornada efetiva sempre é intersectada com o horário do estabelecimento. |
| Almoço | Almoço recorrente = lacuna na jornada semanal (09–12, 13–18). Almoço/pausa pontual = bloqueio. |
| Férias de vários dias | Bloqueio com intervalo `[início, fim)` no fuso do estabelecimento, flag "dia inteiro" para exibição. |
| Aviso de conflito | Alterações de horário/bloqueio retornam a lista de agendamentos afetados antes de salvar; após salvar, os conflitos aparecem no dashboard ("Agendamentos fora da disponibilidade") até serem resolvidos. Nada é cancelado automaticamente. |
| Cliente perdeu o link | Não há busca por código + telefone (seria enumerável). O cliente contata o estabelecimento. OTP por WhatsApp/e-mail é expansão futura. |
| Dados de cliente na reserva pública | Se o telefone já existe na base do estabelecimento, o cadastro existente **não** é sobrescrito pelo formulário público (evita adulteração por terceiros); o nome informado fica no snapshot do agendamento. |
| Encaixe | Admin pode criar agendamento fora do expediente com confirmação explícita ("encaixe"), mas **nunca** sobreposto a outro agendamento. |
| Troca de slug | Apenas Super Admin, com aviso de que links compartilhados deixam de funcionar. Redirecionamento de slugs antigos: P2. |
| Troca de fuso do estabelecimento | Agendamentos são instantes (`timestamptz`), portanto preservados; a UI avisa que os horários locais exibidos mudarão. |
| Desativar profissional/serviço com agendamentos futuros | Bloqueado até que os agendamentos sejam remanejados ou cancelados (a UI lista quais). Exclusão é sempre lógica. |
| Faturamento | Resolvido com D19 (ver §4.2): Previsto × Realizado × **Recebido** (registrado). |
| Super Admin e dados de clientes | Ver D14. |

### 4.2. Como resolvemos o "faturamento" sem gateway (D19)

Problema: sem registro de pagamento, o sistema só saberia o **valor previsto**, e não o que realmente entrou no caixa.

Solução: **registro de recebimento no próprio atendimento**, sem integração financeira.
- Ao clicar em **"Concluir atendimento"**, abre um diálogo curto: *valor cobrado* (pré-preenchido com o preço do serviço, editável para descontos no balcão), *forma de pagamento* (Pix, dinheiro, débito, crédito, outro) e *observação opcional*. Um toque em "Concluir e registrar".
- Pode ser feito depois ("Registrar pagamento" no agendamento) e aceita **mais de um lançamento** (ex.: parte em dinheiro, parte no Pix). Lançamentos errados são **anulados** com motivo (nunca apagados).
- Tabela `appointment_payments` (DATABASE §5.23), com RLS: admin vê tudo; staff registra nos próprios atendimentos (configurável).
- Dashboard e relatórios passam a ter três números distintos:
  - **Previsto** — agendamentos não cancelados no período (preço do snapshot);
  - **Realizado** — atendimentos concluídos (valor cobrado);
  - **Recebido** — soma dos pagamentos registrados, com divisão por forma de pagamento (útil para fechar o caixa do dia);
  - mais o indicador **"Concluídos sem pagamento registrado"**, para ninguém esquecer de lançar.
- É um registro administrativo da barbearia — não processa pagamentos. O mesmo modelo receberá pagamentos online (antecipados) quando houver gateway, com `provider` preenchido.

### 4.3. Riscos

| Risco | Mitigação |
|---|---|
| Vazamento entre tenants por política RLS errada | Funções auxiliares únicas de autorização, testes automatizados de isolamento (pgTAP + integração) para **todas** as tabelas, teste que falha se existir tabela sem RLS. |
| `SECURITY DEFINER` mal escrita | Padrão obrigatório (search_path vazio, nomes qualificados, assert de autorização na primeira linha), revisão dedicada, schema `private` não exposto. |
| Abuso do agendamento público (bots, reservas falsas) | Turnstile, honeypot, rate limit por IP e por telefone, limite de reservas ativas por telefone. |
| Middleware/proxy como única barreira (classe de falha já explorada em Next.js) | Autorização repetida em layouts, actions e banco. |
| E-mails de recuperação de senha no SMTP padrão do Supabase (limite muito baixo) | Convites não dependem de e-mail (D18). Recuperação de senha: na fase de vendas o Super Admin pode gerar um link de redefinição para copiar; Resend é configurado quando o volume exigir. |
| Planos gratuitos | Fase de demonstração/vendas em Vercel Hobby + Supabase Free (aprovado). Ao fechar o primeiro cliente pagante: migrar para Vercel Pro (Hobby não permite uso comercial) e Supabase Pro (Free pausa após 7 dias sem uso e não tem backups diários). Ver §6. |
| Horário de verão / fusos | Conversões sempre no banco via `AT TIME ZONE`; testes com fuso que tem horário de verão (ex.: `America/New_York`). |
| Crescimento do cálculo de disponibilidade | Cálculo por dia/profissional é barato (≤ 288 candidatos/dia em grade de 5 min); índices GiST; cache curto para datas do calendário se necessário. |

### 4.4. Casos extremos a cobrir em testes

- Serviço que terminaria após o fechamento ou dentro do almoço.
- Buffers no início/fim do expediente e entre agendamentos.
- Reserva simultânea do mesmo horário (N requisições paralelas → exatamente 1 sucesso).
- "Qualquer profissional" com dois clientes simultâneos no último horário livre.
- Reagendamento para horário ocupado (reserva original intacta).
- Cancelamento libera o horário imediatamente.
- Exceção de data (feriado) sobrepondo jornada semanal.
- Profissional de férias / inativo / sem habilitação para o serviço.
- Estabelecimento suspenso tentando receber reserva (inclusive via token antigo de reagendamento).
- Antecedência mínima e horizonte máximo nos limites exatos.
- Dia inexistente/ambíguo em transição de horário de verão.
- Telefone em formatos diferentes do mesmo número (normalização E.164).
- Alteração de preço após agendamento (histórico preservado).
- Usuário com vínculo em dois estabelecimentos alternando entre eles.

---

## 5. Etapas de desenvolvimento

| Fase | Objetivo | Entregáveis principais | Critério de conclusão |
|---|---|---|---|
| **0 — Planejamento** | Arquitetura e documentação | Todos os `.md`, `.env.example`, backlog | Aprovação do usuário |
| **1 — Fundação** | Base técnica segura | Projeto Next.js, Supabase local, migrations núcleo + RLS, auth, helpers de autorização, layout base, CI, bootstrap do Super Admin, testes de isolamento | Lint/typecheck/testes verdes no CI; login funcional; testes de RLS passam |
| **2 — Plataforma** | Super Admin operacional | Dashboard global, CRUD de estabelecimentos, uploads, convites, status, auditoria | Super Admin cria estabelecimento e o responsável aceita convite ponta a ponta |
| **3 — Estabelecimento** | Gestão do tenant | Painel, profissionais, serviços, categorias, clientes, configurações, página pública (personalização) | Admin configura o estabelecimento completo; isolamento testado |
| **4 — Motor** | Disponibilidade e reservas | Horários, exceções, bloqueios, funções de disponibilidade, RPCs de reserva/reagendamento/cancelamento, avisos de conflito | Testes unitários (pgTAP) e de concorrência passam |
| **5 — Agendamento público** | Fluxo do cliente | `/agendar/[slug]` em etapas, confirmação, `/reserva/[token]`, anti-abuso | E2E mobile passa; nenhum dado privado exposto |
| **6 — Operação** | Uso diário | Agendas (dia/semana/mês/lista), criação manual, status, painel do profissional, dashboards, histórico | Fluxos operacionais testados |
| **B1 — Fundação comercial** | Planos, assinaturas, limites | Tabelas de billing, RLS, catálogo inicial, limite de profissionais, `establishment_mode` | Testes F4, F5, F18, F23 |
| **B2 — Cobranças manuais** | Faturar e receber | Faturas, ofertas, implantação, adicionais, descontos, pagamentos, comprovantes | Super Admin cadastra, atribui plano, cobra e confirma pagamento ponta a ponta |
| **B3 — Interfaces financeiras** | Gestão e indicadores | Dashboard financeiro, aba financeira, `/painel/[slug]/assinatura`, CSV | Indicadores conferidos com dados de teste |
| **B4 — Automação** | Rotina diária | `pg_cron`, régua, inadimplência, suspensão/reativação | F14, F16, F17 |
| **B5 — Gateway** | Pagamento automático | Após sua aprovação do provedor | F15 + testes de segurança |
| **7 — Qualidade e deploy** | Produção | Revisão de segurança, E2E completo, acessibilidade, performance, docs finais, produção na Vercel | Checklist de produção 100% (ver SECURITY.md §10) |

Ordem de execução: **1 → 2 → 3 → B1 → B2 → 4 → 5 → 6 → B3 → B4 → 7 → B5**.
- B1/B2 entram logo após a Fase 3 porque dependem de `professionals` (limite de vagas) e são necessárias para vender: o objetivo é você conseguir cadastrar, atribuir plano, cobrar e confirmar pagamento cedo.
- As fases 5 e 6 podem correr em paralelo após a 4 (módulos distintos), desde que coordenadas (ver CLAUDE.md §8).

---

## 6. Dependências e custos

### 6.1. Bibliotecas (versões estáveis fixadas na Fase 1)

`next` (App Router; versão estável mais recente no início da Fase 1), `react`, `typescript` (strict), `@supabase/supabase-js`, `@supabase/ssr`, `tailwindcss` (v4), `shadcn/ui` (CLI), `lucide-react`, `zod`, `react-hook-form`, `@hookform/resolvers`, `date-fns` (v4), `@date-fns/tz`, `libphonenumber-js`, `server-only`, `sonner` (toasts), `next-themes`.
Dev: `vitest`, `@testing-library/react`, `@playwright/test`, `eslint`, `prettier`, `supabase` (CLI), pgTAP (via `supabase test db`).

### 6.2. Serviços e custos estimados (produção)

| Serviço | Agora (demonstração/vendas) | Ao fechar o 1º cliente | Motivo |
|---|---|---|---|
| Vercel | **Hobby** (US$ 0) | **Pro** (~US$ 20/mês por membro) | Hobby é restrito a uso não comercial |
| Supabase | **Free** (US$ 0) | **Pro** (~US$ 25/mês) | Free pausa após 7 dias sem uso e não tem backups diários |
| Resend (e-mail) | não usado (links copiáveis) | Free quando necessário | Recuperação de senha e, depois, régua de cobrança por e-mail |
| Cloudflare Turnstile | Free | Anti-bot | US$ 0 |
| Domínio | — | URL pública | ~R$ 40–80/ano (.com.br) |

Desenvolvimento local usa Supabase CLI (Docker) e não gera custo. Durante a demonstração no Supabase Free, acessar o projeto ao menos uma vez por semana evita a pausa automática. **Nenhum custo será contratado sem sua aprovação.**

---

## 7. Critérios de conclusão do MVP

- Todos os cenários obrigatórios do §22 do briefing passam em testes automatizados (mapeados em [BACKLOG.md](./BACKLOG.md#cenários-obrigatórios-de-aceitação)).
- 100% das tabelas com RLS e testes de isolamento.
- Nenhuma chave secreta no bundle do cliente (verificação automatizada no CI).
- Lint, typecheck e testes verdes no CI em `main`.
- Fluxo público validado em viewport móvel (Playwright, 360×640 e 390×844).
- Deploy na Vercel (Hobby para demonstração; Pro + Supabase Pro antes do primeiro cliente pagante) e checklist de segurança concluído.
- Critérios F1–F24 de [BILLING.md §22](./BILLING.md#22-critérios-de-aceitação) passando para as fases B1–B4.
- Documentação sincronizada (PROGRESS.md e BACKLOG.md atualizados).

---

## 8. Decisões

### 8.1. Aprovadas em 2026-11-25

D1–D17 (incluindo motor em SQL, rate limit em Postgres + Turnstile, Super Admin sem dados pessoais de clientes, um serviço por agendamento, buffers dentro do expediente), reservas públicas entrando como **Confirmado**, nome provisório configurável, **Vercel Hobby + Supabase Free** na fase de demonstração/vendas, **convites por link copiável** (D18) e **registro de recebimentos por atendimento** (D19).

### 8.2. Pendentes (módulo financeiro)

Listadas em [BILLING.md §23](./BILLING.md#23-decisões-que-precisam-de-aprovação). Têm recomendação padrão; se não houver objeção, a implementação segue as recomendações.
