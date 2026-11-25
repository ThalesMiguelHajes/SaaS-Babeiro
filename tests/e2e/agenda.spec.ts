import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * Fase 6 — agenda, painel do agendamento e recebimentos contra o Supabase local (seed).
 * Executar com: E2E_DB=1 pnpm test:e2e
 */
test.skip(!process.env.E2E_DB, "Requer Supabase local com seed (E2E_DB=1).");
test.describe.configure({ mode: "serial" });

const base = "/painel/barbearia-a";
const EST = "10000000-0000-4000-a000-00000000000a";
const PRO = "20000000-0000-4000-a000-00000000000a";
const SERVICE = "30000000-0000-4000-a000-00000000000a";

/** Uma sexta-feira futura diferente a cada execução (seg–sáb abertos no seed). */
function pickDate(): string {
  const d = new Date();
  d.setUTCDate(
    d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7) + 7 * (2 + Math.floor(Math.random() * 30)),
  );
  return d.toISOString().slice(0, 10);
}
const date = pickDate();
const localDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("dono.a@local.dev");
  await page.getByLabel("Senha").fill("Senha123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Fluxo com dados roda uma vez (desktop).");
});

test("dono cria, remarca e cancela um agendamento pela agenda", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/agenda?data=${date}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("group", { name: "Agenda de Rafael Seed" })).toBeVisible();

  await page.getByRole("button", { name: "Novo agendamento" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Serviço").selectOption({ label: "Corte clássico (30 min)" });
  await dialog.getByLabel("Profissional").selectOption({ label: "Rafael Seed" });
  await dialog.getByLabel("Data").fill(date);
  await dialog.getByRole("button", { name: "09:00", exact: true }).click();
  await dialog.getByLabel("Ou novo cliente: nome").fill("Cliente Agenda");
  await dialog.getByLabel("WhatsApp (opcional)").fill("(11) 98888-1234");
  await dialog.getByRole("button", { name: "Agendar" }).click();
  await expect(page.getByText("Agendamento criado.")).toBeVisible();

  const block = page.getByRole("button", { name: /09:00 Cliente Agenda/ });
  await expect(block).toBeVisible();
  await block.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Confirmado", { exact: true })).toBeVisible();
  await expect(sheet.getByRole("link", { name: /\(11\) 98888-1234/ })).toHaveAttribute(
    "href",
    /wa\.me\/5511988881234/,
  );

  await sheet.getByRole("button", { name: "Remarcar" }).click();
  await sheet
    .getByRole("list", { name: "Novos horários" })
    .getByRole("button", { name: "10:00" })
    .click();
  await sheet.getByRole("button", { name: "Confirmar remarcação" }).click();
  await expect(page.getByText("Agendamento remarcado.")).toBeVisible();
  await expect(sheet.getByText(/Remarcado para/)).toBeVisible();

  await sheet.getByRole("button", { name: "Cancelar", exact: true }).click();
  const confirm = page.getByRole("alertdialog");
  await confirm.getByRole("textbox").fill("Cliente desmarcou por telefone");
  await confirm.getByRole("button", { name: "Cancelar agendamento" }).click();
  await expect(page.getByText("Agendamento cancelado.")).toBeVisible();
  await expect(sheet.getByText("Cancelado", { exact: true }).first()).toBeVisible();
});

test("concluir atendimento com pagamento aparece em Recebido", async ({ page }) => {
  // Encaixe que começou há 30 minutos (pelo RPC: a agenda já permite, mas o teste precisa de um horário passado).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  await supabase.auth.signInWithPassword({ email: "dono.a@local.dev", password: "Senha123" });
  // Minuto aleatório nas últimas ~20h para o teste poder ser repetido na mesma base.
  const minutesAgo = 30 + Math.floor(Math.random() * 1200);
  const start = new Date(
    Math.floor(Date.now() / 60_000) * 60_000 - minutesAgo * 60_000,
  ).toISOString();
  const { data, error } = await supabase.rpc("create_appointment", {
    p_establishment_id: EST,
    p_service_id: SERVICE,
    p_professional_id: PRO,
    p_starts_at: start,
    p_customer_id: null,
    p_customer_name: "Cliente Caixa",
    p_customer_phone: null,
    p_customer_email: null,
    p_customer_notes: null,
    p_internal_notes: null,
    p_outside_working_hours: true,
  });
  expect(error).toBeNull();
  const id = (data as { id: string }).id;

  await login(page);
  await page.goto(`${base}/agenda?data=${localDate(start)}&abrir=${id}`);
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Concluir atendimento" }).click();
  await expect(sheet.getByLabel("Valor cobrado")).toHaveValue("45,00");
  await sheet.getByLabel("Forma").selectOption({ label: "Dinheiro" });
  await sheet.getByRole("button", { name: "Concluir e registrar" }).click();
  await expect(page.getByText("Atendimento concluído.")).toBeVisible();
  await expect(sheet.getByText("Concluído", { exact: true })).toBeVisible();
  await expect(sheet.getByText(/45,00 · Dinheiro/)).toBeVisible();

  await page.goto(`${base}?periodo=7d`);
  await expect(page.getByTestId("kpi-Recebido")).not.toHaveText(/^R\$\s0,00$/);
  await expect(page.getByText("Caixa por forma de pagamento")).toBeVisible();
  await expect(page.getByText("Dinheiro")).toBeVisible();
});

test("visão lista filtra por situação", async ({ page }) => {
  await login(page);
  await page.goto(`${base}/agenda?visao=lista&de=${date}&ate=${date}&status=cancelled`);
  await expect(page.getByRole("link", { name: /Cliente Agenda/ })).toBeVisible();
  await page.goto(`${base}/agenda?visao=lista&de=${date}&ate=${date}&status=confirmed`);
  await expect(page.getByRole("link", { name: /Cliente Agenda/ })).toHaveCount(0);
});
