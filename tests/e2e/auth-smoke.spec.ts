import { expect, test } from "@playwright/test";

// Fumaça da Fase 1: não depende de usuários no banco.

test("página de login em pt-BR", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle(/Entrar/);
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("validação do formulário acontece antes de enviar", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Informe seu e-mail.")).toBeVisible();
  await expect(page.getByText("Informe sua senha.")).toBeVisible();
});

for (const path of ["/admin", "/painel/barbearia-a", "/profissional/barbearia-a", "/inicio"]) {
  test(`área privada ${path} exige login e preserva o destino`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`));
  });
}

test("open redirect no parâmetro next é ignorado", async ({ page }) => {
  await page.goto("/login?next=//malicioso.com");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("cabeçalhos de segurança", async ({ request }) => {
  const res = await request.get("/login");
  const headers = res.headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toMatch(
    /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
  );
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("link de confirmação inválido volta ao login com aviso", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=x&type=desconhecido");
  await expect(page.getByText("O link é inválido ou expirou.")).toBeVisible();
});
