import { expect, test, type Page } from "@playwright/test";

/**
 * Fluxo completo da Fase 2 contra um Supabase real (supabase start + seed).
 * Executar com: E2E_DB=1 pnpm test:e2e
 */
test.skip(!process.env.E2E_DB, "Requer Supabase local com seed (E2E_DB=1).");
test.describe.configure({ mode: "serial" });

const PASSWORD = "Senha123";
const suffix = Date.now().toString(36);
const establishmentName = `Studio E2E ${suffix}`;
const slug = `studio-e2e-${suffix}`;
const ownerEmail = `dono-${suffix}@e2e.dev`;
const staffEmail = `staff-${suffix}@e2e.dev`;

let ownerInviteUrl = "";
let staffInviteUrl = "";
let establishmentPath = "";

// 1×1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function login(
  page: Page,
  email: string,
  password = PASSWORD,
  { expectSuccess = true } = {},
) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  if (expectSuccess) await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Fluxo com dados roda uma vez (desktop).");
});

test("login inválido mostra mensagem neutra", async ({ page }) => {
  await login(page, "super@local.dev", "senha-errada1", { expectSuccess: false });
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
});

test("usuário comum não acessa /admin", async ({ page }) => {
  await login(page, "dono.a@local.dev");
  await expect(page).toHaveURL(/\/painel\/barbearia-a$/);
  await page.goto("/admin");
  await expect(page.getByText("Página não encontrada")).toBeVisible();
  await page.goto("/painel/barbearia-b");
  await expect(page.getByText("Página não encontrada")).toBeVisible();
});

test("usuário com dois vínculos escolhe o estabelecimento", async ({ page }) => {
  await login(page, "multi@local.dev");
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole("link", { name: /Barbearia A/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Barbearia B/ })).toBeVisible();
});

test("Super Admin cadastra estabelecimento e recebe o convite do responsável", async ({ page }) => {
  await login(page, "super@local.dev");
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: "Novo estabelecimento" }).first().click();

  await page.getByLabel("Nome comercial").fill(establishmentName);
  await expect(page.getByLabel("Endereço da página de agendamento")).toHaveValue(slug);
  await page.getByLabel("Nome", { exact: true }).fill("Dono E2E");
  await page.getByLabel("E-mail").fill(ownerEmail);
  await page.getByLabel("WhatsApp").fill("(11) 98888-7777");
  await page.getByLabel("Cidade").fill("São Paulo");
  await page.getByLabel("UF").selectOption("SP");
  await page.getByRole("button", { name: "Cadastrar estabelecimento" }).click();

  await expect(page.getByText(`${establishmentName} cadastrado`)).toBeVisible();
  ownerInviteUrl = await page.getByLabel("Convite do responsável").inputValue();
  expect(ownerInviteUrl).toMatch(/\/convite\/[A-Za-z0-9_-]{43}$/);

  await page.getByRole("link", { name: "Abrir estabelecimento" }).click();
  await expect(page.getByRole("heading", { name: establishmentName })).toBeVisible();
  establishmentPath = new URL(page.url()).pathname;
});

test("slug duplicado é recusado com mensagem no campo", async ({ page }) => {
  await login(page, "super@local.dev");
  await page.goto("/admin/estabelecimentos/novo");
  await page.getByLabel("Nome comercial").fill("Outra Barbearia");
  await page.getByLabel("Endereço da página de agendamento").fill("barbearia-a");
  await page.getByRole("button", { name: "Cadastrar estabelecimento" }).click();
  await expect(page.getByText("Este endereço já está em uso.").first()).toBeVisible();
});

test("Super Admin suspende (com motivo) e reativa", async ({ page }) => {
  await login(page, "super@local.dev");
  await page.goto(establishmentPath);
  await page.waitForLoadState("networkidle"); // conteúdo chega por streaming; espera a hidratação

  await page.getByRole("button", { name: "Suspender" }).click();
  await page.getByRole("button", { name: "Suspender" }).last().click();
  await expect(page.getByText("Informe o motivo (mínimo de 3 caracteres).")).toBeVisible();
  await page.getByLabel("Motivo").fill("Teste automatizado");
  await page.getByRole("button", { name: "Suspender" }).last().click();
  await expect(page.locator("[data-slot=badge]").filter({ hasText: "Suspenso" })).toBeVisible();

  await page.getByRole("button", { name: "Reativar" }).click();
  await page.getByRole("button", { name: "Reativar" }).last().click();
  await expect(page.locator("[data-slot=badge]").filter({ hasText: "Ativo" })).toBeVisible();

  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(page.getByText("Status do estabelecimento alterado").first()).toBeVisible();
  await expect(page.getByText("ativo → suspenso · Teste automatizado")).toBeVisible();
});

