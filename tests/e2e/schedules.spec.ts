import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * Fase 4 — horários, bloqueios, conflitos e horários livres contra o Supabase local (seed).
 * Executar com: E2E_DB=1 pnpm test:e2e
 */
test.skip(!process.env.E2E_DB, "Requer Supabase local com seed (E2E_DB=1).");
test.describe.configure({ mode: "serial" });

const PASSWORD = "Senha123";
const base = "/painel/barbearia-a";
const EST = "10000000-0000-4000-a000-00000000000a";
const PRO = "20000000-0000-4000-a000-00000000000a"; // Rafael Seed
const SERVICE = "30000000-0000-4000-a000-00000000000a"; // Corte clássico (30 min)

/** Uma quarta-feira futura diferente a cada execução (o seed abre seg–sáb, 09–12 e 13–19). */
function pickDate(): string {
  const d = new Date();
  const weeks = 2 + Math.floor(Math.random() * 40);
  d.setUTCDate(d.getUTCDate() + ((3 - d.getUTCDay() + 7) % 7) + 7 * weeks);
  return d.toISOString().slice(0, 10);
}
const date = pickDate();

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

async function searchSlots(page: Page, professional?: string) {
  await page.getByRole("tab", { name: "Horários livres" }).click();
  await page.getByLabel("Serviço").selectOption({ label: "Corte clássico (30 min)" });
  if (professional) await page.getByLabel("Profissional").selectOption({ label: professional });
  await page.locator("#sim-date").fill(date);
  await page.getByRole("button", { name: "Ver horários" }).click();
}

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Fluxo com dados roda uma vez (desktop).");
});

test("dono abre o domingo com horário próprio e o horário fica salvo", async ({ page }) => {
  await login(page, "dono.a@local.dev");
  await open(page, `${base}/horarios`);
  await expect(page.getByText("Horário de funcionamento", { exact: true })).toBeVisible();

  const sunday = page.getByTestId("weekday-0");
  if (!(await sunday.getByRole("switch").isChecked())) {
    await sunday.getByRole("switch").click();
  }
  await sunday.getByLabel("Domingo: início do intervalo 1").fill("10:00");
  await sunday.getByLabel("Domingo: fim do intervalo 1").fill("14:00");
  await page.getByRole("button", { name: "Salvar horário" }).click();
  await expect(page.getByText("Horário salvo.")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("weekday-0").getByLabel("Domingo: fim do intervalo 1")).toHaveValue(
    "14:00",
  );
});

test("intervalos sobrepostos são recusados antes de salvar", async ({ page }) => {
  await login(page, "dono.a@local.dev");
  await open(page, `${base}/horarios`);
  const monday = page.getByTestId("weekday-1");
  await monday.getByLabel("Segunda-feira: início do intervalo 2").fill("11:00");
  await expect(monday.getByText("O fim precisa ser depois do início")).toBeVisible();
  await page.getByRole("button", { name: "Salvar horário" }).click();
  await expect(page.getByText(/Confira os horários destacados/)).toBeVisible();
});

test("horários livres seguem o motor: almoço não é oferecido", async ({ page }) => {
  await login(page, "dono.a@local.dev");
  await open(page, `${base}/horarios`);
  await searchSlots(page, "Rafael Seed");
  const result = page.getByRole("status", { name: "Horários disponíveis" });
  await expect(result).toBeVisible();
  await expect(result.getByText("Manhã")).toBeVisible();
  await expect(result.getByText("09:00", { exact: true })).toBeVisible();
  await expect(result.getByText("11:30", { exact: true })).toBeVisible();
  await expect(result.getByText("12:00", { exact: true })).toHaveCount(0);
  await expect(result.getByText("18:30", { exact: true })).toBeVisible();
});

test("bloqueio sobre um agendamento pede confirmação e o agendamento vai para 'atenção'", async ({
  page,
}) => {
  // Agendamento criado pela RPC (a agenda visual chega na Fase 6).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  await supabase.auth.signInWithPassword({ email: "dono.a@local.dev", password: PASSWORD });
  const created = await supabase.rpc("create_appointment", {
    p_establishment_id: EST,
    p_service_id: SERVICE,
    p_professional_id: PRO,
    p_starts_at: `${date}T15:00:00-03:00`,
    p_customer_id: null,
    p_customer_name: "Cliente E2E",
    p_customer_phone: null,
    p_customer_email: null,
    p_customer_notes: null,
    p_internal_notes: null,
  });
  expect(created.error).toBeNull();

  await login(page, "dono.a@local.dev");
  await open(page, `${base}/profissionais/${PRO}/horarios`);
  await page.getByRole("tab", { name: "Bloqueios e férias" }).click();
  await page.getByLabel("Tipo").selectOption({ label: "Compromisso pessoal" });
  await page.getByLabel("Início", { exact: true }).fill(date);
  await page.getByLabel("Hora de início").fill("14:00");
  await page.getByLabel("Fim", { exact: true }).fill(date);
  await page.getByLabel("Hora de fim").fill("16:00");
  await page.getByRole("button", { name: "Adicionar bloqueio" }).click();

  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText("1 agendamento será afetado")).toBeVisible();
  await expect(dialog.getByText("Cliente E2E")).toBeVisible();
  await dialog.getByRole("button", { name: "Salvar mesmo assim" }).click();
  await expect(page.getByText(/Bloqueio salvo/)).toBeVisible();

  await searchSlots(page);
  const result = page.getByRole("status", { name: "Horários disponíveis" });
  await expect(result.getByText("13:30", { exact: true })).toBeVisible();
  await expect(result.getByText("14:00", { exact: true })).toHaveCount(0);
  await expect(result.getByText("16:00", { exact: true })).toBeVisible();

  await open(page, base);
  await expect(page.getByText("Agendamentos que precisam de atenção")).toBeVisible();
  await expect(page.getByText(/Cliente E2E/).first()).toBeVisible();
});

test("feriado fecha a casa na data", async ({ page }) => {
  await login(page, "dono.a@local.dev");
  await open(page, `${base}/horarios`);
  await page.getByRole("tab", { name: "Feriados e datas" }).click();
  const holiday = new Date(`${date}T12:00:00Z`);
  holiday.setUTCDate(holiday.getUTCDate() + 1);
  const holidayDate = holiday.toISOString().slice(0, 10);
  await page.locator("#ov-date-est").fill(holidayDate);
  await page.getByLabel("Descrição (opcional)").fill("Feriado municipal");
  await page.getByRole("button", { name: "Adicionar data" }).click();
  await expect(page.getByText("Data salva.")).toBeVisible();
  await expect(page.getByText(/Feriado municipal/)).toBeVisible();

  await page.getByRole("tab", { name: "Horários livres" }).click();
  await page.getByLabel("Serviço").selectOption({ label: "Corte clássico (30 min)" });
  await page.locator("#sim-date").fill(holidayDate);
  await page.getByRole("button", { name: "Ver horários" }).click();
  await expect(page.getByText("Nenhum horário livre nesse dia.")).toBeVisible();
});

test("staff sem vínculo não acessa os horários da casa", async ({ page }) => {
  await login(page, "staff.a@local.dev");
  await page.goto(`${base}/horarios`);
  await expect(page.getByText("Página não encontrada")).toBeVisible();
});
