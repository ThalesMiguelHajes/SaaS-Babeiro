# DEPLOY — Colocar o sistema no ar (link para testar e demonstrar)

Fase atual: **demonstração/vendas** com planos gratuitos — **Vercel Hobby** (site) e **Supabase Free** (banco).
Tempo estimado: 30 a 40 minutos, uma única vez. Depois disso, cada atualização enviada ao GitHub publica o site sozinha.

> **Nunca cole senhas ou chaves no chat.** Elas vão apenas nos painéis do Supabase, do GitHub e da Vercel.
> Quando o site estiver no ar, basta me enviar o **link** (ex.: `https://saas-cabeleireiro.vercel.app`).

Vai precisar anotar (num bloco de notas só seu):

| Item | Onde aparece |
|---|---|
| Senha do banco | Você cria no passo A2 |
| Project URL | Supabase → Project Settings → API |
| Publishable key | Supabase → Project Settings → API Keys |
| Secret key | Supabase → Project Settings → API Keys |
| Reference ID | Supabase → Project Settings → General |
| Access token | Supabase → sua foto (canto superior) → Account → Access Tokens |

---

## Parte A — Supabase (banco de dados e login)

1. Acesse **supabase.com** → **Start your project** → entre com sua conta do GitHub.
2. **New project**:
   - Name: `saas-cabeleireiro`
   - Database Password: clique em **Generate a password** e **guarde** essa senha.
   - Region: **South America (São Paulo)**
   - Plano: **Free** → **Create new project** (leva ~2 minutos).
3. **Project Settings → API Keys**: copie a **Publishable key** e a **Secret key** (se não houver Secret key, clique em *Create secret key*). Em **Project Settings → API** (ou *Data API*), copie a **Project URL**.
4. **Project Settings → General**: copie o **Reference ID**.
5. Clique na sua foto (canto superior direito) → **Account preferences → Access Tokens → Generate new token** → nome `github-deploy` → copie o token.
6. **Authentication → Sign In / Providers**:
   - Desligue **Allow new users to sign up** (as contas são criadas só por convite).
   - Em **Email**, defina a senha mínima com **8** caracteres e exigência de **letras e números**, se a opção aparecer.

## Parte B — GitHub (aplicar o banco automaticamente)

1. No repositório **SaaS-Cabeleireiro** no GitHub: **Settings → Secrets and variables → Actions → New repository secret**. Crie três segredos:
   - `SUPABASE_ACCESS_TOKEN` → o token do passo A5
   - `SUPABASE_DB_PASSWORD` → a senha do banco do passo A2
   - `SUPABASE_PROJECT_REF` → o Reference ID do passo A4
2. Aba **Actions** → à esquerda, **Banco de dados (Supabase)** → **Run workflow** → **Run workflow**.

O workflow é acionado manualmente pela aba Actions.

3. Aguarde ficar **verde** (✓). Isso cria todas as tabelas, regras de segurança e o espaço para logos/capas.
   - Se ficar vermelho, abra a execução e me mande o print da mensagem de erro (ela não contém senhas).

## Parte C — Vercel (o site)

1. Acesse **vercel.com** → **Sign Up** → plano **Hobby** → entre com o GitHub.
2. **Add New… → Project** → escolha **SaaS-Cabeleireiro** → **Import**.
   - Se o repositório não aparecer: *Adjust GitHub App Permissions* e libere o acesso a ele.
3. Antes de clicar em Deploy, abra **Environment Variables** e adicione:

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_APP_NAME` | Nome que aparece no sistema (ex.: `Agenda`) |
   | `NEXT_PUBLIC_APP_URL` | `https://exemplo.vercel.app` (provisório — ajustamos no passo 5) |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL (A3) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (A3) |
   | `SUPABASE_SECRET_KEY` | Secret key (A3) — marque como **Sensitive** |

4. **Deploy**. Ao terminar, a Vercel mostra o endereço do site (ex.: `https://saas-cabeleireiro.vercel.app`). Copie.
5. **Settings → Environment Variables** → edite `NEXT_PUBLIC_APP_URL` com o endereço real → **Deployments** → no último deploy, **⋯ → Redeploy**.

## Parte D — Ligar o login ao endereço do site

No Supabase: **Authentication → URL Configuration**
- **Site URL**: o endereço da Vercel (ex.: `https://saas-cabeleireiro.vercel.app`)
- **Redirect URLs** → **Add URL**: o mesmo endereço seguido de `/**` (ex.: `https://saas-cabeleireiro.vercel.app/**`)

Opcional (e-mail de "esqueci minha senha" em português): **Authentication → Emails → Reset Password** → cole o conteúdo do arquivo `supabase/templates/recovery.html` do repositório e use o assunto `Redefina sua senha`.
Enquanto não houver e-mail próprio configurado, use o botão **Nova senha** em *Administração → Usuários* para gerar o link e enviar pelo WhatsApp.

## Parte E — Criar a sua conta de Super Administrador