test("Super Admin envia logo", async ({ page }) => {
  await login(page, "super@local.dev");
  await page.goto(establishmentPath);
  await page.waitForLoadState("networkidle"); // conteúdo chega por streaming; espera a hidratação
  await page
    .getByLabel("Logo", { exact: true })
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Imagem atualizada.")).toBeVisible();
  await expect(page.getByRole("img", { name: "Logo" })).toBeVisible();
});

test("arquivo que não é imagem é recusado", async ({ page }) => {
  await login(page, "super@local.dev");
  await page.goto(establishmentPath);
  await page.waitForLoadState("networkidle"); // conteúdo chega por streaming; espera a hidratação
  await page.getByLabel("Imagem de capa", { exact: true }).setInputFiles({
    name: "capa.png",
    mimeType: "image/png",
    buffer: Buffer.from("isto não é uma imagem"),
  });
  await expect(page.getByText("Envie uma imagem JPG, PNG ou WebP de até 5 MB.")).toBeVisible();
});

test("responsável cria a conta pelo convite e entra no painel", async ({ page }) => {
  await page.goto(ownerInviteUrl);
  await expect(page.getByText(`Convite para ${establishmentName}`)).toBeVisible();
  await expect(page.getByLabel("E-mail")).toHaveValue(ownerEmail);
  await page.getByLabel("Seu nome").fill("Dono E2E");
  await page.getByLabel("Crie uma senha").fill(PASSWORD);
  await page.getByLabel("Confirme a senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta e entrar" }).click();

  await expect(page).toHaveURL(new RegExp(`/painel/${slug}$`));
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();

  // Isolamento: o novo responsável não vê outro estabelecimento.
  await page.goto("/painel/barbearia-a");
  await expect(page.getByText("Página não encontrada")).toBeVisible();
});

test("convite é de uso único", async ({ page }) => {
  await page.goto(ownerInviteUrl);
  await expect(page.getByText("Convite já utilizado")).toBeVisible();
});

test("Super Admin convida um profissional; convite errado é recusado; profissional entra", async ({
  browser,
}) => {
  const admin = await browser.newPage();
  await login(admin, "super@local.dev");
  await admin.goto(establishmentPath);
  await admin.getByRole("tab", { name: /Equipe/ }).click();
  await expect(admin.getByText("Dono E2E")).toBeVisible();
  await admin.getByLabel("E-mail").fill(staffEmail);
  await admin.getByLabel("Papel").selectOption("staff");
  await admin.getByRole("button", { name: "Gerar convite" }).click();
  staffInviteUrl = await admin.getByLabel(/Link do convite/).inputValue();
  expect(staffInviteUrl).toMatch(/\/convite\//);
  await expect(admin.getByRole("cell", { name: staffEmail, exact: true })).toBeVisible();

  // Logado com outra conta: o convite não pode ser aceito.
  const other = await browser.newPage();
  await login(other, "dono.a@local.dev");
  await other.goto(staffInviteUrl);
  await expect(other.getByText(/mas o convite foi enviado para/)).toBeVisible();

  const staff = await browser.newPage();
  await staff.goto(staffInviteUrl);
  await staff.getByLabel("Seu nome").fill("Profissional E2E");
  await staff.getByLabel("Crie uma senha").fill(PASSWORD);
  await staff.getByLabel("Confirme a senha").fill(PASSWORD);
  await staff.getByRole("button", { name: "Criar conta e entrar" }).click();
  await expect(staff).toHaveURL(new RegExp(`/profissional/${slug}$`));
  await staff.goto(`/painel/${slug}`);
  await expect(staff.getByText("Página não encontrada")).toBeVisible();
});

test("Super Admin gera link de nova senha", async ({ page }) => {
  await login(page, "super@local.dev");
  await page.goto(`/admin/usuarios?q=${encodeURIComponent(ownerEmail)}`);
  await page.getByRole("button", { name: "Nova senha" }).click();
  await page.getByRole("button", { name: "Gerar link" }).click();
  const url = await page.getByLabel(/Link \(uso único/).inputValue();
  expect(url).toContain("/auth/confirm?token_hash=");
  expect(url).toContain("type=recovery");

  // O link leva à tela de nova senha.
  const fresh = await page.context().browser()!.newPage();
  await fresh.goto(url);
  await expect(fresh).toHaveURL(/\/redefinir-senha$/);
});
