import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { EstablishmentMode, InvoiceStatus, SubscriptionStatus } from "./rules";

export type BillingStatus = {
  mode: EstablishmentMode;
  subscription_status: SubscriptionStatus | null;
  plan_name: string | null;
  professional_limit: number | null;
  active_professionals: number;
  next_invoice: {
    id: string;
    number: string | null;
    total_cents: number;
    amount_paid_cents: number;
    due_date: string;
    status: InvoiceStatus;
  } | null;
};

/** Modo, plano e vagas do estabelecimento (banner do painel, limite de profissionais). */
export async function getBillingStatus(establishmentId: string): Promise<BillingStatus> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_establishment_billing_status", {
    p_establishment_id: establishmentId,
  });
  if (error) throw error;
  return data as unknown as BillingStatus;
}

export async function listPlans() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscription_plans")
    .select(
      "id, code, name, description, sort_order, is_active, subscription_plan_versions(id, version, monthly_price_cents, annual_price_cents, included_professionals, extra_professional_price_cents, is_current, created_at)",
    )
    .order("sort_order");
  return (data ?? []).map((p) => ({
    ...p,
    versions: [...p.subscription_plan_versions].sort((a, b) => b.version - a.version),
    current: p.subscription_plan_versions.find((v) => v.is_current) ?? null,
  }));
}

export async function getBillingSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from("billing_settings").select("*").maybeSingle();
  return data;
}

export async function getBillingOverview() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("billing_overview");
  if (error) throw error;
  return data as unknown as {
    mrr_cents: number;
    subscriptions: Record<string, number>;
    receivable_cents: number;
    overdue_cents: number;
    received_month_cents: number;
    pending_proofs: number;
    open_requests: number;
  };
}

const INVOICE_LIST =
  "id, number, kind, status, due_date, total_cents, amount_paid_cents, period_start, period_end, issued_at, establishment_id, establishments(name, slug)";

export async function listInvoices(filter: { establishmentId?: string; openOnly?: boolean } = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("invoices")
    .select(INVOICE_LIST)
    .order("due_date", { ascending: false })
    .limit(200);
  if (filter.establishmentId) q = q.eq("establishment_id", filter.establishmentId);
  if (filter.openOnly) q = q.in("status", ["open", "partially_paid", "overdue"]);
  const { data } = await q;
  return data ?? [];
}

export async function getInvoice(id: string) {
  const supabase = await createClient();
  const [inv, items, allocations, proofs] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        `${INVOICE_LIST}, discount_cents, subtotal_cents, original_due_date, payment_instructions, notes, cancel_reason, paid_at, subscription_id, cycle_index`,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("invoice_items")
      .select("id, kind, description, quantity, unit_price_cents, amount_cents")
      .eq("invoice_id", id)
      .order("created_at"),
    supabase
      .from("payment_allocations")
      .select(
        "id, amount_cents, payments(id, method, amount_cents, received_on, status, reference, reverse_reason)",
      )
      .eq("invoice_id", id),
    supabase
      .from("payment_proofs")
      .select("id, status, storage_path, created_at, rejection_reason")
      .eq("invoice_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!inv.data) return null;
  return {
    ...inv.data,
    items: items.data ?? [],
    allocations: allocations.data ?? [],
    proofs: proofs.data ?? [],
  };
}

/** Tudo do financeiro de um estabelecimento (aba "Financeiro" do Super Admin e área de assinatura). */
export async function getEstablishmentBilling(establishmentId: string) {
  const supabase = await createClient();
  const [subs, invoices, payments, discounts, charges, requests] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "id, status, interval, anchor_date, anchor_day, next_cycle_index, auto_suspend_override, grace_days_override, price_override_cents, price_override_reason, extra_professionals, activated_at, contracted_at, notes, cancel_reason, suspension_reason, plan_version_id, subscription_plan_versions(id, version, monthly_price_cents, included_professionals, extra_professional_price_cents, subscription_plans(name, code))",
      )
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select(INVOICE_LIST)
      .eq("establishment_id", establishmentId)
      .order("due_date", { ascending: false })
      .limit(50),
    supabase
      .from("payments")
      .select(
        "id, method, amount_cents, received_on, status, reference, reverse_reason, created_at",
      )
      .eq("establishment_id", establishmentId)
      .order("received_on", { ascending: false })
      .limit(50),
    supabase
      .from("subscription_discounts")
      .select(
        "id, name, kind, value, duration, cycles_total, cycles_applied, reason, revoked_at, subscription_id",
      )
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("billing_charges")
      .select("id, kind, description, quantity, unit_price_cents, status, created_at")
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("billing_requests")
      .select("id, kind, message, status, response, created_at")
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const all = subs.data ?? [];
  const current = all.find((s) => s.status !== "canceled") ?? null;
  return {
    subscription: current,
    pastSubscriptions: all.filter((s) => s !== current),
    invoices: invoices.data ?? [],
    payments: payments.data ?? [],
    discounts: discounts.data ?? [],
    charges: charges.data ?? [],
    requests: requests.data ?? [],
  };
}

export async function listPendingProofs() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_proofs")
    .select(
      "id, created_at, invoice_id, invoices(number, total_cents, amount_paid_cents), establishment_id",
    )
    .eq("status", "submitted")
    .order("created_at");
  return data ?? [];
}

export async function listOpenRequests() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("billing_requests")
    .select("id, kind, message, created_at, establishment_id, establishments(name)")
    .eq("status", "open")
    .order("created_at");
  return data ?? [];
}

export async function listAddOns() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("add_on_services")
    .select(
      "id, code, name, price_cents, price_is_starting_from, billing_type, unit_label, is_technically_available",
    )
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}

