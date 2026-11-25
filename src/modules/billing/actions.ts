"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMembership, isPlatformAdmin } from "@/lib/authz";
import { messageFor, toDomainErrorCode } from "@/lib/errors";
import { detectImageType } from "@/lib/images.server";
import { parseBrlToCents } from "@/lib/money";
import { fail, ok, type Result } from "@/lib/result";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { validationFailure } from "@/lib/validation";

import {
  addChargeSchema,
  assignSchema,
  billingSettingsSchema,
  changePlanSchema,
  discountSchema,
  planVersionSchema,
  recordPaymentSchema,
  type AddChargeInput,
  type AssignInput,
  type BillingSettingsInput,
  type ChangePlanInput,
  type DiscountInput,
  type PlanVersionInput,
  type RecordPaymentInput,
} from "./schemas";

/*
 * Ações do financeiro da plataforma. A permissão definitiva (billing.manage) é verificada em
 * cada RPC; aqui barramos cedo quem não é da plataforma. Valores vêm de schemas Zod e são
 * validados de novo pelos checks do banco (BILLING §20).
 */

const PROOFS_BUCKET = "billing-proofs";
const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const uuid = z.uuid();
const reason = z.string().trim().min(3, "Informe o motivo.").max(300);

type RpcError = { code?: string; message?: string };
const failFrom = (e: RpcError): Result<never> => {
  const code = toDomainErrorCode(e);
  return fail(code, messageFor(code));
};

async function platformOnly() {
  return isPlatformAdmin();
}

function revalidateBilling(establishmentId?: string) {
  revalidatePath("/admin/financeiro", "layout");
  if (establishmentId) revalidatePath(`/admin/estabelecimentos/${establishmentId}`);
  revalidatePath("/painel", "layout");
}

async function rpc<T>(
  fn: (
    sb: Awaited<ReturnType<typeof createClient>>,
  ) => PromiseLike<{ data: T | null; error: RpcError | null }>,
  establishmentId?: string,
): Promise<Result<T | null>> {
  const supabase = await createClient();
  const { data, error } = await fn(supabase);
  if (error) return failFrom(error);
  revalidateBilling(establishmentId);
  return ok(data);
}

// --- Assinatura -------------------------------------------------------------------------

