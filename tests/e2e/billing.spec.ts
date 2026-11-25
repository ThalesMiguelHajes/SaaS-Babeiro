import { expect, test, type Page } from "@playwright/test";

/**
 * Financeiro (B1/B2): cadastrar → plano → fatura → comprovante → pagamento → ativo.
 * Usa a Barbearia B do seed (sem assinatura). Executar com: E2E_DB=1 pnpm test:e2e
 */
test.skip(!process.env.E2E_DB, "Requer Supabase local com seed (E2E_DB=1).");
test.describe.configure({ mode: "serial" });

const EST_B = "10000000-0000-4000-a000-00000000000b";
// PNG 1×1 válido (o servidor confere o tipo real pelo conteúdo).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("Senha123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Fluxo com dados roda uma vez (desktop).");
});

test("Super Admin atribui plano com a oferta de entrada e a 1ª fatura sai de R$ 100,00", async ({
  page,
}) => {
  await login(page, "super@local.dev");
  await page.goto(`/admin/estabelecimentos/${EST_B}`);
  await page.getByRole("tab", { name: "Financeiro" }).click();
  await page.getByLabel("Plano").selectOption({ index: 1 }); // Essencial
  await expect(page.getByTestId("first-invoice-preview")).toHaveText(/100,00/);
  await page.getByRole("button", { name: "Atribuir plano e gerar fatura" }).click();
  await expect(page.getByText("Plano atribuído e 1ª fatura gerada.")).toBeVisible();
  await expect(page.getByTestId("billing-Plano")).toHaveText("Essencial");

  await page
    .getByRole("link", { name: /FAT-\d{4}-\d{6}/ })
    .first()
    .click();
  await expect(page.getByTestId("invoice-total")).toHaveText(/100,00/);
  await expect(page.getByText("Documento interno de cobrança — sem valor fiscal.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Enviar cobrança pelo WhatsApp" })).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/5521998765432\?text=/,
  );

  // Em implantação a página de agendamento fica desligada.
  await page.goto("/agendar/barbearia-b");
  await expect(page.getByText("O agendamento online está indisponível no momento.")).toBeVisible();
});

test("dono vê o aviso de implantação e envia o comprovante", async ({ page }) => {
  await login(page, "dono.b@local.dev");
  await expect(page.getByText(/Conta em implantação/)).toBeVisible();
  await page.goto("/painel/barbearia-b/assinatura");
  await expect(page.getByTestId("seat-usage")).toHaveText("0 de 2 vagas");
  await page
    .getByRole("link", { name: /FAT-\d{4}-\d{6}/ })
    .first()
    .click();
  await page
    .getByLabel("Arquivo do comprovante")
    .setInputFiles({ name: "pix.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText(/Comprovante enviado/)).toBeVisible();
  await expect(page.getByText("Em conferência")).toBeVisible();
  // Enviar não confirma: a fatura continua em aberto.
  await expect(page.getByText("Em aberto").first()).toBeVisible();
});

test("Super Admin confere o comprovante, confirma e a assinatura fica ativa", async ({
  page,
  browser,
}) => {
  await login(page, "super@local.dev");
  await page.goto("/admin/financeiro");
  await expect(page.getByText("Comprovantes para conferir")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar pagamento" }).first().click();
  await expect(page.getByText("Pagamento confirmado.")).toBeVisible();

  const owner = await browser.newPage();
  await login(owner, "dono.b@local.dev");
  await expect(owner.getByText(/Conta em implantação/)).toHaveCount(0);
  await owner.goto("/painel/barbearia-b/assinatura");
  await expect(owner.getByText("Ativa")).toBeVisible();
  await expect(owner.getByText("Paga").first()).toBeVisible();
});

test("staff não acessa a área de assinatura", async ({ page }) => {
  await login(page, "staff.a@local.dev");
  await page.goto("/painel/barbearia-b/assinatura");
  await expect(page.getByText("Página não encontrada")).toBeVisible();
});

test("Super Admin executa a rotina de cobrança e ajusta a régua", async ({ page }) => {
  await login(page, "super@local.dev");
  await page.goto("/admin/financeiro");
  await expect(page.getByText("Cobranças do dia")).toBeVisible();
  await page.getByRole("button", { name: "Executar rotina agora" }).click();
  await expect(page.getByText("Rotina executada.")).toBeVisible();
  await expect(page.getByTestId("last-run")).toContainText("concluída");

  await page.goto("/admin/financeiro/configuracoes");
  await page.getByLabel("Tipo de chave Pix").selectOption("cnpj");
  await page.getByLabel("Chave Pix", { exact: true }).fill("12.345.678/0001-90");
  await page.getByLabel("Nome do recebedor").fill("Agenda Tecnologia");
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByText("Configurações salvas.")).toBeVisible();

  await page.getByLabel("Dias da régua (relativos ao vencimento)").fill("-3, 0, 2");
  await page.getByRole("button", { name: "Salvar régua" }).click();
  await expect(page.getByText("Régua salva.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Dias da régua (relativos ao vencimento)")).toHaveValue("-3, 0, 2");
});

test("painel de indicadores, listas com CSV e cupom", async ({ page }) => {
  await login(page, "super@local.dev");
  await page.goto("/admin/financeiro?periodo=12m");
  await expect(page.getByText("Faturado × recebido (12 meses)")).toBeVisible();
  await expect(page.getByTestId("insight-Receita recorrente (MRR)")).not.toHaveText(/^R\$\s0,00$/);

  await page.goto("/admin/financeiro/listas?aba=faturas");
  await expect(
    page
      .getByTestId("billing-list")
      .getByText(/FAT-\d{4}-\d{6}/)
      .first(),
  ).toBeVisible();
  const csv = await page.request.get("/admin/financeiro/exportar?tipo=faturas");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain("Número;Estabelecimento");

  await page.goto("/admin/financeiro/cupons");
  await page.getByLabel("Código").fill("E2E10");
  await page.getByLabel("Nome", { exact: true }).fill("Teste E2E");
  await page.getByRole("button", { name: "Criar cupom" }).click();
  await expect(page.getByText("Cupom criado.")).toBeVisible();
  await expect(page.getByText("E2E10")).toBeVisible();

  await page.goto(`/admin/estabelecimentos/${EST_B}`);
  await page.getByRole("tab", { name: "Financeiro" }).click();
  await page.getByLabel("Aplicar cupom").fill("e2e10");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(page.getByText("Cupom aplicado.")).toBeVisible();
  await expect(page.getByText(/Teste E2E · 10%/)).toBeVisible();
});

test("staff e dono não baixam o CSV do financeiro", async ({ page }) => {
  await login(page, "dono.a@local.dev");
  const res = await page.request.get("/admin/financeiro/exportar?tipo=pagamentos");
  expect(res.status()).toBe(404);
});
