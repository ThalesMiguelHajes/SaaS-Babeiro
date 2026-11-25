import { expect, test, type Page } from "@playwright/test";

/**
 * Fase 3 — painel do estabelecimento contra o Supabase local (seed).
 * Executar com: E2E_DB=1 pnpm test:e2e
 */
test.skip(!process.env.E2E_DB, "Requer Supabase local com seed (E2E_DB=1).");
test.describe.configure({ mode: "serial" });

const PASSWORD = "Senha123";
const suffix = Date.now().toString(36);
const proName = `Bruno ${suffix}`;
const serviceName = `Corte ${suffix}`;
const categoryName = `Cabelo ${suffix}`;
const base = "/painel/barbearia-a";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Fluxo com dados roda uma vez (desktop).");
});

test("dono vê o checklist de primeiros passos", async ({ page }) => {
  await login(page, "dono.a@local.dev");
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await expect(page.getByText("Primeiros passos")).toBeVisible();
  await expect(page.getByRole("link", { name: "Cadastrar os profissionais" })).toBeVisible();
});

test("dono cadastra profissional, categoria e serviço com quem o realiza", async ({ page }) => {
  await login(page, "dono.a@local.dev");

  await open(page, `${base}/profissionais/novo`);
  await page.getByLabel("Nome de exibição").fill(proName);
  await page.getByLabel("Especialidades").fill("Degradê, Barba");
  await page.getByRole("button", { name: "Cadastrar profissional" }).click();
  await expect(page.getByRole("heading", { name: proName })).toBeVisible();

  await open(page, `${base}/servicos`);
  await page.getByLabel("Nova categoria").fill(categoryName);
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText(categoryName)).toBeVisible();

  await open(page, `${base}/servicos/novo`);
  await page.getByLabel("Nome do serviço").fill(serviceName);
  await page.getByLabel("Preço").fill("40,00");
  await page.getByLabel("Categoria").selectOption({ label: categoryName });
  await page.getByRole("button", { name: "45 min" }).click();
  await page.getByLabel(proName).check();
  await page.getByRole("button", { name: "Cadastrar serviço" }).click();

  await expect(page).toHaveURL(new RegExp(`${base}/servicos$`));
  const row = page.getByRole("listitem").filter({ hasText: serviceName });
  await expect(row).toContainText("R$ 40,00");
  await expect(row).toContainText("45 min");
  await expect(row).not.toContainText("Sem profissional");
});

test("preço inválido é recusado com mensagem", async ({ page }) => {
  await login(page, "dono.a@local.dev");
  await open(page, `${base}/servicos/novo`);
  await page.getByLabel("Nome do serviço").fill("Serviço inválido");
  await page.getByLabel("Preço").fill("abc");
  await page.getByRole("button", { name: "Cadastrar serviço" }).click();
  await expect(page.getByText("Preço inválido. Ex.: 40,00")).toBeVisible();
});

test("dono altera o preço do serviço", async ({ page }) => {
  await login(page, "dono.a@local.dev");
  await open(page, `${base}/servicos`);
  await page.getByRole("link", { name: serviceName }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Preço")).toHaveValue("40,00");
  await page.getByLabel("Preço").fill("45,00");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/servicos$`));
  await expect(page.getByRole("listitem").filter({ hasText: serviceName })).toContainText(
    "R$ 45,00",
  );
});

test("dono vincula a conta do profissional e ele edita o próprio perfil", async ({
  page,
  browser,
}) => {
  await login(page, "dono.a@local.dev");
  await open(page, `${base}/profissionais`);
  await page.getByRole("link", { name: new RegExp(proName) }).click();
  await page.waitForLoadState("networkidle");
  await page
    .getByLabel("Conta da equipe")
    .selectOption({ label: "Bruno Barbeiro A (staff.a@local.dev)" });
  await page.getByRole("button", { name: "Vincular acesso" }).click();
  await expect(page.getByText("Conta vinculada:")).toBeVisible();

  const staff = await browser.newPage();
  await login(staff, "staff.a@local.dev");
  await expect(staff).toHaveURL(/\/profissional\/barbearia-a$/);
  await open(staff, "/profissional/barbearia-a/perfil");
  await expect(staff.getByLabel("Nome de exibição")).toHaveValue(proName);
  await staff.getByLabel("Sobre você").fill("Especialista em degradê.");
  await staff.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(staff.getByText("Perfil atualizado.")).toBeVisible();

  // Profissional não acessa o painel administrativo.
  await staff.goto(base);
  await expect(staff.getByText("Página não encontrada")).toBeVisible();
});

test("dono muda o papel de um membro; admin não altera o dono", async ({ page, browser }) => {
  await login(page, "dono.a@local.dev");
  await open(page, `${base}/equipe`);
  await page.getByLabel("Papel de Marcos Multi").selectOption("staff");
  await expect(page.getByText("Papel atualizado.")).toBeVisible();
  await page.getByLabel("Papel de Marcos Multi").selectOption("admin");
  await expect(page.getByText("Papel atualizado.").first()).toBeVisible();

  const admin = await browser.newPage();
  await login(admin, "admin.a@local.dev");
  await open(admin, `${base}/equipe`);
  await expect(admin.getByLabel("Papel de Carlos Dono A")).toHaveCount(0);
  await expect(admin.getByLabel("Papel de Marcos Multi")).toHaveCount(0); // admin não altera outro admin
  await expect(admin.getByLabel("Papel de Bruno Barbeiro A")).toBeVisible(); // mas altera profissionais
});

test("dono personaliza a página pública e as regras de agendamento", async ({ page }) => {
  await login(page, "dono.a@local.dev");
  await open(page, `${base}/pagina-publica`);
  await expect(page.getByLabel("Endereço da sua página")).toHaveValue(/\/agendar\/barbearia-a$/);
  await page.getByLabel("Descrição").fill(`Cortes clássicos ${suffix}`);
  await page.getByLabel("WhatsApp").fill("(11) 97777-6666");
  await page.getByRole("button", { name: "Cor Dourado" }).click();
  await page.getByRole("button", { name: "Salvar página" }).click();
  await expect(page.getByText("Página atualizada.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Descrição")).toHaveValue(`Cortes clássicos ${suffix}`);

  await open(page, `${base}/configuracoes`);
  await page.getByLabel("Intervalo entre horários").selectOption("30");
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByText("Configurações salvas.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Intervalo entre horários")).toHaveValue("30");
});

test("dono de outra barbearia não acessa o painel da Barbearia A", async ({ page }) => {
  await login(page, "dono.b@local.dev");
  for (const path of [`${base}/servicos`, `${base}/profissionais`, `${base}/equipe`]) {
    await page.goto(path);
    await expect(page.getByText("Página não encontrada")).toBeVisible();
  }
});