export async function assignSubscriptionAction(establishmentId: string, input: AssignInput) {
  if (!(await platformOnly()) || !uuid.safeParse(establishmentId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;
  return rpc(
    (sb) =>
      sb.rpc("billing_assign_subscription", {
        p_establishment_id: establishmentId,
        p_plan_version_id: d.planVersionId,
        p_anchor_date: d.anchorDate,
        p_use_offer: d.useOffer,
        p_setup_mode: d.useOffer ? "first_invoice" : d.setupMode,
        p_setup_fee_cents: d.setupFee as number,
        p_price_override_cents: d.priceOverride as number,
        p_override_reason: d.overrideReason,
        p_extra_professionals: d.extraProfessionals,
        p_issue: true,
        p_notes: d.notes,
      }),
    establishmentId,
  );
}

export async function changePlanAction(
  establishmentId: string,
  subscriptionId: string,
  input: ChangePlanInput,
) {
  if (!(await platformOnly()) || !uuid.safeParse(subscriptionId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = changePlanSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  return rpc(
    (sb) =>
      sb.rpc("billing_change_plan", {
        p_subscription_id: subscriptionId,
        p_plan_version_id: parsed.data.planVersionId,
        p_extra_professionals: parsed.data.extraProfessionals,
        p_reason: parsed.data.reason,
      }),
    establishmentId,
  );
}

export async function transitionSubscriptionAction(
  establishmentId: string,
  subscriptionId: string,
  to: "active" | "suspended" | "canceled" | "trialing",
  why: string,
) {
  if (!(await platformOnly()) || !uuid.safeParse(subscriptionId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  if (!["active", "suspended", "canceled", "trialing"].includes(to))
    return fail("VALIDATION_ERROR", messageFor("VALIDATION_ERROR"));
  return rpc(
    (sb) =>
      sb.rpc("billing_transition_subscription", {
        p_subscription_id: subscriptionId,
        p_to: to,
        p_reason: why,
      }),
    establishmentId,
  );
}

export async function generateNextInvoiceAction(establishmentId: string, subscriptionId: string) {
  if (!(await platformOnly()) || !uuid.safeParse(subscriptionId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  return rpc(
    (sb) =>
      sb.rpc("billing_generate_next_invoice", { p_subscription_id: subscriptionId, p_issue: true }),
    establishmentId,
  );
}

export async function addChargeAction(establishmentId: string, input: AddChargeInput) {
  if (!(await platformOnly()) || !uuid.safeParse(establishmentId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = addChargeSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;
  return rpc(
    (sb) =>
      sb.rpc("billing_add_charge", {
        p_establishment_id: establishmentId,
        p_add_on_id: d.addOnId as string,
        p_description: d.description,
        p_quantity: d.quantity,
        p_unit_price_cents: d.unitPrice,
        p_standalone: d.standalone,
      }),
    establishmentId,
  );
}

export async function grantDiscountAction(
  establishmentId: string,
  subscriptionId: string,
  input: DiscountInput,
) {
  if (!(await platformOnly()) || !uuid.safeParse(subscriptionId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = discountSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;
  return rpc(
    (sb) =>
      sb.rpc("billing_grant_discount", {
        p_subscription_id: subscriptionId,
        p_name: d.name,
        p_kind: d.kind,
        p_value: d.value,
        p_duration: d.duration,
        p_cycles: d.cycles as number,
        p_reason: d.reason,
      }),
    establishmentId,
  );
}

export async function revokeDiscountAction(
  establishmentId: string,
  discountId: string,
  why: string,
) {
  if (!(await platformOnly()) || !uuid.safeParse(discountId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  return rpc(
    (sb) => sb.rpc("billing_revoke_discount", { p_discount_id: discountId, p_reason: why }),
    establishmentId,
  );
}

// --- Faturas e pagamentos ---------------------------------------------------------------

export async function cancelInvoiceAction(invoiceId: string, why: string) {
  if (!(await platformOnly()) || !uuid.safeParse(invoiceId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const r = reason.safeParse(why);
  if (!r.success) return validationFailure(r.error);
  return rpc((sb) =>
    sb.rpc("billing_cancel_invoice", { p_invoice_id: invoiceId, p_reason: r.data }),
  );
}

export async function extendDueDateAction(invoiceId: string, dueDate: string, why: string) {
  if (!(await platformOnly()) || !uuid.safeParse(invoiceId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return fail("VALIDATION_ERROR", "Informe a nova data.");
  return rpc((sb) =>
    sb.rpc("billing_extend_due_date", {
      p_invoice_id: invoiceId,
      p_due_date: dueDate,
      p_reason: why,
    }),
  );
}

export async function recordPaymentAction(
  establishmentId: string,
  invoiceId: string | null,
  input: RecordPaymentInput,
) {
  if (!(await platformOnly()) || !uuid.safeParse(establishmentId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;
  return rpc(
    (sb) =>
      sb.rpc("billing_record_payment", {
        p_establishment_id: establishmentId,
        p_invoice_id: invoiceId as string,
        p_amount_cents: d.amount,
        p_method: d.method,
        p_received_on: d.receivedOn,
        p_reference: d.reference,
        p_notes: "",
      }),
    establishmentId,
  );
}

export async function reversePaymentAction(paymentId: string, why: string) {
  if (!(await platformOnly()) || !uuid.safeParse(paymentId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const r = reason.safeParse(why);
  if (!r.success) return validationFailure(r.error);
  return rpc((sb) =>
    sb.rpc("billing_reverse_payment", { p_payment_id: paymentId, p_reason: r.data }),
  );
}

export async function reviewProofAction(
  proofId: string,
  accept: boolean,
  amountCents: number,
  why: string,
) {
  if (!(await platformOnly()) || !uuid.safeParse(proofId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  if (accept && (!Number.isInteger(amountCents) || amountCents <= 0))
    return fail("VALIDATION_ERROR", "Informe o valor recebido.");
  return rpc((sb) =>
    sb.rpc("billing_review_proof", {
      p_proof_id: proofId,
      p_accept: accept,
      p_amount_cents: amountCents,
      p_method: "pix",
      p_reason: why,
    }),
  );
}

export async function resolveRequestAction(
  requestId: string,
  status: "done" | "dismissed",
  response: string,
) {
  if (!(await platformOnly()) || !uuid.safeParse(requestId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  return rpc((sb) =>
    sb.rpc("billing_resolve_request", {
      p_request_id: requestId,
      p_status: status,
      p_response: response,
    }),
  );
}

// --- Catálogo e configurações -------------------------------------------------------------

export async function createPlanVersionAction(planId: string, input: PlanVersionInput) {
  if (!(await platformOnly()) || !uuid.safeParse(planId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = planVersionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;
  return rpc((sb) =>
    sb.rpc("billing_create_plan_version", {
      p_plan_id: planId,
      p_monthly_price_cents: d.monthlyPrice,
      p_annual_price_cents: d.annualPrice as number,
      p_included_professionals: d.includedProfessionals,
      p_extra_professional_price_cents: d.extraPrice as number,
    }),
  );
}

export async function updateBillingSettingsAction(input: BillingSettingsInput) {
  if (!(await platformOnly())) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = billingSettingsSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;
  return rpc((sb) =>
    sb.rpc("billing_update_settings", {
      p_pix_key_type: d.pixKeyType,
      p_pix_key: d.pixKey,
      p_pix_receiver_name: d.pixReceiverName,
      p_payment_instructions: d.instructions,
      p_support_whatsapp_e164: d.supportWhatsapp as string,
      p_default_setup_fee_cents: d.setupFee,
    }),
  );
}

// --- Estabelecimento (owner/admin) --------------------------------------------------------

/** Comprovante: tipo real pelo conteúdo, bucket privado; o envio NUNCA confirma o pagamento. */
export async function uploadProofAction(formData: FormData): Promise<Result<null>> {
  const slug = String(formData.get("slug") ?? "");
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const file = formData.get("file");
  const ctx = await getMembership(slug, ["owner", "admin"]);
  if (!ctx || !uuid.safeParse(invoiceId).success) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_PROOF_BYTES) {
    return fail("FILE_INVALID", "Envie um PDF ou imagem (JPG, PNG, WebP) de até 10 MB.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPdf = String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  const image = isPdf ? null : detectImageType(bytes);
  if (!isPdf && !image)
    return fail("FILE_INVALID", "Envie um PDF ou imagem (JPG, PNG, WebP) de até 10 MB.");

  const path = `${ctx.establishment.id}/${invoiceId}/${crypto.randomUUID()}.${isPdf ? "pdf" : image!.ext}`;
  const admin = createAdminClient();
  const up = await admin.storage
    .from(PROOFS_BUCKET)
    .upload(path, bytes, { contentType: isPdf ? "application/pdf" : image!.mime, upsert: false });
  if (up.error) return fail("UNEXPECTED", messageFor("UNEXPECTED"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("billing_submit_proof", {
    p_invoice_id: invoiceId,
    p_storage_path: path,
  });
  if (error) {
    await admin.storage.from(PROOFS_BUCKET).remove([path]);
    return failFrom(error);
  }
  revalidateBilling(ctx.establishment.id);
  return ok(null);
}

/** URL assinada de 60 s, só depois de confirmar que o usuário enxerga o comprovante (RLS). */
export async function proofUrlAction(proofId: string): Promise<Result<string>> {
  if (!uuid.safeParse(proofId).success) return fail("NOT_FOUND", messageFor("NOT_FOUND"));
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_proofs")
    .select("storage_path")
    .eq("id", proofId)
    .maybeSingle();
  if (!data) return fail("NOT_FOUND", messageFor("NOT_FOUND"));
  const signed = await createAdminClient()
    .storage.from(PROOFS_BUCKET)
    .createSignedUrl(data.storage_path, 60);
  if (signed.error || !signed.data) return fail("UNEXPECTED", messageFor("UNEXPECTED"));
  return ok(signed.data.signedUrl);
}

export async function createRequestAction(
  slug: string,
  kind: string,
  message: string,
): Promise<Result<null>> {
  const ctx = await getMembership(slug, ["owner", "admin"]);
  if (!ctx) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = z
    .object({
      kind: z.enum(["change_plan", "extra_professionals", "add_on", "cancel", "support"]),
      message: z.string().trim().min(3, "Descreva a solicitação.").max(1000),
    })
    .safeParse({ kind, message });
  if (!parsed.success) return validationFailure(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("billing_create_request", {
    p_establishment_id: ctx.establishment.id,
    p_kind: parsed.data.kind,
    p_message: parsed.data.message,
  });
  if (error) return failFrom(error);
  revalidateBilling(ctx.establishment.id);
  return ok(null);
}

// --- Rotina e régua (B4) -------------------------------------------------------------------

export async function runBillingNowAction() {
  if (!(await platformOnly())) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  return rpc((sb) => sb.rpc("billing_run_now"));
}

export async function markNotificationAction(notificationId: string, status: "sent" | "dismissed") {
  if (!(await platformOnly()) || !uuid.safeParse(notificationId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  if (status !== "sent" && status !== "dismissed")
    return fail("VALIDATION_ERROR", messageFor("VALIDATION_ERROR"));
  return rpc((sb) =>
    sb.rpc("billing_mark_notification", { p_notification_id: notificationId, p_status: status }),
  );
}

const dunningSchema = z.object({
  issueDaysBeforeDue: z.coerce.number().int().min(0).max(28),
  pastDueAfterDays: z.coerce.number().int().min(0).max(60),
  graceDays: z.coerce.number().int().min(0).max(90),
  autoSuspendEnabled: z.boolean(),
  offsets: z
    .string()
    .trim()
    .regex(
      /^-?\d{1,2}(\s*,\s*-?\d{1,2})*$/,
      "Use números separados por vírgula. Ex.: -5, -1, 0, 1, 5",
    )
    .transform((v) => [...new Set(v.split(",").map((x) => Number(x.trim())))].sort((a, b) => a - b))
    .refine(
      (list) => list.length >= 1 && list.length <= 12 && list.every((n) => n >= -30 && n <= 60),
      "Entre 1 e 12 dias, de -30 a 60.",
    ),
});
export type DunningInput = z.input<typeof dunningSchema>;

export async function updateDunningAction(input: DunningInput) {
  if (!(await platformOnly())) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = dunningSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;
  return rpc((sb) =>
    sb.rpc("billing_update_dunning", {
      p_issue_days_before_due: d.issueDaysBeforeDue,
      p_past_due_after_days: d.pastDueAfterDays,
      p_grace_days: d.graceDays,
      p_auto_suspend_enabled: d.autoSuspendEnabled,
      p_dunning_offsets: d.offsets,
    }),
  );
}

export async function setDunningOverrideAction(
  establishmentId: string,
  subscriptionId: string,
  autoSuspend: "default" | "on" | "off",
  graceDays: string,
) {
  if (!(await platformOnly()) || !uuid.safeParse(subscriptionId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const grace = graceDays.trim() === "" ? null : Number(graceDays);
  if (grace !== null && (!Number.isInteger(grace) || grace < 0 || grace > 90)) {
    return fail("VALIDATION_ERROR", "Tolerância entre 0 e 90 dias.");
  }
  return rpc(
    (sb) =>
      sb.rpc("billing_set_subscription_dunning", {
        p_subscription_id: subscriptionId,
        p_auto_suspend_override: (autoSuspend === "default"
          ? null
          : autoSuspend === "on") as boolean,
        p_grace_days_override: grace as number,
      }),
    establishmentId,
  );
}

export async function schedulePlanChangeAction(
  establishmentId: string,
  subscriptionId: string,
  input: ChangePlanInput,
) {
  if (!(await platformOnly()) || !uuid.safeParse(subscriptionId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = changePlanSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  return rpc(
    (sb) =>
      sb.rpc("billing_schedule_plan_change", {
        p_subscription_id: subscriptionId,
        p_plan_version_id: parsed.data.planVersionId,
        p_extra_professionals: parsed.data.extraProfessionals,
        p_reason: parsed.data.reason,
      }),
    establishmentId,
  );
}

// --- B3: cupons e adicionais recorrentes ---------------------------------------------------

const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{3,30}$/, "Use 3 a 30 letras, números, - ou _."),
    name: z.string().trim().min(2, "Dê um nome ao cupom.").max(120),
    kind: z.enum(["percent", "fixed", "free"]),
    percent: z.coerce.number().min(0).max(100),
    amount: z.string().trim(),
    duration: z.enum(["once", "repeating", "forever"]),
    cycles: z.coerce.number().int().min(1).max(120).nullable(),
    validUntil: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
    maxRedemptions: z.string().trim().regex(/^\d*$/, "Somente números."),
  })
  .transform((d, ctx) => {
    const amount = d.amount ? parseBrlToCents(d.amount) : null;
    if (d.kind === "percent" && !(d.percent > 0))
      ctx.addIssue({ code: "custom", message: "Informe o percentual.", path: ["percent"] });
    if (d.kind === "fixed" && !(amount && amount > 0))
      ctx.addIssue({ code: "custom", message: "Informe o valor.", path: ["amount"] });
    if (d.duration === "repeating" && !d.cycles)
      ctx.addIssue({ code: "custom", message: "Informe por quantas faturas.", path: ["cycles"] });
    return {
      ...d,
      value:
        d.kind === "percent" ? Math.round(d.percent * 100) : d.kind === "fixed" ? (amount ?? 0) : 0,
      cycles: d.duration === "repeating" ? d.cycles : null,
      validUntil: d.validUntil || null,
      maxRedemptions: d.maxRedemptions ? Number(d.maxRedemptions) : null,
    };
  });
export type CouponInput = z.input<typeof couponSchema>;

export async function createCouponAction(input: CouponInput) {
  if (!(await platformOnly())) return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;
  return rpc((sb) =>
    sb.rpc("billing_create_coupon", {
      p_code: d.code,
      p_name: d.name,
      p_kind: d.kind,
      p_value: d.value,
      p_duration: d.duration,
      p_cycles: d.cycles as number,
      p_valid_until: d.validUntil as string,
      p_max_redemptions: d.maxRedemptions as number,
    }),
  );
}

export async function setCouponActiveAction(couponId: string, active: boolean) {
  if (!(await platformOnly()) || !uuid.safeParse(couponId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  return rpc((sb) =>
    sb.rpc("billing_set_coupon_active", { p_coupon_id: couponId, p_active: active }),
  );
}

export async function applyCouponAction(
  establishmentId: string,
  subscriptionId: string,
  code: string,
) {
  if (!(await platformOnly()) || !uuid.safeParse(subscriptionId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(code.trim()))
    return fail("COUPON_INVALID", messageFor("COUPON_INVALID"));
  return rpc(
    (sb) =>
      sb.rpc("billing_apply_coupon", { p_subscription_id: subscriptionId, p_code: code.trim() }),
    establishmentId,
  );
}

export async function addRecurringItemAction(
  establishmentId: string,
  subscriptionId: string,
  input: {
    addOnId: string | null;
    description: string;
    quantity: number;
    unitPrice: string;
    startsOn: string;
  },
) {
  if (!(await platformOnly()) || !uuid.safeParse(subscriptionId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  const price = parseBrlToCents(input.unitPrice);
  if (
    price === null ||
    input.description.trim().length < 2 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.startsOn)
  ) {
    return fail("VALIDATION_ERROR", "Confira descrição, valor e data de início.");
  }
  return rpc(
    (sb) =>
      sb.rpc("billing_add_recurring_item", {
        p_subscription_id: subscriptionId,
        p_add_on_id: input.addOnId as string,
        p_description: input.description,
        p_quantity: input.quantity,
        p_unit_price_cents: price,
        p_starts_on: input.startsOn,
      }),
    establishmentId,
  );
}

export async function endRecurringItemAction(
  establishmentId: string,
  itemId: string,
  endsOn: string,
  why: string,
) {
  if (!(await platformOnly()) || !uuid.safeParse(itemId).success)
    return fail("FORBIDDEN", messageFor("FORBIDDEN"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endsOn))
    return fail("VALIDATION_ERROR", "Informe a data de término.");
  return rpc(
    (sb) =>
      sb.rpc("billing_end_recurring_item", { p_item_id: itemId, p_ends_on: endsOn, p_reason: why }),
    establishmentId,
  );
}
