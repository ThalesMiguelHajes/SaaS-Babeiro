"use server";

import { z } from "zod";

import { requireMembership } from "@/lib/authz";
import { todayInTimeZone } from "@/modules/availability/rules";

import { asaasSandboxConfig, getAsaasPix } from "./providers/asaas.server";
import { getInvoice } from "./queries";
import { effectiveInvoiceStatus, isPayable } from "./rules";

export async function getInvoiceSandboxPix(slug: string, invoiceId: string) {
  const config = asaasSandboxConfig();
  if (!config || !z.uuid().safeParse(invoiceId).success) return { status: "unavailable" } as const;

  const { establishment } = await requireMembership(slug, ["owner", "admin"]);
  const invoice = await getInvoice(invoiceId);
  const today = todayInTimeZone("America/Sao_Paulo");
  if (
    !invoice ||
    invoice.establishment_id !== establishment.id ||
    !isPayable(effectiveInvoiceStatus(invoice.status, invoice.due_date, today)) ||
    invoice.total_cents <= invoice.amount_paid_cents
  ) {
    return { status: "unavailable" } as const;
  }

  try {
    return await getAsaasPix(config, {
      id: invoice.id,
      establishmentId: establishment.id,
      amountCents: invoice.total_cents - invoice.amount_paid_cents,
      dueDate: invoice.due_date >= today ? invoice.due_date : today,
    });
  } catch {
    return { status: "unavailable" } as const;
  }
}
