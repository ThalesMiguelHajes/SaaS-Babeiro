# SECURITY — Modelo de segurança

> Segurança desde o início. Nenhuma regra crítica fica "para depois".
> Complementa [DATABASE.md §10–11](./DATABASE.md#10-funções-rpc-e-funções-auxiliares).

## 1. Princípios

1. **Defesa em profundidade**: proxy/middleware (conveniência) → layout/página (autorização) → Server Action (autorização + Zod) → banco (RLS, RPC com assert, constraints).
2. **O banco é a barreira final**: mesmo que a aplicação tenha um bug, o RLS e as constraints impedem vazamento entre tenants e reservas duplicadas.
3. **Nunca confiar no cliente**: `establishment_id`, `role`, preço, duração, status e profissional vindos do navegador são ignorados ou revalidados. O tenant é resolvido a partir do slug **e** do vínculo do usuário no servidor.
4. **Menor privilégio**: a chave secreta (`service_role`) só existe no servidor e só é usada onde não há alternativa.
5. **Minimização de dados** (LGPD): coletar e expor apenas o necessário.

## 2. Papéis

| Papel | Origem | Escopo |
|---|---|---|
| `platform_admin` (`super_admin`) | linha em `platform_admins` | Plataforma inteira (exceto dados pessoais de clientes, D14) |
| `platform_admin` (`billing_manager`) | idem, `platform_role = 'billing_manager'` | Apenas operações financeiras (BILLING §20) |
| `owner` | `establishment_members.role` | Um estabelecimento; responsável principal; único por estabelecimento |
| `admin` | idem | Um estabelecimento; gestão completa, exceto gerenciar o owner |
| `staff` | idem | Um estabelecimento; próprio perfil profissional, agenda e disponibilidade |
| cliente final | sem conta | Apenas via página pública e token da reserva |
| `anon` | — | Nenhum acesso direto a tabelas |

Papéis **nunca** são lidos de `user_metadata` (editável pelo próprio usuário) nem de parâmetros da requisição.

## 3. Matriz de permissões

Legenda: ✅ permitido · 🔸 apenas o próprio / com restrição · ❌ negado.

| Ação | Super Admin | Owner | Admin | Staff | Cliente |
|---|:-:|:-:|:-:|:-:|:-:|
| Acessar `/admin` | ✅ | ❌ | ❌ | ❌ | ❌ |
| Criar/editar estabelecimento (dados cadastrais, slug, fuso) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ativar/suspender/desativar estabelecimento | ✅ | ❌ | ❌ | ❌ | ❌ |
| Editar perfil público (descrição, contatos, logo, capa, cor) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Configurações de agendamento (antecedência, grade, políticas) | ❌ | ✅ | ✅ | ❌ | ❌ |
| Convidar owner | ✅ | ❌ | ❌ | ❌ | ❌ |
| Convidar admin / staff | ✅ | ✅ | 🔸 só staff e admin | ❌ | ❌ |
| Alterar papel / desativar membro | ✅ | ✅ (exceto a si) | 🔸 só staff | ❌ | ❌ |
| Alterar o **próprio** papel | ❌ | ❌ | ❌ | ❌ | ❌ |
| Cadastrar/editar profissionais | ❌ | ✅ | ✅ | 🔸 próprio perfil (bio, foto, especialidades) | ❌ |
| Serviços, categorias, habilitações | ❌ | ✅ | ✅ | ❌ (leitura) | leitura pública |
| Horário do estabelecimento e feriados | ❌ | ✅ | ✅ | ❌ (leitura) | leitura pública |
| Jornada semanal do profissional | ❌ | ✅ | ✅ | 🔸 própria, se `staff_can_manage_own_hours` | ❌ |
| Bloqueios/folgas/férias | ❌ | ✅ | ✅ | 🔸 próprios, se `staff_can_manage_own_blocks` | ❌ |
| Ver agenda consolidada | ❌ | ✅ | ✅ | ❌ | ❌ |
| Ver própria agenda | — | ✅ | ✅ | ✅ | ❌ |
| Criar agendamento | ❌ | ✅ | ✅ | 🔸 para si | ✅ via página pública |
| Encaixe fora do expediente | ❌ | ✅ | ✅ | ❌ | ❌ |
| Reagendar/cancelar | ❌ | ✅ | ✅ | 🔸 próprios | 🔸 própria reserva via token, conforme política |
| Alterar status do atendimento | ❌ | ✅ | ✅ | 🔸 próprios | ❌ |
| Ver clientes | ❌ | ✅ | ✅ | 🔸 só os que atendeu, sem notas internas | ❌ |
| Notas internas de clientes | ❌ | ✅ | ✅ | ❌ | ❌ |
| Anonimizar cliente (LGPD) | ❌ | ✅ | ✅ | ❌ | ❌ |
| Dashboard do estabelecimento / faturamento estimado | ❌ | ✅ | ✅ | ❌ | ❌ |
| Dashboard pessoal | — | ✅ | ✅ | ✅ | ❌ |
| Métricas globais da plataforma | ✅ | ❌ | ❌ | ❌ | ❌ |
| Auditoria | ✅ todas | ✅ do estabelecimento | ✅ do estabelecimento | ❌ | ❌ |
| Configurações globais | ✅ | ❌ | ❌ | ❌ | ❌ |
| Registrar recebimento de atendimento (cliente final) | ❌ | ✅ | ✅ | 🔸 próprios, se `staff_can_record_payments` | ❌ |
| Ver assinatura/faturas do SaaS do próprio estabelecimento | ✅ | ✅ | ✅ | ❌ | ❌ |
| Alterar preço contratado, descontos, confirmar pagamento do SaaS | ✅ | ❌ | ❌ | ❌ | ❌ |

Matriz financeira completa em [BILLING.md §20](./BILLING.md#20-segurança-e-permissões).

## 4. Isolamento multi-tenant

- RLS em 100% das tabelas de `public`, com funções auxiliares únicas (`private.*`).
- FKs compostas `(establishment_id, id)` impedem relações cruzadas; `establishment_id` imutável por trigger.
- Toda rota com `[slug]` resolve o estabelecimento no servidor e verifica o vínculo ativo do usuário; sem vínculo → **404** (não revela existência).
- Consultas de leitura no servidor usam o cliente Supabase **do usuário** (RLS ativo). A chave secreta não é usada para "facilitar" leituras do painel.
- Testes automatizados: para cada tabela, um usuário da Barbearia A tenta SELECT/INSERT/UPDATE/DELETE em dados da Barbearia B → deve falhar ou retornar vazio.

## 5. Operações privilegiadas

| Operação | Como | Controles |
|---|---|---|
| Criar o primeiro Super Admin | `pnpm bootstrap:super-admin <email>` (local, usa a chave secreta do ambiente) **ou** SQL no editor do Supabase: `insert into public.platform_admins (user_id) select id from auth.users where email = '...'` | Usuário precisa existir no Auth; registrado em `audit_logs`; nenhuma rota/política da API permite inserir em `platform_admins`. |
| Novos Super Admins | Mesmo procedimento manual | Sem UI no MVP, por design. |
| Convites | **Fluxo principal: link `/convite/[token]` copiável** (exibido uma única vez após `create_invitation`), enviado manualmente. Envio por e-mail (Resend) é opcional e posterior. | Token de uso único, 7 dias, e-mail precisa coincidir. |
| Link de redefinição de senha | Super Admin gera via `auth.admin.generateLink` (chave secreta) e copia, enquanto não houver SMTP próprio | Auditado; expira conforme Supabase Auth. |
| Operações financeiras | RPCs `billing_*` com `has_platform_permission('billing.manage')` | Auditoria na mesma transação; sem DELETE em tabelas financeiras. |
| Rotina de cobrança | `billing_run_daily()` executável apenas pelo papel `postgres` (pg_cron) | Lock consultivo; idempotente. |
| RPCs públicas | Executadas pelo servidor com a chave secreta | Turnstile + rate limit **antes** da chamada; RPC valida tudo de novo. |
| Uploads | Cliente do usuário + políticas de Storage | Tipo/tamanho validados no bucket e no servidor. |

Uso da chave secreta restrito a `src/lib/supabase/admin.ts` (com `import 'server-only'`). Lint impede importar esse arquivo fora de `src/modules/**/actions.ts`, `src/modules/booking/**` e `scripts/`.

## 6. Proteção contra escalonamento de privilégios

- Sem política de escrita em `platform_admins`, `establishment_members`, `establishment_invitations` para papéis da API; tudo via RPC com assert.
- `update_member_role` rejeita: alterar o próprio vínculo; admin promovendo a owner; admin alterando owner/admin; rebaixar o último owner.
- `accept_invitation` exige que o e-mail autenticado seja igual ao do convite, convite não expirado/revogado/aceito; consome o convite.
- Trigger `guard_establishment_columns` bloqueia `slug`, `status`, `timezone` fora das RPCs de Super Admin.
- `profiles` só permite atualizar `full_name`, `phone_e164`, `avatar_path` (GRANT por coluna).
- **Cadastro público desligado** no Supabase Auth (`enable_signup: false`): contas só são criadas pelo servidor ao aceitar um convite válido, ou manualmente pelo Studio.
- Login, recuperação e troca de senha usam mensagens neutras (não revelam se o e-mail existe); o parâmetro `next` só aceita caminhos internos (proteção contra open redirect); trocar a senha encerra as outras sessões.
- `user_metadata` nunca usado para autorização.

## 7. Página pública e dados de clientes

- RPCs públicas retornam DTOs mínimos: nunca `internal_notes`, `reason` de bloqueio, dados de outros clientes, nomes de quem ocupa horários, e-mails da equipe.
- Disponibilidade pública retorna **somente instantes livres**.
- Estabelecimento suspenso: página exibe aviso, RPCs de criação/reagendamento retornam `ESTABLISHMENT_UNAVAILABLE` (inclusive para tokens antigos); cancelamento pelo cliente continua permitido. Desativado: 404.
- Reserva pública não sobrescreve dados de cliente existente.
- Tokens de gestão: 256 bits aleatórios, apenas hash no banco, expiram 30 dias após o atendimento; página `/reserva/[token]` com `noindex`, `Referrer-Policy: no-referrer`, sem scripts de terceiros.
- `reference_code` não dá acesso a nada; é só um identificador para conversas com o estabelecimento.

## 8. Anti-abuso e rate limiting

| Alvo | Limite inicial (ajustável) | Chave |
|---|---|---|
| `public_create_booking` | 5 / hora / IP; 3 reservas ativas futuras / telefone / estabelecimento | hash(IP), telefone E.164 |
| `public_get_available_*` | 60 / minuto / IP | hash(IP) |
| Ações por token (`/reserva`) | 20 / hora / token; 30 / hora / IP | hash(token), hash(IP) |
| Login / recuperação de senha | limites do Supabase Auth + 10 / 15 min / IP no servidor | hash(IP) |
| Aceite de convite | 10 / hora / IP | hash(IP) |

Mais: Cloudflare Turnstile (validado no servidor) no envio da reserva; campo honeypot; tempo mínimo de preenchimento; Zod com limites de tamanho em todos os campos. IP obtido de `x-forwarded-for`/`x-real-ip` da Vercel e armazenado apenas como hash com segredo (`IP_HASH_SECRET`).

## 9. Sessões, cabeçalhos e erros

- `@supabase/ssr` com cookies `HttpOnly`, `Secure`, `SameSite=Lax`; no servidor usar `supabase.auth.getUser()`/verificação de claims (nunca confiar apenas em `getSession()` lido do cookie).
- Logout invalida a sessão; troca de senha encerra outras sessões.
- Cabeçalhos: CSP (com nonce), `X-Frame-Options: DENY` / `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restritivo, HSTS.
- Server Actions: validação de origem do Next.js mantida; nenhuma action sem autorização explícita.
- Erros: usuário vê mensagens em pt-BR por código de domínio; detalhes (SQL, stack) apenas nos logs do servidor. Nada de dados pessoais em logs.

## 10. Auditoria

Registrar em `audit_logs` (dentro da mesma transação da ação): criação/edição/status de estabelecimentos; convites (criação, revogação, aceite); alterações de papel/desativação de membros; alterações de preço/duração de serviço; alterações de configurações; anonimização de clientes; criação de Super Admin. Tabela append-only.

## 11. LGPD

- Base legal: execução de contrato (agendamento) — coletar só nome, telefone, e-mail opcional e observações.
- Aviso de privacidade na página pública (link para política do estabelecimento e da plataforma).
- Plataforma atua como **operadora**; estabelecimento como **controlador** dos dados dos seus clientes. Documentar nos termos de uso (pendência jurídica, fora do código).
- `anonymize_customer`: substitui nome/telefone/e-mail/notas por valores neutros, mantém agendamentos agregados para métricas.
- Retenção: tokens expiram; `rate_limits` limpos de hora em hora; logs sem dados pessoais desnecessários.
- Super Admin sem acesso a dados pessoais de clientes (D14).

## 12. Riscos identificados

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|:-:|:-:|---|
| R1 | Política RLS incorreta expõe outro tenant | Média | Crítico | Helpers únicos, testes por tabela, teste "tabela sem RLS", revisão na Fase 7 |
| R2 | `SECURITY DEFINER` sem assert ou com `search_path` vulnerável | Média | Crítico | Template obrigatório, lint SQL/checklist, pgTAP por RPC |
| R3 | Chave secreta no bundle do cliente | Baixa | Crítico | `server-only`, sem prefixo `NEXT_PUBLIC_`, verificação no CI do build |
| R4 | Bots lotando agendas | Média | Alto | §8 |
| R5 | Autorização só no middleware/proxy | Baixa | Crítico | Autorização repetida em layout, action e banco |
| R6 | IDOR em Server Actions (IDs do cliente) | Média | Alto | Toda action resolve tenant pelo vínculo; RLS como rede de proteção |
| R7 | Token de reserva vazado (encaminhado no WhatsApp) | Média | Médio | Escopo limitado a uma reserva, expiração, política de antecedência; sem dados de terceiros |
| R8 | E-mail de convite interceptado | Baixa | Alto | Expira em 7 dias, uso único, e-mail precisa coincidir com a conta |
| R9 | Enumeração de slugs | Alta | Baixo | Slugs são públicos por natureza; estabelecimentos desativados retornam 404 |
| R10 | Uploads maliciosos (SVG com script) | Baixa | Médio | Apenas JPEG/PNG/WebP (e PDF em comprovantes, bucket privado); sem SVG |
| R11 | Estabelecimento altera o próprio preço/limite ou confirma o próprio pagamento | Média | Alto | Escritas financeiras só via RPC de plataforma; RLS só leitura para owner/admin; testes F12/F13 |
| R12 | Ultrapassar limite de profissionais por requisições simultâneas | Média | Médio | Trigger com lock por estabelecimento; teste F23 |
| R13 | Comprovante falso confirmando pagamento | Média | Alto | Envio nunca confirma; conferência humana ou webhook verificado |
| R14 | Webhook falsificado/duplicado (fase gateway) | Média | Crítico | Verificação de assinatura, `event_id` único, validação de valor/moeda/fatura |
| R15 | Inconsistência entre suspensão administrativa e financeira | Média | Alto | `establishment_mode()` como fonte única |

## 13. Checklist de produção (Fase 7)

- [ ] Todas as tabelas com RLS + testes de isolamento verdes
- [ ] Todas as RPCs `SECURITY DEFINER` revisadas (assert, `search_path`, grants)
- [ ] `anon`/`authenticated` sem EXECUTE nas RPCs públicas
- [ ] Schema `private` fora dos schemas expostos
- [ ] Chave secreta apenas em variáveis de servidor na Vercel
- [ ] Turnstile e rate limits ativos
- [ ] Cabeçalhos de segurança e CSP verificados
- [ ] SMTP próprio configurado; templates de e-mail em pt-BR
- [ ] URLs de redirecionamento do Supabase Auth restritas ao domínio de produção
- [ ] Backups (Supabase Pro) e PITR avaliado
- [ ] Super Admin criado pelo procedimento documentado
- [ ] Bucket `billing-proofs` privado; URLs assinadas curtas
- [ ] `billing_run_daily` sem EXECUTE para papéis da API; job do `pg_cron` ativo
- [ ] Migração para Vercel Pro e Supabase Pro concluída antes do primeiro cliente pagante
- [ ] Supabase Security Advisor sem alertas críticos