/** Oferta de entrada vigente (preço vem do banco) e se o estabelecimento já a usou. */
export async function getEntryOffer(establishmentId: string) {
  const supabase = await createClient();
  const [offers, used] = await Promise.all([
    supabase
      .from("promotional_offers")
      .select("id, name, first_cycle_price_cents, waives_setup_fee, ends_on")
      .eq("is_active", true)
      .order("created_at")
      .limit(1),
    supabase
      .from("promotion_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", establishmentId),
  ]);
  const offer = offers.data?.[0] ?? null;
  return { offer, alreadyUsed: (used.count ?? 0) > 0 };
}

export type Collection = {
  id: string;
  kind: string;
  days_from_due: number;
  invoice_id: string;
  number: string | null;
  due_date: string;
  balance_cents: number;
  invoice_status: string;
  establishment_id: string;
  establishment_name: string;
  slug: string;
  whatsapp_e164: string | null;
  pix_key: string | null;
  pix_receiver_name: string | null;
};

/** Avisos da régua pendentes de envio manual (BILLING §11.2). */
export async function listCollectionsToday(): Promise<Collection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("billing_collections_today");
  if (error) throw error;
  return (data ?? []) as unknown as Collection[];
}

export async function listJobRuns(limit = 5) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("billing_job_runs")
    .select(
      "id, run_date, started_at, finished_at, status, trigger, subscriptions_processed, invoices_created, notifications_created, status_changes, errors",
    )
    .order("id", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function listScheduledChanges(subscriptionId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscription_scheduled_changes")
    .select(
      "id, effective_on, status, result, extra_professionals, subscription_plan_versions(subscription_plans(name))",
    )
    .eq("subscription_id", subscriptionId)
    .order("created_at", { ascending: false })
    .limit(5);
  return data ?? [];
}

export type BillingDashboard = {
  mrr_cents: number;
  arr_cents: number;
  counted_subscriptions: number;
  average_ticket_cents: number;
  subscriptions: Record<string, number>;
  new_subscriptions: number;
  churn_rate: number;
  canceled: number;
  invoiced_cents: number;
  invoiced_by_kind: { recurring?: number; one_time?: number; entry_offer?: number };
  received_cents: number;
  receivable_cents: number;
  overdue_cents: number;
  delinquency_rate: number;
  by_plan: { plan: string; subscriptions: number; mrr_cents: number }[];
  monthly: { month: string; invoiced_cents: number; received_cents: number }[];
};

export async function getBillingDashboard(from: string, to: string): Promise<BillingDashboard> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("billing_dashboard", { p_from: from, p_to: to });
  if (error) throw error;
  return data as unknown as BillingDashboard;
}

export const PAGE_SIZE = 25;

/** Listas do financeiro (B3-3) com filtros e paginação. */
export async function listSubscriptionsPage(filter: { status?: string; page: number }) {
  const supabase = await createClient();
  let q = supabase
    .from("subscriptions")
    .select(
      "id, status, contracted_at, activated_at, anchor_day, extra_professionals, price_override_cents, establishment_id, establishments(name), subscription_plan_versions(monthly_price_cents, subscription_plans(name))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(filter.page * PAGE_SIZE, filter.page * PAGE_SIZE + PAGE_SIZE - 1);
  if (filter.status) q = q.eq("status", filter.status as "active");
  const { data, count } = await q;
  return { rows: data ?? [], total: count ?? 0 };
}

export async function listInvoicesPage(filter: {
  status?: string;
  from?: string;
  to?: string;
  page: number;
}) {
  const supabase = await createClient();
  let q = supabase
    .from("invoices")
    .select(INVOICE_LIST, { count: "exact" })
    .neq("status", "draft")
    .order("due_date", { ascending: false })
    .range(filter.page * PAGE_SIZE, filter.page * PAGE_SIZE + PAGE_SIZE - 1);
  if (filter.status === "overdue_any") {
    q = q
      .in("status", ["open", "partially_paid", "overdue"])
      .lt("due_date", new Date().toISOString().slice(0, 10));
  } else if (filter.status) q = q.eq("status", filter.status as "open");
  if (filter.from) q = q.gte("due_date", filter.from);
  if (filter.to) q = q.lte("due_date", filter.to);
  const { data, count } = await q;
  return { rows: data ?? [], total: count ?? 0 };
}

export async function listPaymentsPage(filter: { from?: string; to?: string; page: number }) {
  const supabase = await createClient();
  let q = supabase
    .from("payments")
    .select(
      "id, method, amount_cents, received_on, status, reference, reverse_reason, establishment_id, establishments(name)",
      {
        count: "exact",
      },
    )
    .order("received_on", { ascending: false })
    .range(filter.page * PAGE_SIZE, filter.page * PAGE_SIZE + PAGE_SIZE - 1);
  if (filter.from) q = q.gte("received_on", filter.from);
  if (filter.to) q = q.lte("received_on", filter.to);
  const { data, count } = await q;
  return { rows: data ?? [], total: count ?? 0 };
}

export async function listCoupons() {
  const supabase = await createClient();
  const [coupons, used] = await Promise.all([
    supabase.from("coupons").select("*").order("created_at", { ascending: false }),
    supabase.from("subscription_discounts").select("coupon_id").not("coupon_id", "is", null),
  ]);
  const counts = new Map<string, number>();
  for (const u of used.data ?? [])
    if (u.coupon_id) counts.set(u.coupon_id, (counts.get(u.coupon_id) ?? 0) + 1);
  return (coupons.data ?? []).map((c) => ({ ...c, redemptions: counts.get(c.id) ?? 0 }));
}

export async function listRecurringItems(subscriptionId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscription_items")
    .select("id, description, quantity, unit_price_cents, starts_on, ends_on, end_reason")
    .eq("subscription_id", subscriptionId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
