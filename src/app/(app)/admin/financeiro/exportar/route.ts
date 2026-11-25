import { isPlatformAdmin } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { centsToCsv, toCsv } from "@/modules/billing/csv";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Exportação CSV do financeiro (B3-5). Só para a plataforma; dados lidos com RLS do usuário. */
export async function GET(request: Request) {
  if (!(await isPlatformAdmin())) return new Response("Não encontrado", { status: 404 });
  const url = new URL(request.url);
  const kind = url.searchParams.get("tipo");
  const from = url.searchParams.get("de");
  const to = url.searchParams.get("ate");
  const supabase = await createClient();
  let csv: string;

  if (kind === "faturas") {
    let q = supabase
      .from("invoices")
      .select(
        "number, status, kind, due_date, issued_at, subtotal_cents, discount_cents, total_cents, amount_paid_cents, establishments(name)",
      )
      .neq("status", "draft")
      .order("due_date")
      .limit(10000);
    if (from && DATE.test(from)) q = q.gte("due_date", from);
    if (to && DATE.test(to)) q = q.lte("due_date", to);
    const { data } = await q;
    csv = toCsv(
      [
        "Número",
        "Estabelecimento",
        "Tipo",
        "Situação",
        "Vencimento",
        "Emissão",
        "Subtotal",
        "Desconto",
        "Total",
        "Pago",
      ],
      (data ?? []).map((i) => [
        i.number,
        i.establishments?.name,
        i.kind === "standalone" ? "avulsa" : "ciclo",
        i.status,
        i.due_date,
        i.issued_at?.slice(0, 10),
        centsToCsv(i.subtotal_cents),
        centsToCsv(i.discount_cents),
        centsToCsv(i.total_cents),
        centsToCsv(i.amount_paid_cents),
      ]),
    );
  } else if (kind === "pagamentos") {
    let q = supabase
      .from("payments")
      .select(
        "received_on, method, amount_cents, status, reference, reverse_reason, establishments(name)",
      )
      .order("received_on")
      .limit(10000);
    if (from && DATE.test(from)) q = q.gte("received_on", from);
    if (to && DATE.test(to)) q = q.lte("received_on", to);
    const { data } = await q;
    csv = toCsv(
      [
        "Recebido em",
        "Estabelecimento",
        "Forma",
        "Valor",
        "Situação",
        "Referência",
        "Motivo da reversão",
      ],
      (data ?? []).map((p) => [
        p.received_on,
        p.establishments?.name,
        p.method,
        centsToCsv(p.amount_cents),
        p.status,
        p.reference,
        p.reverse_reason,
      ]),
    );
  } else if (kind === "assinaturas") {
    const { data } = await supabase
      .from("subscriptions")
      .select(
        "status, contracted_at, activated_at, canceled_at, anchor_day, extra_professionals, price_override_cents, establishments(name), subscription_plan_versions(monthly_price_cents, subscription_plans(name))",
      )
      .order("created_at")
      .limit(10000);
    csv = toCsv(
      [
        "Estabelecimento",
        "Plano",
        "Situação",
        "Mensalidade",
        "Vagas extras",
        "Contratada em",
        "Ativada em",
        "Cancelada em",
        "Dia de vencimento",
      ],
      (data ?? []).map((s) => [
        s.establishments?.name,
        s.subscription_plan_versions?.subscription_plans?.name,
        s.status,
        centsToCsv(
          s.price_override_cents ?? s.subscription_plan_versions?.monthly_price_cents ?? 0,
        ),
        s.extra_professionals,
        s.contracted_at.slice(0, 10),
        s.activated_at?.slice(0, 10),
        s.canceled_at?.slice(0, 10),
        s.anchor_day,
      ]),
    );
  } else {
    return new Response("Tipo inválido", { status: 400 });
  }

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