1. Supabase → **Authentication → Users → Add user → Create new user**: seu e-mail e uma senha (8+ caracteres, letras e números). Marque **Auto Confirm User**.
2. Supabase → **SQL Editor → New query**, cole e troque o e-mail:

   ```sql
   insert into public.platform_admins (user_id)
   select id from auth.users where email = 'seu@email.com';
   ```

   Clique em **Run**. Deve aparecer `Success. 1 row`.

   > Se a conta foi criada **antes** do passo B (banco montado), rode também, antes do comando acima,
   > `insert into public.profiles (id, full_name, email) select id, 'Seu Nome', email from auth.users where email = 'seu@email.com' on conflict (id) do nothing;`
   > (a partir da migration `20261126130000_backfill_profiles` isso é corrigido automaticamente).

## Parte F — Testar

1. Abra o link da Vercel → entre com o e-mail e a senha da Parte E → você cai em **Administração**.
2. **Estabelecimentos → Novo estabelecimento** → preencha (use um e-mail seu, diferente do Super Admin, como responsável) → **Cadastrar**.
3. Copie o **link do convite** (ou toque em **WhatsApp**) e abra em uma **janela anônima** do navegador ou no celular → crie a senha → você entra no painel da barbearia como responsável.
4. No admin: teste **Suspender/Reativar**, envie uma **logo**, gere um convite de **profissional**, veja o **Histórico** e a **Auditoria**.

---

## Parte G — Proteção anti-robô da página de agendamento (opcional, recomendado antes de divulgar)

A página `/agendar/...` já tem limites por IP e por telefone, um campo-isca para robôs e tempo mínimo de preenchimento. Para acrescentar o desafio "não sou um robô" do Cloudflare (gratuito):

1. Crie uma conta em **dash.cloudflare.com** → **Turnstile** → **Add widget**. Em *Domains*, coloque `cabeleireiro-psi.vercel.app` (e o seu domínio, quando tiver). Modo: **Managed**.
2. Na Vercel → **Settings → Environment Variables**, adicione:
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = *Site Key* (tipo normal);
   - `TURNSTILE_SECRET_KEY` = *Secret Key* (marque como **Sensitive**).
3. Opcional: `IP_HASH_SECRET` (Sensitive) com um texto aleatório longo. Sem ela, o sistema usa um derivado da chave secreta do Supabase.
4. **Redeploy**. Enquanto as duas chaves do Turnstile não existirem, a página funciona sem o desafio.

## Rotina de cobrança (automática)

A rotina do financeiro é agendada sozinha no banco (pg_cron) quando a migration é aplicada: roda às 06:15 e às 18:15 (Brasília). Não é preciso configurar nada na Vercel. Atenção: no plano gratuito, o Supabase **pausa projetos após 7 dias sem uso**; pausado, a rotina não roda. Ao fechar o primeiro cliente, mude para o plano Pro (MASTER_PLAN §6).

## Atualizações futuras

- Código novo enviado à branch publicada → a Vercel publica sozinha em ~2 minutos.
- Migrations novas (`supabase/migrations/`) → o GitHub Action **Banco de dados (Supabase)** aplica sozinho (ou rode manualmente em *Actions*).

## Limites dos planos gratuitos (importante)

- **Vercel Hobby** não permite uso comercial: ao fechar o primeiro cliente pagante, migrar para **Pro**.
- **Supabase Free** pausa o projeto após **7 dias sem acesso** e não tem backup diário. Para reativar: painel do Supabase → **Restore project**. Ao ter cliente pagante, migrar para **Pro**.

## Pix com Asaas Sandbox

1. Use a aplicação local ou uma Preview da Vercel conectada a um projeto Supabase exclusivo de teste. Aplique as migrations nesse projeto e crie um estabelecimento com uma fatura em aberto. O Pix de teste é bloqueado na implantação de produção da Vercel e no Supabase do site publicado.
2. No Asaas Sandbox, crie um cliente fictício e obtenha seu ID `cus_...` e uma chave de API de teste.
3. Configure `ASAAS_SANDBOX_API_KEY`, `ASAAS_SANDBOX_CUSTOMER_ID`, `ASAAS_SANDBOX_WEBHOOK_TOKEN` (segredo exclusivo com pelo menos 32 caracteres) e `ASAAS_SANDBOX_SUPABASE_URL` (mesma URL de teste que `NEXT_PUBLIC_SUPABASE_URL`).
4. No Asaas Sandbox, configure o webhook `PAYMENT_RECEIVED` apontando para `/api/webhooks/asaas` na URL da aplicação de teste. Use `ASAAS_SANDBOX_WEBHOOK_TOKEN` como token de autenticação do webhook. A URL precisa estar acessível pelo Asaas para receber as notificações.
5. Entre como dono ou administrador do estabelecimento de teste, abra **Assinatura → Fatura → Gerar Pix de teste** e simule o pagamento no Asaas Sandbox. Recarregue a fatura para conferir a baixa. O botão **Consultar Pix** também pode atualizar a fatura diretamente a partir do status da cobrança.
