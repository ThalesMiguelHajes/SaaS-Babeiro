import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * Fase 5 — agendamento público no celular contra o Supabase local (seed).
 * Barbearia A: "Corte clássico" (30 min) feito só por "Rafael Seed"; seg–sáb 09–12 e 13–19.
 * Executar com: E2E_DB=1 pnpm test:e2e
 */
test.skip(!process.env.E2E_DB, "Requer Supabase local com seed (E2E_DB=1).");
test.describe.configure({ mode: "serial" });

const SLUG = "barbearia-a";
const PRO = "20000000-0000-4000-a000-00000000000a";
const SERVICE = "30000000-0000-4000-a000-00000000000a";
const uniquePhone = () =>
  `(11) 9${String(Date.now()).slice(-8, -4)}-${String(Date.now()).slice(-4)}`;

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Viewports de celular definidos no próprio teste.",
  );
});

async function chooseServiceAndFirstSlot(page: Page) {
  await page.goto(`/agendar/${SLUG}`);
  await expect(page.getByRole("heading", { name: "Barbearia A" })).toBeVisible();
  await page.getByRole("button", { name: /Corte clássico/ }).click();
  // Um único profissional faz o serviço: a escolha de profissional é pulada.
  await expect(page.getByRole("heading", { name: "Escolha o dia e o horário" })).toBeVisible();
  const day = page.getByRole("option").nth(1); // segundo dia disponível (evita a antecedência de hoje)
  await day.click();
  await expect(day).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Buscando horários…")).toHaveCount(0);
  const firstSlot = page
    .getByRole("button", { pressed: false })
    .filter({ hasText: /^\d{2}:\d{2}$/ })
    .first();
  const time = (await firstSlot.textContent())!;
  await firstSlot.click();
  await expect(page.getByRole("heading", { name: "Seus dados" })).toBeVisible();
  return time;
}

async function fillCustomer(page: Page, name: string) {
  await page.getByLabel("Seu nome").fill(name);
  await page.getByLabel("WhatsApp").fill(uniquePhone());
  await page.waitForTimeout(3100); // tempo mínimo de preenchimento (anti-bot)
  await page.getByRole("button", { name: "Confirmar agendamento" }).click();
}

test.describe("celular 360×640", () => {
  test.use({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });

  test("cliente agenda, remarca e cancela pelo link", async ({ page }) => {
    const time = await chooseServiceAndFirstSlot(page);
    await expect(page.getByText(new RegExp(`às ${time}`))).toBeVisible();
    await fillCustomer(page, "Cliente Público");

    await expect(page).toHaveURL(/\/reserva\/[A-Za-z0-9_-]{43}\?nova=1$/);
    await expect(page.getByRole("heading", { name: "Agendamento confirmado!" })).toBeVisible();
    await expect(page.getByTestId("booking-status")).toHaveText("Confirmado");
    await expect(page.getByText(/^Código [0-9A-Z]{8}$/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Enviar para meu WhatsApp" })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/\?text=/,
    );

    // Remarcar para outro horário do mesmo profissional
    await page.getByRole("button", { name: "Remarcar" }).click();
    const newDay = page.getByRole("option").nth(2);
    await newDay.click();
    await expect(newDay).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Buscando horários…")).toHaveCount(0);
    await page
      .getByRole("region", { name: "Remarcar" })
      .getByRole("button", { pressed: false })
      .filter({ hasText: /^\d{2}:\d{2}$/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Confirmar novo horário" }).click();
    await expect(page.getByText("Agendamento remarcado.")).toBeVisible();

    // Cancelar
    await page.getByRole("button", { name: "Cancelar agendamento" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Cancelar agendamento" })
      .click();
    await expect(page.getByTestId("booking-status")).toHaveText("Cancelado");
    await expect(page.getByRole("link", { name: "Fazer novo agendamento" })).toBeVisible();
  });

  test("horário tomado enquanto o cliente preenchia: aviso e volta para os horários", async ({
    page,
  }) => {
    await chooseServiceAndFirstSlot(page);
    const startsAt = new URL(page.url()).searchParams.get("horario")!;

    // Outra pessoa reserva o mesmo horário pelo painel.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
    await supabase.auth.signInWithPassword({ email: "dono.a@local.dev", password: "Senha123" });
    const { error } = await supabase.rpc("create_appointment", {
      p_establishment_id: "10000000-0000-4000-a000-00000000000a",
      p_service_id: SERVICE,
      p_professional_id: PRO,
      p_starts_at: startsAt,
      p_customer_id: null,
      p_customer_name: "Balcão",
      p_customer_phone: null,
      p_customer_email: null,
      p_customer_notes: null,
      p_internal_notes: null,
    });
    expect(error).toBeNull();

    await fillCustomer(page, "Cliente Atrasado");
    await expect(
      page.getByText("Esse horário acabou de ser reservado. Escolha outro."),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Escolha o dia e o horário" })).toBeVisible();
  });

  test("campos obrigatórios e WhatsApp inválido", async ({ page }) => {
    await chooseServiceAndFirstSlot(page);
    await page.getByLabel("WhatsApp").fill("123");
    await page.getByLabel("WhatsApp").blur(); // a mensagem do campo aparece ao sair dele
    await page.getByRole("button", { name: "Confirmar agendamento" }).click();
    await expect(page.getByText("Informe seu nome.")).toBeVisible();
    await expect(page.getByText("Informe um WhatsApp válido com DDD.")).toBeVisible();
  });
});

test.describe("celular 390×844", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("página do estabelecimento e voltar entre etapas", async ({ page }) => {
    await page.goto(`/agendar/${SLUG}`);
    await expect(page.getByRole("heading", { name: "Barbearia A" })).toBeVisible();
    await page.getByText("Horário de funcionamento").click();
    await expect(page.getByText("09:00–12:00 · 13:00–19:00").first()).toBeVisible();
    await page.getByRole("button", { name: /Corte clássico/ }).click();
    await expect(page.getByRole("heading", { name: "Escolha o dia e o horário" })).toBeVisible();
    await page.getByRole("button", { name: "Voltar" }).click();
    await expect(page.getByRole("heading", { name: "Escolha o profissional" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Qualquer profissional/ })).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);
  });

  test("link de reserva inválido e estabelecimento inexistente", async ({ page }) => {
    await page.goto(`/reserva/${"x".repeat(43)}`);
    await expect(page.getByRole("heading", { name: "Link inválido ou expirado" })).toBeVisible();
    // Com loading.tsx a resposta é transmitida (status 200); o Next marca a página como noindex.
    await page.goto("/agendar/nao-existe-aqui");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  });
});
